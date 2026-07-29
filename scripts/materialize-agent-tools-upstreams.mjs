import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node scripts/materialize-agent-tools-upstreams.mjs <manifest.json>');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entries = Array.isArray(manifest.e) ? manifest.e : [];
if (manifest.n !== 214 || entries.length !== 214) {
  throw new Error(`Expected 214 upstream entries, got ${entries.length}`);
}

const skillsRoot = join(root, '.agents', 'skills');
const cacheRoot = join(root, '.agent-tools-upstream-cache');
await rm(cacheRoot, { recursive: true, force: true });
await mkdir(cacheRoot, { recursive: true });
await mkdir(skillsRoot, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${options.capture ? `: ${result.stderr}` : ''}`);
  }
  return options.capture ? String(result.stdout || '').trim() : '';
}

function safeDest(value) {
  const v = String(value || '');
  if (!/^[A-Za-z0-9._-]+$/.test(v) || v === '.' || v === '..') throw new Error(`Unsafe destination: ${value}`);
  return v;
}

function safeSourcePath(value) {
  const v = String(value || '').replaceAll('\\', '/');
  if (!v || v.startsWith('/') || v.includes('\0')) throw new Error(`Unsafe source path: ${value}`);
  if (v !== '.' && v.split('/').some((p) => !p || p === '..')) throw new Error(`Unsafe source path: ${value}`);
  return v;
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

const normalized = entries.map((row) => {
  if (!Array.isArray(row) || row.length < 4) throw new Error('Invalid manifest row');
  const [destRaw, sourceUrlRaw, sourcePathRaw, commitRaw, licenseRaw] = row;
  const dest = safeDest(destRaw);
  const sourceUrl = String(sourceUrlRaw || '');
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(sourceUrl)) {
    throw new Error(`Unsupported upstream URL for ${dest}: ${sourceUrl}`);
  }
  return {
    dest,
    sourceUrl,
    sourcePath: safeSourcePath(sourcePathRaw),
    commit: commitRaw ? String(commitRaw) : null,
    license: licenseRaw ? String(licenseRaw) : null
  };
});

const dests = new Set();
for (const entry of normalized) {
  if (dests.has(entry.dest)) throw new Error(`Duplicate destination: ${entry.dest}`);
  dests.add(entry.dest);
  if (entry.dest.startsWith('mohammed-')) throw new Error(`Upstream manifest collides with custom skill: ${entry.dest}`);
}

const groups = new Map();
for (const entry of normalized) {
  const key = `${entry.sourceUrl}\n${entry.commit || 'HEAD'}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(entry);
}

let materialized = 0;
for (const [key, group] of groups) {
  const { sourceUrl, commit } = group[0];
  const keyHash = createHash('sha256').update(key).digest('hex').slice(0, 16);
  const repoDir = join(cacheRoot, keyHash);
  await mkdir(repoDir, { recursive: true });

  run('git', ['init', '--quiet'], { cwd: repoDir });
  run('git', ['remote', 'add', 'origin', sourceUrl], { cwd: repoDir });
  const requestedRef = commit || 'HEAD';
  run('git', ['fetch', '--quiet', '--depth=1', '--filter=blob:none', 'origin', requestedRef], { cwd: repoDir });
  const resolvedCommit = run('git', ['rev-parse', 'FETCH_HEAD'], { cwd: repoDir, capture: true });

  const sourcePaths = [...new Set(group.map((entry) => entry.sourcePath))];
  run('git', ['checkout', '--quiet', 'FETCH_HEAD', '--', ...sourcePaths], { cwd: repoDir });

  for (const entry of group) {
    const destDir = join(skillsRoot, entry.dest);
    if (await exists(destDir)) throw new Error(`Destination already exists before upstream copy: ${entry.dest}`);
    await mkdir(destDir, { recursive: true });

    const sourceDir = entry.sourcePath === '.' ? repoDir : resolve(repoDir, ...entry.sourcePath.split('/'));
    if (!sourceDir.startsWith(repoDir)) throw new Error(`Unsafe resolved path for ${entry.dest}`);
    if (!await exists(join(sourceDir, 'SKILL.md'))) {
      throw new Error(`${entry.dest}: upstream path has no SKILL.md (${entry.sourceUrl} @ ${resolvedCommit}:${entry.sourcePath})`);
    }

    await cp(sourceDir, destDir, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
      filter: (source) => basename(source) !== '.git'
    });

    const hasLicense = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'UPSTREAM_LICENSE', 'UPSTREAM_LICENSE.md', 'UPSTREAM_LICENSE.txt']
      .some(async (name) => await exists(join(destDir, name)));
    if (!hasLicense) {
      for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
        const candidate = join(repoDir, name);
        if (await exists(candidate)) {
          await cp(candidate, join(destDir, `UPSTREAM_${name}`));
          break;
        }
      }
    }

    await writeFile(join(destDir, '.mohammed-import.json'), JSON.stringify({
      importedFrom: 'Mohammed_AI_Agent_Tools(1).zip manifest',
      sourceUrl: entry.sourceUrl,
      sourcePath: entry.sourcePath,
      requestedCommit: entry.commit,
      resolvedCommit,
      license: entry.license,
      materializedAt: new Date().toISOString()
    }, null, 2) + '\n', 'utf8');
    materialized += 1;
    process.stdout.write(`[${materialized}/214] ${entry.dest}\n`);
  }
}

await rm(cacheRoot, { recursive: true, force: true });
if (materialized !== 214) throw new Error(`Expected to materialize 214 upstream skills, got ${materialized}`);
console.log('Materialized 214 upstream Agent Tools skills.');
