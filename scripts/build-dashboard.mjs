import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const skillsRoot = join(root, 'skills');
const distRoot = join(root, 'dist');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1].split('\n');
  const out = {};
  let key = null;
  for (const line of lines) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) {
      key = field[1];
      out[key] = field[2] === '>-' ? '' : field[2].trim().replace(/^['"]|['"]$/g, '');
      continue;
    }
    if (key && /^\s+/.test(line)) out[key] = `${out[key]} ${line.trim()}`.trim();
  }
  return out;
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const dirs = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const skills = [];
for (const dir of dirs) {
  try {
    const markdown = await readFile(join(skillsRoot, dir, 'SKILL.md'), 'utf8');
    const meta = parseFrontmatter(markdown);
    skills.push({
      slug: dir,
      name: meta.name || dir,
      description: meta.description || 'Agent skill available in Mohammed Skills Universe.',
      group: dir.endsWith('-delegate') ? 'Delegate' : dir.includes('guard') ? 'Guard' : 'Core'
    });
  } catch {
    // Only directories with a readable SKILL.md are exposed on the dashboard.
  }
}

const summary = await readJson(join(root, 'vendor', 'summary.json'));
const manifest = await readJson(join(root, 'vendor', 'manifest.json'));
const packageJson = await readJson(join(root, 'package.json'), {});

const mirrorCount = Number(summary?.mirroredEntries ?? manifest?.count ?? 0);
const mirrorTotal = Number(summary?.apiReportedTotal ?? manifest?.reportedTotal ?? 0);
const mirrorReady = mirrorCount > 0 && mirrorTotal > 0 && mirrorCount === mirrorTotal && Number(summary?.failures || 0) === 0 && Number(summary?.unavailable || 0) === 0;
const delegateCount = skills.filter((skill) => skill.group === 'Delegate').length;
const guardCount = skills.filter((skill) => skill.group === 'Guard').length;

const cards = skills.map((skill) => `
  <article class="skill-card" data-group="${escapeHtml(skill.group)}">
    <div class="skill-topline"><span class="pill">${escapeHtml(skill.group)}</span><code>${escapeHtml(skill.slug)}</code></div>
    <h3>${escapeHtml(skill.name)}</h3>
    <p>${escapeHtml(skill.description)}</p>
    <button type="button" class="copy" data-command="npx skills add hypermezo4-create/guard-skills --skill ${escapeHtml(skill.slug)}">Copy install command</button>
  </article>`).join('');

const mirrorLabel = mirrorReady
  ? `${mirrorCount.toLocaleString('en-US')} / ${mirrorTotal.toLocaleString('en-US')} verified`
  : mirrorTotal > 0
    ? `${mirrorCount.toLocaleString('en-US')} / ${mirrorTotal.toLocaleString('en-US')} mirrored`
    : 'First full mirror pending';

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#09090b">
  <meta name="description" content="Mohammed Skills Universe — curated Agent Skills, delegation, routing, safety, and provenance.">
  <title>Mohammed Skills Universe</title>
  <style>
    :root{color-scheme:dark;--bg:#09090b;--panel:#111114;--panel2:#17171c;--text:#f5f5f5;--muted:#a1a1aa;--line:#27272a;--accent:#d4af37;--accent2:#f6e7a3;--ok:#5ee6a8}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#25200f 0,transparent 35%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}.shell{width:min(1180px,calc(100% - 32px));margin:auto}.nav{height:72px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font-weight:800;letter-spacing:-.02em}.brand span{color:var(--accent)}.navlinks{display:flex;gap:10px}.nav a,.button{border:1px solid var(--line);padding:10px 14px;border-radius:12px;color:#e4e4e7;background:#111114}.hero{padding:92px 0 58px}.eyebrow{display:inline-flex;gap:8px;align-items:center;border:1px solid #4a401e;background:#17140b;color:var(--accent2);padding:7px 11px;border-radius:999px;font-size:13px}.hero h1{font-size:clamp(44px,8vw,88px);line-height:.96;letter-spacing:-.055em;margin:22px 0;max-width:920px}.hero h1 em{font-style:normal;color:var(--accent)}.hero p{max-width:760px;color:var(--muted);font-size:19px;line-height:1.65}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.button.primary{background:linear-gradient(135deg,var(--accent2),var(--accent));color:#15130b;border:0;font-weight:800}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0 70px}.stat{background:linear-gradient(180deg,#141418,#0e0e11);border:1px solid var(--line);border-radius:18px;padding:22px}.stat strong{font-size:30px;display:block}.stat span{color:var(--muted);font-size:13px}.section-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:22px}.section-head h2{font-size:34px;margin:0;letter-spacing:-.035em}.section-head p{color:var(--muted);margin:0}.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}.filter{background:#111114;border:1px solid var(--line);color:#d4d4d8;border-radius:999px;padding:8px 12px;cursor:pointer}.filter.active{border-color:#6d5d25;color:var(--accent2)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding-bottom:70px}.skill-card{background:linear-gradient(145deg,#141418,#0e0e11);border:1px solid var(--line);border-radius:20px;padding:22px;min-height:220px;display:flex;flex-direction:column}.skill-topline{display:flex;align-items:center;justify-content:space-between;gap:12px}.skill-topline code{font-size:12px;color:#71717a;overflow:hidden;text-overflow:ellipsis}.pill{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent2)}.skill-card h3{margin:22px 0 10px;font-size:22px}.skill-card p{color:var(--muted);line-height:1.55;margin:0 0 20px}.copy{margin-top:auto;align-self:start;border:1px solid var(--line);background:#0b0b0d;color:#e4e4e7;border-radius:10px;padding:9px 12px;cursor:pointer}.copy:hover{border-color:#625523}.mirror{border:1px solid #36311e;background:linear-gradient(145deg,#17150e,#101012);border-radius:22px;padding:26px;margin-bottom:70px;display:flex;justify-content:space-between;align-items:center;gap:20px}.mirror h2{margin:0 0 8px}.mirror p{margin:0;color:var(--muted)}.status{white-space:nowrap;border:1px solid #4c431e;border-radius:999px;padding:9px 12px;color:var(--accent2)}footer{border-top:1px solid var(--line);padding:28px 0 50px;color:#71717a;font-size:14px}@media(max-width:760px){.navlinks a:nth-child(1){display:none}.hero{padding-top:64px}.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.mirror{align-items:flex-start;flex-direction:column}.section-head{align-items:start;flex-direction:column}} 
  </style>
</head>
<body>
  <header class="shell nav">
    <div class="brand">Mohammed <span>Skills Universe</span></div>
    <nav class="navlinks"><a href="https://github.com/hypermezo4-create/guard-skills">GitHub</a><a href="https://skills.sh/hypermezo4-create/guard-skills">skills.sh</a></nav>
  </header>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">● Live skill hub · v${escapeHtml(packageJson.version || '2.x')}</div>
      <h1>One universe for <em>Agent Skills.</em></h1>
      <p>Curated local skills, multi-agent delegation, routing, auditing, provenance, and a guarded full skills.sh mirror — maintained as one installable skill hub.</p>
      <div class="hero-actions"><button class="button primary copy" data-command="npx skills add hypermezo4-create/guard-skills">Copy install command</button><a class="button" href="#skills">Browse skills</a></div>
    </section>

    <section class="stats" aria-label="Project statistics">
      <div class="stat"><strong>${skills.length}</strong><span>Local skills</span></div>
      <div class="stat"><strong>${delegateCount}</strong><span>Delegate skills</span></div>
      <div class="stat"><strong>${guardCount}</strong><span>Guard skills</span></div>
      <div class="stat"><strong>${mirrorCount.toLocaleString('en-US')}</strong><span>Vendored snapshots</span></div>
    </section>

    <section class="mirror">
      <div><h2>Full mirror status</h2><p>Strict verification requires catalog parity, zero failures, complete snapshots, and matching hashes.</p></div>
      <div class="status">${escapeHtml(mirrorLabel)}</div>
    </section>

    <section id="skills">
      <div class="section-head"><div><h2>Local skill pack</h2><p>Only reviewed repository-local skills are listed here.</p></div></div>
      <div class="filters"><button class="filter active" data-filter="All">All</button><button class="filter" data-filter="Delegate">Delegate</button><button class="filter" data-filter="Guard">Guard</button><button class="filter" data-filter="Core">Core</button></div>
      <div class="grid">${cards}</div>
    </section>
  </main>
  <footer><div class="shell">Mohammed Skills Universe · third-party skills retain upstream authorship and licenses.</div></footer>
  <script>
    document.querySelectorAll('.copy').forEach((button)=>button.addEventListener('click',async()=>{const text=button.dataset.command;try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1300)}catch{window.prompt('Copy command:',text)}}));
    document.querySelectorAll('.filter').forEach((button)=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach((b)=>b.classList.remove('active'));button.classList.add('active');const filter=button.dataset.filter;document.querySelectorAll('.skill-card').forEach((card)=>{card.hidden=filter!=='All'&&card.dataset.group!==filter})}));
  </script>
</body>
</html>`;

await mkdir(distRoot, { recursive: true });
await writeFile(join(distRoot, 'index.html'), html, 'utf8');
await writeFile(join(distRoot, '404.html'), html, 'utf8');
console.log(`Dashboard built with ${skills.length} local skills. Mirror: ${mirrorLabel}.`);
