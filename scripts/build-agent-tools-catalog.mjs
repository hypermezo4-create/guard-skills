import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

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
  const imported = await jsonOrNull(join(dir, '.mohammed-import.json'));
  const upstream = await jsonOrNull(join(dir, '.mohammed-upstream.json'));
  const vendor = await jsonOrNull(join(dir, '.vendor-origin.json'));
  const origin = imported || upstream || vendor || {};
  const files = await walk(dir);
  let byteCount = 0;
  const licenseFiles = [];
  const contentHash = createHash('sha256');
  for (const file of [...files].sort()) {
    const info = await stat(file);
    byteCount += info.size;
    const base = basename(file);
    if (/^(license|upstream_license)/i.test(base)) licenseFiles.push(base);
    contentHash.update(relative(dir, file).replaceAll('\\', '/'));
    contentHash.update('\0');
    contentHash.update(await readFile(file));
    contentHash.update('\0');
  }

  const sourceUrl = origin.sourceUrl || origin.source_url || null;
  const sourcePath = origin.sourcePath || origin.source_path || null;
  const source = origin.source || (sourceUrl ? sourceUrl.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '') : 'Mohammed_AI_Agent_Tools upload');
  const isCustom = slug.startsWith('mohammed-') && !sourceUrl;

  data.push({
    id: `agent-tools/${slug}`,
    slug,
    name: meta.name || slug,
    description: meta.description || 'Imported Agent Skill from Mohammed AI Agent Tools.',
    source,
    sourceUrl,
    sourcePath,
    resolvedCommit: origin.resolvedCommit || origin.commit || null,
    license: origin.license || null,
    licenseFiles: [...new Set(licenseFiles)].sort(),
    fileCount: files.length,
    byteCount,
    contentSha256: contentHash.digest('hex'),
    group: isCustom ? 'Mohammed Agent Tools' : 'Imported Upstream',
    imported: true,
    custom: isCustom,
    reviewed: false,
    repoPath: `.agents/skills/${slug}`
  });
}

if (data.length !== 358) throw new Error(`Expected 358 imported skills, found ${data.length}`);
const payload = {
  schema: 'mohammed-skills-universe/imported-agent-tools-v2',
  generatedAt: new Date().toISOString(),
  count: data.length,
  customCount: data.filter((x) => x.custom).length,
  upstreamCount: data.filter((x) => !x.custom).length,
  payloadFiles: data.reduce((n, x) => n + x.fileCount, 0),
  payloadBytes: data.reduce((n, x) => n + x.byteCount, 0),
  materializedRoot: '.agents/skills',
  importMode: '144 custom skills from SHA-256 verified bundle + 214 skills materialized from provenance-preserving upstream Git sources',
  data
};
await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Imported Agent Tools catalog built: ${payload.count} skills (${payload.customCount} custom + ${payload.upstreamCount} upstream), ${payload.payloadFiles} files.`);
