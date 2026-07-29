import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { getVercelOidcToken } from '@vercel/oidc';

const API_BASE = (process.env.SKILLS_API_BASE || 'https://skills.sh').replace(/\/$/, '');
const USER_AGENT = 'Mohammed-Skills-Universe/2.4 (+https://github.com/hypermezo4-create/guard-skills)';
const VIEWS = ['all-time', 'trending', 'hot'];
const args = process.argv.slice(2);

const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const perPage = Math.min(500, Math.max(1, Number(valueAfter('--per-page', '500'))));
const requestedView = valueAfter('--view', 'all-time');
const views = args.includes('--all-views') ? VIEWS : [requestedView];

if (views.some((view) => !VIEWS.includes(view))) {
  throw new Error(`Unsupported view. Expected one of: ${VIEWS.join(', ')}`);
}

async function getSkillsToken() {
  try {
    const token = await getVercelOidcToken({ expirationBufferMs: 5 * 60 * 1000 });
    if (token) return token;
  } catch (error) {
    if (!process.env.SKILLS_SH_TOKEN) {
      throw new Error(`Unable to obtain Vercel OIDC token: ${String(error.message || error)}`);
    }
  }

  if (process.env.SKILLS_SH_TOKEN) return process.env.SKILLS_SH_TOKEN;
  throw new Error('Missing skills.sh authentication. Configure Vercel OIDC or SKILLS_SH_TOKEN.');
}

async function fetchCatalog(view) {
  const data = [];
  let page = 0;
  let reportedTotal = null;

  while (true) {
    const url = new URL(`${API_BASE}/api/v1/skills`);
    url.searchParams.set('view', view);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const token = await getSkillsToken();
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'user-agent': USER_AGENT
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${view} page ${page}: skills.sh ${response.status}: ${body.slice(0, 700)}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.data) || !payload.pagination) {
      throw new Error(`${view} page ${page}: unexpected skills.sh response shape`);
    }

    data.push(...payload.data);
    reportedTotal = Number(payload.pagination.total ?? data.length);
    console.log(`${view}: page ${page}, ${data.length}/${reportedTotal}`);
    if (!payload.pagination.hasMore) break;
    page += 1;
  }

  const seen = new Set();
  const normalized = [];
  for (const skill of data) {
    if (!skill?.id || seen.has(skill.id)) continue;
    seen.add(skill.id);
    normalized.push({
      id: skill.id,
      slug: skill.slug || skill.name || skill.id,
      name: skill.name || skill.slug || skill.id,
      source: skill.source || 'unknown',
      sourceType: skill.sourceType || null,
      installUrl: skill.installUrl || null,
      url: skill.url || null,
      installs: Number(skill.installs || 0),
      isDuplicate: Boolean(skill.isDuplicate),
      rank: normalized.length + 1
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    view,
    reportedTotal,
    count: normalized.length,
    data: normalized
  };
}

await mkdir('registry', { recursive: true });
const results = {};
for (const view of views) {
  const result = await fetchCatalog(view);
  results[view] = result;
  await writeFile(`registry/${view}.json`, JSON.stringify(result, null, 2) + '\n');
  if (view === 'all-time') {
    await writeFile('registry/skills.json', JSON.stringify(result, null, 2) + '\n');
  }
  console.log(`Synced ${result.count} skills (${view}).`);
}

if (results['all-time']) {
  const sourceMap = new Map();
  for (const skill of results['all-time'].data) {
    const source = sourceMap.get(skill.source) || {
      source: skill.source,
      sourceType: skill.sourceType,
      installUrl: skill.installUrl,
      skills: 0,
      installs: 0
    };
    source.skills += 1;
    source.installs += skill.installs;
    sourceMap.set(skill.source, source);
  }

  const sources = [...sourceMap.values()].sort((a, b) => b.installs - a.installs || a.source.localeCompare(b.source));
  const generatedAt = new Date().toISOString();
  await writeFile('registry/sources.json', JSON.stringify({ generatedAt, count: sources.length, data: sources }, null, 2) + '\n');
  await writeFile('registry/summary.json', JSON.stringify({
    generatedAt,
    apiReportedTotal: results['all-time'].reportedTotal,
    indexedSkills: results['all-time'].count,
    uniqueSources: sources.length,
    trendingSkills: results.trending?.count ?? null,
    hotSkills: results.hot?.count ?? null,
    note: 'Catalog metadata mirrors skills.sh discovery data. Third-party authorship and trust remain upstream.'
  }, null, 2) + '\n');
}
