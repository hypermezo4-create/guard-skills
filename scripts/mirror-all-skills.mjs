import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const VENDOR_ROOT = join(ROOT, 'vendor');
const SKILLS_ROOT = join(VENDOR_ROOT, 'skills');
const TMP_ROOT = join(VENDOR_ROOT, '.tmp');
const API_BASE = (process.env.SKILLS_API_BASE || 'https://skills.sh').replace(/\/$/, '');
const TOKEN = process.env.VERCEL_OIDC_TOKEN || process.env.SKILLS_SH_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const USER_AGENT = 'Mohammed-Skills-Universe/2.0 (+https://github.com/hypermezo4-create/guard-skills)';

const args = new Set(process.argv.slice(2));
const WITH_AUDITS = !args.has('--no-audits');
const PRUNE = args.has('--prune');
const INCLUDE_DUPLICATES = true; // Full mirror means full mirror. Duplicates are marked, never silently dropped.
const MAX_ATTEMPTS = 6;
const MIN_REQUEST_GAP_MS = 115; // stays below the documented 600 req/min authenticated ceiling.

if (!TOKEN) {
  throw new Error(
    'Full mirroring requires a current skills.sh authenticated token. Set VERCEL_OIDC_TOKEN (preferred) or SKILLS_SH_TOKEN. See https://skills.sh/docs/api'
  );
}

let lastRequestAt = 0;
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, MIN_REQUEST_GAP_MS - (now - lastRequestAt));
  if (wait) await sleep(wait);
  lastRequestAt = Date.now();
}

async function fetchJson(url, { auth = true } = {}) {
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    await throttle();
    const headers = { accept: 'application/json', 'user-agent': USER_AGENT };
    if (auth) headers.authorization = `Bearer ${TOKEN}`;
    if (!auth && GITHUB_TOKEN) headers.authorization = `Bearer ${GITHUB_TOKEN}`;

    const response = await fetch(url, { headers });
    if (response.ok) return response.json();

    const body = await response.text();
    const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`${url} -> ${response.status}: ${body.slice(0, 700)}`);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30_000, 800 * 2 ** (attempt - 1));
    await sleep(backoff);
  }
  throw new Error(`Failed after ${MAX_ATTEMPTS} attempts: ${url}`);
}

function safeSegment(value) {
  const normalized = String(value || '').normalize('NFKC').trim();
  if (!normalized || normalized === '.' || normalized === '..') throw new Error(`Unsafe empty path segment: ${value}`);
  return normalized.replace(/[^a-zA-Z0-9._-]/g, (c) => `_x${c.codePointAt(0).toString(16)}_`);
}

