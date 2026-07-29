import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const json = args.includes('--json');
const includeBlocked = args.includes('--include-blocked');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(200, Number(limitArg?.split('=')[1] || 25)));
const query = args.filter((arg) => !arg.startsWith('--')).join(' ').trim().toLowerCase();

if (!query) {
  console.error('Usage: npm run find:vendored -- <query> [--limit=25] [--include-blocked] [--json]');
  process.exit(2);
}

const manifest = JSON.parse(await readFile(join(process.cwd(), 'vendor', 'manifest.json'), 'utf8'));
const terms = query.split(/\s+/).filter(Boolean);

function score(entry) {
  const name = String(entry.name || '').toLowerCase();
  const slug = String(entry.slug || '').toLowerCase();
  const id = String(entry.id || '').toLowerCase();
  const source = String(entry.source || '').toLowerCase();
  let value = 0;
  if (name === query || slug === query || id === query) value += 1000;
  if (name.includes(query) || slug.includes(query)) value += 350;
  if (id.includes(query)) value += 220;
  if (source.includes(query)) value += 120;
  for (const term of terms) {
    if (name.includes(term)) value += 80;
    if (slug.includes(term)) value += 70;
    if (id.includes(term)) value += 40;
  }
  value += Math.log10(Number(entry.installs || 0) + 1) * 5;
  if (entry.sourceType === 'github') value += 2;
  if (entry.isDuplicate) value -= 20;
  if (entry.installPolicy === 'blocked-by-default') value -= 100;
  return value;
}

const results = (manifest.data || [])
  .filter((entry) => entry.mirrored)
  .filter((entry) => includeBlocked || entry.installPolicy !== 'blocked-by-default')
  .map((entry) => ({ entry, score: score(entry) }))
  .filter((item) => item.score > 0)
  .sort((a, b) => b.score - a.score || Number(b.entry.installs || 0) - Number(a.entry.installs || 0))
  .slice(0, limit)
  .map(({ entry, score: rankScore }) => ({
    id: entry.id,
    name: entry.name,
    source: entry.source,
    installs: entry.installs,
    policy: entry.installPolicy,
    duplicate: entry.isDuplicate,
    upstreamHash: entry.upstreamHash,
    rankScore: Number(rankScore.toFixed(2))
  }));

if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const result of results) {
    console.log(`${result.id} | installs=${result.installs} | policy=${result.policy}${result.duplicate ? ' | duplicate' : ''}`);
  }
}
