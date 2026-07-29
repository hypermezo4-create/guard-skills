import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const argv = process.argv.slice(2);
const forceIndex = argv.indexOf('--force');
const force = forceIndex >= 0;
if (force) argv.splice(forceIndex, 1);

const query = argv.shift();
if (!query) {
  console.error('Usage: npm run install:vendored -- <skill-id|slug|name> [--force] [skills CLI options]');
  process.exit(2);
}

const manifestPath = join(process.cwd(), 'vendor', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const needle = query.toLowerCase();
const matches = (manifest.data || []).filter((entry) =>
  [entry.id, entry.slug, entry.name].some((value) => String(value || '').toLowerCase() === needle)
);

if (matches.length === 0) {
  console.error(`No vendored skill matched: ${query}`);
  process.exit(3);
}
if (matches.length > 1) {
  console.error(`Ambiguous skill '${query}'. Use the full id:\n${matches.map((m) => `  - ${m.id}`).join('\n')}`);
  process.exit(4);
}

const skill = matches[0];
if (!skill.mirrored) {
  console.error(`${skill.id} is known but its full snapshot is unavailable.`);
  process.exit(5);
}
if (skill.installPolicy === 'blocked-by-default' && !force) {
  console.error(`${skill.id} is blocked by default by the mirror safety policy.`);
  console.error('Inspect vendor metadata/audits first. Re-run with --force only after deliberate review.');
  process.exit(6);
}

const sourceParts = String(skill.source).split('/').map((segment) =>
  segment.normalize('NFKC').trim().replace(/[^a-zA-Z0-9._-]/g, (c) => `_x${c.codePointAt(0).toString(16)}_`)
);
const safeSlug = String(skill.slug).normalize('NFKC').trim().replace(/[^a-zA-Z0-9._-]/g, (c) => `_x${c.codePointAt(0).toString(16)}_`);
const localPath = resolve(process.cwd(), 'vendor', 'skills', ...sourceParts, safeSlug);

console.log(`Installing vendored snapshot: ${skill.id}`);
console.log(`Upstream hash: ${skill.upstreamHash || 'unknown'}`);
console.log(`Local hash:    ${skill.localHash || 'unknown'}`);
console.log(`Policy:        ${skill.installPolicy || 'review-before-use'}`);

const result = spawnSync('npx', ['skills', 'add', localPath, '--yes', ...argv], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
