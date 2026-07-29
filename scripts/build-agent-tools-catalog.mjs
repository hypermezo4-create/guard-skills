import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const skillsRoot = join(root, '.agents', 'skills');
const outPath = join(root, 'imports', 'mohammed-agent-tools', 'catalog.json');

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  let active = null;
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      active = m[1];
      out[active] = m[2].trim().replace(/^['"]|['"]$/g, '');
    } else if (active && /^\s+/.test(line)) {
      out[active] = `${out[active]} ${line.trim()}`.trim();
    }
  }
  return out;
}

async function jsonOrNull(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(p));
    else if (entry.isFile()) files.push(p);
  }
  return files;
}

const dirs = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort((a, b) => a.localeCompare(b));

const data = [];
for (const slug of dirs) {
  const dir = join(skillsRoot, slug);
  let markdown;
  try { markdown = await readFile(join(dir, 'SKILL.md'), 'utf8'); } catch { continue; }
  const meta = parseFrontmatter(markdown);
  const upstream = await jsonOrNull(join(dir, '.mohammed-upstream.json')) || {};
  const files = await walk(dir);
  let byteCount = 0;
  const licenseFiles = [];
  for (const file of files) {
    const stat = await import('node:fs/promises').then(({ stat }) => stat(file));
    byteCount += stat.size;
    const base = file.split(/[\\/]/).pop();
    if (/^(license|upstream_license)/i.test(base)) licenseFiles.push(base);
  }
  data.push({
    id: `agent-tools/${slug}`,
    slug,
    name: meta.name || slug,
    description: meta.description || 'Imported Agent Skill from Mohammed AI Agent Tools.',
    source: upstream.source || 'Mohammed_AI_Agent_Tools upload',
    sourceUrl: upstream.source_url || null,
    sourcePath: upstream.source_path || null,
    license: upstream.license || null,
    licenseFiles: [...new Set(licenseFiles)].sort(),
    fileCount: files.length,
    byteCount,
    group: 'Imported Agent Tools',
    imported: true,
    reviewed: false,
    repoPath: `.agents/skills/${slug}`
  });
}

if (data.length !== 358) throw new Error(`Expected 358 imported skills, found ${data.length}`);
const payload = {
  schema: 'mohammed-skills-universe/imported-agent-tools-v1',
  generatedAt: new Date().toISOString(),
  count: data.length,
  payloadFiles: data.reduce((n, x) => n + x.fileCount, 0),
  materializedRoot: '.agents/skills',
  bundleSha256: '6d0594d7b57d98afc1907a9c00f25975f9ea58f2c8e995d6c8d2465f9c03aec8',
  data
};
await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Imported Agent Tools catalog built: ${payload.count} skills, ${payload.payloadFiles} files.`);
