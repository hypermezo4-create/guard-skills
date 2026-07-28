import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const view = valueAfter('--view', 'all-time');
const perPage = Math.min(500, Math.max(1, Number(valueAfter('--per-page', '500'))));
const token = process.env.VERCEL_OIDC_TOKEN || process.env.SKILLS_SH_TOKEN;

if (!['all-time', 'trending', 'hot'].includes(view)) {
  throw new Error(`Unsupported view: ${view}`);
}
if (!token) {
  throw new Error('Missing VERCEL_OIDC_TOKEN (preferred) or SKILLS_SH_TOKEN. See https://skills.sh/docs/api');
}

const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/json',
  'user-agent': 'Mohammed-Skills-Universe/1.0'
};

const skills = [];
let page = 0;
let total = null;

while (true) {
  const url = new URL('https://skills.sh/api/v1/skills');
  url.searchParams.set('view', view);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`skills.sh ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.data) || !payload.pagination) {
    throw new Error('Unexpected skills.sh response shape');
  }

  skills.push(...payload.data);
  total = payload.pagination.total;
  if (!payload.pagination.hasMore) break;
  page += 1;
}

const unique = new Map();
for (const skill of skills) {
  if (!skill?.id) continue;
  const current = unique.get(skill.id);
  if (!current || Number(skill.installs || 0) > Number(current.installs || 0)) {
    unique.set(skill.id, skill);
  }
}

const normalized = [...unique.values()].sort((a, b) => {
  const installs = Number(b.installs || 0) - Number(a.installs || 0);
  return installs || String(a.id).localeCompare(String(b.id));
});

const sourceMap = new Map();
for (const skill of normalized) {
  const key = skill.source || 'unknown';
  const source = sourceMap.get(key) || {
    source: key,
    sourceType: skill.sourceType || null,
    installUrl: skill.installUrl || null,
    skills: 0,
    installs: 0
  };
  source.skills += 1;
  source.installs += Number(skill.installs || 0);
  sourceMap.set(key, source);
}

const sources = [...sourceMap.values()].sort((a, b) => b.installs - a.installs || a.source.localeCompare(b.source));
const generatedAt = new Date().toISOString();

await mkdir('registry', { recursive: true });
await writeFile('registry/skills.json', JSON.stringify({ generatedAt, view, total, count: normalized.length, data: normalized }, null, 2) + '\n');
await writeFile('registry/sources.json', JSON.stringify({ generatedAt, count: sources.length, data: sources }, null, 2) + '\n');
await writeFile('registry/summary.json', JSON.stringify({
  generatedAt,
  view,
  apiReportedTotal: total,
  uniqueSkills: normalized.length,
  uniqueSources: sources.length,
  note: 'Catalog metadata only. Third-party skill contents are not re-authored or automatically trusted.'
}, null, 2) + '\n');

console.log(`Synced ${normalized.length} unique skills from ${sources.length} sources (${view}).`);