function safeRelativePath(filePath) {
  const raw = String(filePath || '').replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || raw.includes('\0')) throw new Error(`Unsafe skill file path: ${filePath}`);
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe skill file path: ${filePath}`);
  return parts.map(safeSegment).join('/');
}

function skillDir(skill) {
  const sourceParts = String(skill.source || 'unknown').split('/').map(safeSegment);
  return join(SKILLS_ROOT, ...sourceParts, safeSegment(skill.slug));
}

function deterministicContentHash(files) {
  const hash = createHash('sha256');
  const sorted = [...files].sort((a, b) => String(a.path).localeCompare(String(b.path)));
  for (const file of sorted) {
    hash.update(String(file.path));
    hash.update('\0');
    hash.update(String(file.contents ?? ''));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function localRiskScan(files) {
  const findings = [];
  const patterns = [
    ['credential-access', /(API[_-]?KEY|SECRET|TOKEN|PASSWORD|PRIVATE[_-]?KEY|\.env)/i],
    ['network-access', /\b(curl|wget|fetch\(|axios|requests\.|http:\/\/|https:\/\/)/i],
    ['shell-execution', /\b(exec|spawn|subprocess|child_process|powershell|cmd\.exe|bash\s+-c|sh\s+-c)\b/i],
    ['destructive-command', /\b(rm\s+-rf|del\s+\/f|format\s+[a-z]:|mkfs\.|git\s+reset\s+--hard|git\s+clean\s+-fdx)\b/i],
    ['privilege-escalation', /\b(sudo|runas|setuid|chmod\s+777)\b/i],
    ['prompt-injection-signal', /(ignore (all|any|the) previous instructions|reveal (the )?(system|developer) prompt|exfiltrat)/i]
  ];

  for (const file of files) {
    const text = String(file.contents ?? '');
    for (const [kind, regex] of patterns) {
      if (regex.test(text)) findings.push({ kind, path: String(file.path) });
    }
  }
  return findings;
}

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function listCatalog() {
  const all = [];
  let page = 0;
  const perPage = 500;
  let reportedTotal = null;

  while (true) {
    const url = new URL(`${API_BASE}/api/v1/skills`);
    url.searchParams.set('view', 'all-time');
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));
    const payload = await fetchJson(url);
    if (!Array.isArray(payload.data) || !payload.pagination) throw new Error('Unexpected skills.sh catalog response');
    all.push(...payload.data);
    reportedTotal = payload.pagination.total;
    process.stdout.write(`catalog page ${page}: ${all.length}/${reportedTotal ?? '?'}\n`);
    if (!payload.pagination.hasMore) break;
    page += 1;
  }

  const unique = new Map();
  for (const skill of all) {
    if (!skill?.id || !skill?.source || !skill?.slug) continue;
    if (!INCLUDE_DUPLICATES && skill.isDuplicate) continue;
    unique.set(skill.id, skill);
  }
  return { skills: [...unique.values()], reportedTotal };
}

async function githubLicenseForSource(source, sourceType, cache) {
  if (sourceType !== 'github' || !GITHUB_TOKEN) return null;
  if (cache[source] !== undefined) return cache[source];
  const parts = String(source).split('/');
  if (parts.length !== 2) return null;
  try {
    const payload = await fetchJson(`https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/license`, { auth: false });
    cache[source] = {
      spdxId: payload.license?.spdx_id || null,
      name: payload.license?.name || null,
      htmlUrl: payload.html_url || null
    };
  } catch (error) {
    cache[source] = { spdxId: null, name: null, error: String(error.message || error) };
  }
  return cache[source];
}

async function mirrorOne(skill, previousEntry, licenseCache) {
  const detail = await fetchJson(`${API_BASE}/api/v1/skills/${skill.id}`);
  const files = Array.isArray(detail.files) ? detail.files : null;
  const upstreamHash = detail.hash || null;

  if (!files) {
    return {
      entry: { ...skill, upstreamHash, status: 'snapshot-unavailable', mirrored: false },
      changed: previousEntry?.upstreamHash !== upstreamHash || previousEntry?.status !== 'snapshot-unavailable'
    };
  }

  for (const file of files) {
    if (typeof file?.path !== 'string' || typeof file?.contents !== 'string') {
      throw new Error(`${skill.id}: invalid file payload`);
    }
    safeRelativePath(file.path);
    if (Buffer.byteLength(file.contents, 'utf8') >= 95 * 1024 * 1024) {
      throw new Error(`${skill.id}/${file.path}: single file is too large for a normal GitHub repository`);
    }
  }

  let audits = null;
  if (WITH_AUDITS) {
    try {
      const payload = await fetchJson(`${API_BASE}/api/v1/skills/audit/${skill.id}`);
      audits = Array.isArray(payload.audits) ? payload.audits : [];
    } catch (error) {
      audits = [{ provider: 'mirror', status: 'error', summary: String(error.message || error), auditedAt: new Date().toISOString() }];
    }
  }

  const localHash = deterministicContentHash(files);
  const localFindings = localRiskScan(files);
  const license = await githubLicenseForSource(skill.source, skill.sourceType, licenseCache);
  const target = skillDir(skill);

  const externalFails = (audits || []).filter((a) => String(a.status).toLowerCase() === 'fail');
  const highRisk = (audits || []).filter((a) => String(a.riskLevel || '').toUpperCase() === 'HIGH');
  const installPolicy = externalFails.length || highRisk.length || localFindings.some((f) => f.kind === 'destructive-command')
    ? 'blocked-by-default'
    : 'review-before-use';

  const entry = {
    id: skill.id,
    name: skill.name || skill.slug,
    slug: skill.slug,
    source: skill.source,
    sourceType: skill.sourceType || null,
    installUrl: skill.installUrl || null,
    skillsShUrl: skill.url || null,
    installs: Number(skill.installs || detail.installs || 0),
    isDuplicate: Boolean(skill.isDuplicate),
    upstreamHash,
    localHash,
    fileCount: files.length,
    byteCount: files.reduce((sum, file) => sum + Buffer.byteLength(file.contents, 'utf8'), 0),
    status: 'mirrored',
    mirrored: true,
    license,
    audits,
    localFindings,
    installPolicy
  };

  const unchanged = previousEntry?.localHash === localHash && previousEntry?.upstreamHash === upstreamHash;
  if (unchanged) return { entry: { ...previousEntry, ...entry }, changed: false };

  const temp = join(TMP_ROOT, createHash('sha256').update(skill.id).digest('hex').slice(0, 24));
  await rm(temp, { recursive: true, force: true });
  await mkdir(temp, { recursive: true });

  for (const file of files) {
    const relative = safeRelativePath(file.path);
    const out = join(temp, relative);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, file.contents, 'utf8');
  }
  await writeFile(join(temp, '.upstream.json'), JSON.stringify(entry, null, 2) + '\n', 'utf8');

  await mkdir(dirname(target), { recursive: true });
  await rm(target, { recursive: true, force: true });
  await rename(temp, target);
  return { entry, changed: true };
}

async function main() {
  await mkdir(SKILLS_ROOT, { recursive: true });
  await mkdir(TMP_ROOT, { recursive: true });

  const previousManifest = await loadJson(join(VENDOR_ROOT, 'manifest.json'), { data: [] });
  const previous = new Map((previousManifest.data || []).map((entry) => [entry.id, entry]));
  const licenseCache = await loadJson(join(VENDOR_ROOT, 'licenses.json'), {});
  const { skills, reportedTotal } = await listCatalog();

  const manifest = [];
  let changed = 0;
  let unavailable = 0;
  let failed = 0;
  const failures = [];

  for (let index = 0; index < skills.length; index += 1) {
    const skill = skills[index];
    try {
      const result = await mirrorOne(skill, previous.get(skill.id), licenseCache);
      manifest.push(result.entry);
      if (result.changed) changed += 1;
      if (!result.entry.mirrored) unavailable += 1;
    } catch (error) {
      failed += 1;
      const previousEntry = previous.get(skill.id);
      const failure = { id: skill.id, error: String(error.message || error) };
      failures.push(failure);
      manifest.push(previousEntry ? { ...previousEntry, lastMirrorError: failure.error } : { ...skill, status: 'mirror-error', mirrored: false, lastMirrorError: failure.error });
    }
    process.stdout.write(`[${index + 1}/${skills.length}] ${skill.id}\n`);
  }

  const liveIds = new Set(skills.map((s) => s.id));
  if (PRUNE) {
    for (const old of previous.values()) {
      if (!liveIds.has(old.id) && old.source && old.slug) {
        await rm(skillDir(old), { recursive: true, force: true });
      }
    }
  }

  manifest.sort((a, b) => Number(b.installs || 0) - Number(a.installs || 0) || String(a.id).localeCompare(String(b.id)));
  const generatedAt = new Date().toISOString();
  await writeFile(join(VENDOR_ROOT, 'manifest.json'), JSON.stringify({ generatedAt, reportedTotal, count: manifest.length, data: manifest }, null, 2) + '\n');
  await writeFile(join(VENDOR_ROOT, 'licenses.json'), JSON.stringify(licenseCache, null, 2) + '\n');
  await writeFile(join(VENDOR_ROOT, 'failures.json'), JSON.stringify({ generatedAt, count: failures.length, data: failures }, null, 2) + '\n');
  await writeFile(join(VENDOR_ROOT, 'summary.json'), JSON.stringify({
    generatedAt,
    apiReportedTotal: reportedTotal,
    mirroredEntries: manifest.filter((m) => m.mirrored).length,
    unavailable,
    failures: failed,
    changed,
    auditsIncluded: WITH_AUDITS,
    duplicateEntriesIncluded: INCLUDE_DUPLICATES,
    policy: 'Mirror everything; mark provenance/risk; block risky installation by default rather than deleting knowledge.'
  }, null, 2) + '\n');

  await rm(TMP_ROOT, { recursive: true, force: true });

  if (failed) {
    console.error(`Mirror finished with ${failed} failures. See vendor/failures.json.`);
    process.exitCode = 2;
  } else {
    console.log(`Mirrored ${manifest.length - unavailable}/${manifest.length} skills; ${changed} changed.`);
  }
}

await main();
