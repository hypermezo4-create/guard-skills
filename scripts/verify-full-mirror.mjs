import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const vendorRoot = join(root, 'vendor');
const manifest = JSON.parse(await readFile(join(vendorRoot, 'manifest.json'), 'utf8'));
const summary = JSON.parse(await readFile(join(vendorRoot, 'summary.json'), 'utf8'));
const failures = JSON.parse(await readFile(join(vendorRoot, 'failures.json'), 'utf8'));

function dirFor(entry) {
  if (!entry.localPath) throw new Error('missing localPath');
  const parts = String(entry.localPath).split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`unsafe localPath: ${entry.localPath}`);
  return join(vendorRoot, ...parts);
}

async function collectFiles(dir, base = dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    if (name === '.upstream.json') continue;
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) out.push(...await collectFiles(path, base));
    else out.push({ path: relative(base, path).replaceAll('\\', '/'), contents: await readFile(path, 'utf8') });
  }
  return out;
}

function hashFiles(files) {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.contents);
    hash.update('\0');
  }
  return hash.digest('hex');
}

const errors = [];
if (!Number.isInteger(manifest.count) || manifest.count !== manifest.data?.length) {
  errors.push(`manifest count mismatch: declared ${manifest.count}, actual ${manifest.data?.length ?? 0}`);
}
if (summary.apiReportedTotal != null && manifest.count !== summary.apiReportedTotal) {
  errors.push(`catalog completeness mismatch: manifest ${manifest.count}, API total ${summary.apiReportedTotal}`);
}
if (failures.count !== 0) errors.push(`${failures.count} mirror failures remain`);
if (summary.unavailable !== 0) errors.push(`${summary.unavailable} skills have no snapshot`);

const seenIds = new Set();
const seenPaths = new Set();
for (const entry of manifest.data || []) {
  if (seenIds.has(entry.id)) errors.push(`${entry.id}: duplicate manifest id`);
  seenIds.add(entry.id);

  if (!entry.localPath) {
    errors.push(`${entry.id}: missing localPath`);
  } else if (seenPaths.has(entry.localPath)) {
    errors.push(`${entry.id}: localPath collision at ${entry.localPath}`);
  } else {
    seenPaths.add(entry.localPath);
  }
}

let verified = 0;
for (const entry of manifest.data || []) {
  if (!entry.mirrored) {
    errors.push(`${entry.id}: not mirrored (${entry.status || 'unknown'})`);
    continue;
  }

  try {
    const dir = dirFor(entry);
    const files = await collectFiles(dir);
    if (!files.some((file) => file.path === 'SKILL.md')) errors.push(`${entry.id}: missing SKILL.md`);
    if (!entry.upstreamHash) errors.push(`${entry.id}: missing upstream hash`);

    const localHash = hashFiles(files);
    if (entry.localHash !== localHash) errors.push(`${entry.id}: local hash mismatch`);

    const metadata = JSON.parse(await readFile(join(dir, '.upstream.json'), 'utf8'));
    if (
      metadata.id !== entry.id
      || metadata.localHash !== entry.localHash
      || metadata.upstreamHash !== entry.upstreamHash
      || metadata.localPath !== entry.localPath
    ) {
      errors.push(`${entry.id}: metadata mismatch`);
    }
    verified += 1;
  } catch (error) {
    errors.push(`${entry.id}: ${String(error.message || error)}`);
  }
}

console.log(`Verified ${verified}/${manifest.count} vendored skills.`);
if (errors.length) {
  console.error(`Full mirror verification FAILED with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  if (errors.length > 100) console.error(`- ... ${errors.length - 100} more`);
  process.exit(1);
}

console.log('Full mirror verification PASSED: catalog parity, unique snapshot paths, SKILL.md files, provenance metadata, upstream hashes, and local hashes are complete.');
