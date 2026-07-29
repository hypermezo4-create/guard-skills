import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const skillsRoot = join(root, 'skills');
const registryRoot = join(root, 'registry');
const distRoot = join(root, 'dist');
const dataRoot = join(distRoot, 'data');

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  let key = null;
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) {
      key = field[1];
      out[key] = field[2] === '>-' ? '' : field[2].trim().replace(/^['"]|['"]$/g, '');
    } else if (key && /^\s+/.test(line)) {
      out[key] = `${out[key]} ${line.trim()}`.trim();
    }
  }
  return out;
}

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

const dirs = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const localSkills = [];
for (const dir of dirs) {
  try {
    const markdown = await readFile(join(skillsRoot, dir, 'SKILL.md'), 'utf8');
    const meta = parseFrontmatter(markdown);
    localSkills.push({
      id: `local/${dir}`,
      slug: dir,
      name: meta.name || dir,
      description: meta.description || 'Agent skill available in Mohammed Skills Universe.',
      source: 'hypermezo4-create/guard-skills',
      sourceType: 'github',
      installs: 0,
      group: dir.endsWith('-delegate') ? 'Delegate' : dir.includes('guard') ? 'Guard' : 'Core',
      local: true
    });
  } catch {}
}

const packageJson = await readJson(join(root, 'package.json'), {});
const catalogSummary = await readJson(join(registryRoot, 'summary.json'));
const mirrorSummary = await readJson(join(root, 'vendor', 'summary.json'));
const mirrorManifest = await readJson(join(root, 'vendor', 'manifest.json'));
const mirrorCount = Number(mirrorSummary?.mirroredEntries ?? mirrorManifest?.count ?? 0);
const mirrorTotal = Number(mirrorSummary?.apiReportedTotal ?? mirrorManifest?.reportedTotal ?? 0);
const mirrorReady = mirrorCount > 0 && mirrorTotal > 0 && mirrorCount === mirrorTotal && Number(mirrorSummary?.failures || 0) === 0 && Number(mirrorSummary?.unavailable || 0) === 0;

await mkdir(dataRoot, { recursive: true });
await writeFile(join(dataRoot, 'local.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: localSkills.length, data: localSkills }, null, 2) + '\n');
for (const name of ['all-time', 'trending', 'hot', 'sources', 'summary']) {
  try { await copyFile(join(registryRoot, `${name}.json`), join(dataRoot, `${name}.json`)); } catch {}
}

const bootstrap = JSON.stringify({
  version: packageJson.version || '2.x',
  localCount: localSkills.length,
  catalogCount: Number(catalogSummary?.indexedSkills || catalogSummary?.apiReportedTotal || 0),
  sourceCount: Number(catalogSummary?.uniqueSources || 0),
  mirrorCount,
  mirrorTotal,
  mirrorReady,
  localSkills
}).replaceAll('<', '\\u003c');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080808">
<meta name="description" content="Mohammed Skills Universe — discover, install, delegate, audit, and mirror Agent Skills.">
<title>Mohammed Skills Universe</title>
<style>
:root{color-scheme:dark;--bg:#080808;--panel:#0d0d0d;--panel2:#111;--text:#f3f0e7;--muted:#918f88;--faint:#55534e;--line:#24231f;--gold:#d8b85a;--gold2:#f1df9a;--green:#68d391;--hot:#ff775f}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(800px 360px at 50% -100px,rgba(216,184,90,.09),transparent 70%),linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:auto,48px 48px,48px 48px;mask-image:linear-gradient(to bottom,#000,transparent 70%)}a{color:inherit;text-decoration:none}button,input{font:inherit}.wrap{width:min(1160px,calc(100% - 32px));margin:auto}.topbar{height:68px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:relative;z-index:5}.logo{display:flex;align-items:center;gap:11px;font-weight:760;letter-spacing:-.02em}.mark{width:30px;height:30px;border:1px solid #5b4d25;border-radius:8px;display:grid;place-items:center;color:var(--gold2);font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:inset 0 0 20px rgba(216,184,90,.08)}.nav{display:flex;gap:22px;color:#a8a69f;font-size:14px}.nav a:hover{color:var(--text)}.hero{padding:76px 0 54px;text-align:center;position:relative}.ascii{white-space:pre;font:700 clamp(7px,1.15vw,13px)/1.05 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d7d3c7;letter-spacing:-.08em;margin:0 auto 24px;display:inline-block;text-align:left;opacity:.95}.kicker{color:var(--gold2);font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.16em}.hero h1{font-size:clamp(38px,6vw,68px);letter-spacing:-.055em;line-height:1;margin:13px auto 18px;max-width:820px}.hero p{color:var(--muted);font-size:17px;line-height:1.7;max-width:700px;margin:auto}.terminal{max-width:670px;margin:30px auto 0;border:1px solid #302c20;background:#0b0b09;border-radius:12px;display:flex;align-items:center;padding:7px 7px 7px 15px;box-shadow:0 28px 80px rgba(0,0,0,.32)}.prompt{color:var(--gold);font:500 14px ui-monospace,SFMono-Regular,Menlo,monospace;margin-right:8px}.command{flex:1;text-align:left;color:#d7d4ca;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;white-space:nowrap}.copycmd{border:1px solid #363229;background:#15130d;color:#d9cb9d;border-radius:8px;padding:9px 12px;cursor:pointer}.copycmd:hover{border-color:#6d5c2b}.agents{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin-top:22px}.agent{border:1px solid var(--line);border-radius:999px;padding:6px 10px;color:#7f7d77;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:18px 0 54px;background:#0a0a0a}.metric{padding:21px 22px;border-right:1px solid var(--line);text-align:left}.metric:last-child{border-right:0}.metric strong{display:block;font-size:24px;letter-spacing:-.04em}.metric span{display:block;color:var(--faint);font-size:12px;margin-top:3px}.leader{border-top:1px solid var(--line);padding:46px 0 80px}.leader-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:22px}.leader-head h2{font-size:28px;letter-spacing:-.04em;margin:0}.leader-head p{margin:7px 0 0;color:var(--muted);font-size:14px}.statusline{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#77746c}.controls{display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:16px}.searchbox{position:relative}.searchbox:before{content:"/";position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#57554f;font:14px ui-monospace,SFMono-Regular,Menlo,monospace}.search{width:100%;height:46px;border:1px solid var(--line);background:#0d0d0d;color:var(--text);border-radius:10px;padding:0 14px 0 34px;outline:none}.search:focus{border-color:#6a592a;box-shadow:0 0 0 3px rgba(216,184,90,.06)}.tabs{display:flex;border:1px solid var(--line);border-radius:10px;padding:3px;background:#0d0d0d}.tab{border:0;background:transparent;color:#77756f;padding:0 14px;border-radius:7px;cursor:pointer;font-size:12px;white-space:nowrap}.tab.active{background:#1a1811;color:var(--gold2)}.table{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#0a0a0a}.row{min-height:64px;display:grid;grid-template-columns:56px minmax(210px,1fr) minmax(170px,.7fr) 120px 118px;align-items:center;border-bottom:1px solid #1d1c19;padding:0 14px;transition:background .15s}.row:last-child{border-bottom:0}.row:not(.heading):hover{background:#10100e}.heading{min-height:42px;color:#595751;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.1em}.rank{color:#6f6d67;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.skillname{min-width:0}.skillname strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skillname small{display:none;color:#605e58;margin-top:3px}.source{color:#85827a;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.installs{text-align:right;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8c3b4}.action{text-align:right}.install{border:1px solid #2e2c26;background:#10100e;color:#a5a197;border-radius:7px;padding:7px 9px;cursor:pointer;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.install:hover{color:var(--gold2);border-color:#5b4e28}.localbadge{display:inline-block;margin-left:7px;color:var(--gold2);font:9px ui-monospace,SFMono-Regular,Menlo,monospace;border:1px solid #514623;padding:2px 5px;border-radius:999px;vertical-align:2px}.empty{padding:42px;text-align:center;color:#68665f}.more{display:block;margin:16px auto 0;border:1px solid var(--line);background:#0d0d0d;color:#8b8982;border-radius:9px;padding:10px 18px;cursor:pointer}.more:hover{border-color:#544a2d;color:#d5ccb0}.trust{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-top:24px}.trustbox{border:1px solid var(--line);border-radius:12px;padding:20px;background:#0b0b0b}.trustbox h3{margin:0 0 8px;font-size:15px}.trustbox p{margin:0;color:#77756e;line-height:1.6;font-size:13px}.mirrorstate{color:var(--gold2)}footer{border-top:1px solid var(--line);padding:28px 0 44px;color:#55534e;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;justify-content:space-between;gap:20px}@media(max-width:820px){.nav a:not(:last-child){display:none}.metrics{grid-template-columns:repeat(2,1fr)}.metric:nth-child(2){border-right:0}.metric:nth-child(-n+2){border-bottom:1px solid var(--line)}.controls{grid-template-columns:1fr}.tabs{height:42px;overflow:auto}.tab{flex:1}.row{grid-template-columns:40px minmax(0,1fr) 88px 82px}.source{display:none}.leader-head{align-items:start;flex-direction:column}.trust{grid-template-columns:1fr}.ascii{font-size:7px}.hero{padding-top:56px}}@media(max-width:520px){.wrap{width:min(100% - 20px,1160px)}.hero h1{font-size:40px}.terminal{padding-left:10px}.command{font-size:11px}.metrics{margin-bottom:40px}.metric{padding:17px 14px}.row{padding:0 8px;grid-template-columns:30px minmax(0,1fr) 66px 68px}.installs{font-size:10px}.install{padding:6px;font-size:9px}.heading{font-size:8px}.skillname strong{font-size:12px}}
</style>
</head>
<body>
<header class="wrap topbar"><a class="logo" href="/"><span class="mark">MSU</span><span>Mohammed Skills Universe</span></a><nav class="nav"><a href="#leaderboard">Leaderboard</a><a href="https://skills.sh/topic">Topics</a><a href="https://github.com/hypermezo4-create/guard-skills">GitHub ↗</a></nav></header>
<main>
<section class="wrap hero">
<div class="ascii">███╗   ███╗███████╗██╗   ██╗\n████╗ ████║██╔════╝██║   ██║\n██╔████╔██║███████╗██║   ██║\n██║╚██╔╝██║╚════██║██║   ██║\n██║ ╚═╝ ██║███████║╚██████╔╝\n╚═╝     ╚═╝╚══════╝ ╚═════╝</div>
<div class="kicker">The curated agent skills universe · v${packageJson.version || '2.x'}</div>
<h1>Give your agents better instincts.</h1>
<p>Discover the skills.sh ecosystem, install Mohammed's reviewed guard and delegate pack, and keep third-party knowledge behind provenance and safety checks.</p>
<div class="terminal"><span class="prompt">$</span><span class="command">npx skills add hypermezo4-create/guard-skills</span><button class="copycmd" data-copy="npx skills add hypermezo4-create/guard-skills">copy</button></div>
<div class="agents"><span class="agent">Codex</span><span class="agent">Claude Code</span><span class="agent">Cursor</span><span class="agent">GitHub Copilot</span><span class="agent">Windsurf</span><span class="agent">Gemini</span><span class="agent">Antigravity</span></div>
</section>
<section class="wrap metrics"><div class="metric"><strong id="catalogMetric">${Number(catalogSummary?.indexedSkills || 0).toLocaleString('en-US')}</strong><span>ecosystem skills indexed</span></div><div class="metric"><strong>${localSkills.length}</strong><span>reviewed local skills</span></div><div class="metric"><strong id="sourceMetric">${Number(catalogSummary?.uniqueSources || 0).toLocaleString('en-US')}</strong><span>upstream sources</span></div><div class="metric"><strong>${mirrorCount.toLocaleString('en-US')}</strong><span>full snapshots mirrored</span></div></section>
<section id="leaderboard" class="leader"><div class="wrap">
<div class="leader-head"><div><h2>Skills Leaderboard</h2><p>Search the ecosystem or switch to Mohammed Pack for the reviewed local set.</p></div><div id="syncStatus" class="statusline">catalog ${catalogSummary?.generatedAt ? 'synced' : 'sync pending'}</div></div>
<div class="controls"><div class="searchbox"><input id="search" class="search" autocomplete="off" placeholder="Search skills, sources, capabilities..."></div><div class="tabs"><button class="tab active" data-view="all-time">All Time</button><button class="tab" data-view="trending">Trending 24h</button><button class="tab" data-view="hot">Hot</button><button class="tab" data-view="local">Mohammed Pack</button></div></div>
<div class="table"><div class="row heading"><div>#</div><div>Skill</div><div>Source</div><div style="text-align:right">Installs</div><div></div></div><div id="rows"></div></div><button id="more" class="more" hidden>Load more</button>
<div class="trust"><div class="trustbox"><h3>Mirror everything. Trust narrowly.</h3><p>The public catalog is discovery metadata. Executable third-party snapshots stay separated from the reviewed local pack and are only called complete after strict parity, hash, and failure checks.</p></div><div class="trustbox"><h3>Full mirror</h3><p class="mirrorstate">${mirrorReady ? `${mirrorCount.toLocaleString('en-US')} / ${mirrorTotal.toLocaleString('en-US')} verified` : mirrorTotal ? `${mirrorCount.toLocaleString('en-US')} / ${mirrorTotal.toLocaleString('en-US')} in progress` : 'First strict file mirror pending.'}</p></div></div>
</div></section>
</main>
<footer class="wrap"><span>Mohammed Skills Universe · maintained by Mohammed-MEZO</span><span>Third-party authorship & licenses stay upstream.</span></footer>
<script>window.MSU=${bootstrap};</script>
<script>
const state={view:'all-time',data:[],query:'',visible:50};const rows=document.getElementById('rows');const more=document.getElementById('more');const search=document.getElementById('search');
const fmt=n=>new Intl.NumberFormat('en-US',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function installCommand(skill){if(skill.local)return 'npx skills add hypermezo4-create/guard-skills --skill '+skill.slug;const source=skill.installUrl||skill.source;return 'npx skills add '+source+' --skill '+skill.slug}
function skillUrl(skill){if(skill.local)return 'https://github.com/hypermezo4-create/guard-skills/tree/harden-clean-code-guard/skills/'+encodeURIComponent(skill.slug);if(skill.url)return skill.url.startsWith('http')?skill.url:'https://skills.sh'+skill.url;return 'https://skills.sh/'+skill.source+'/'+skill.slug}
function filtered(){const q=state.query.trim().toLowerCase();if(!q)return state.data;return state.data.filter(s=>[s.name,s.slug,s.source,s.description,s.group].some(v=>String(v||'').toLowerCase().includes(q)))}
function render(){const data=filtered();const shown=data.slice(0,state.visible);rows.innerHTML=shown.length?shown.map((s,i)=>'<div class="row"><div class="rank">'+String(i+1).padStart(2,'0')+'</div><div class="skillname"><a href="'+esc(skillUrl(s))+'" target="_blank" rel="noopener"><strong>'+esc(s.name||s.slug)+(s.local?'<span class="localbadge">REVIEWED</span>':'')+'</strong></a></div><div class="source">'+esc(s.source)+'</div><div class="installs">'+(s.local?'local':fmt(s.installs))+'</div><div class="action"><button class="install" data-install="'+esc(installCommand(s))+'">install</button></div></div>').join(''):'<div class="empty">No skills matched this search.</div>';more.hidden=data.length<=state.visible;document.querySelectorAll('[data-install]').forEach(b=>b.onclick=()=>copy(b,b.dataset.install));}
async function copy(button,text){try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='copied';setTimeout(()=>button.textContent=old,1100)}catch{window.prompt('Copy command:',text)}}
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(b,b.dataset.copy));
async function load(view){state.view=view;state.visible=50;state.query='';search.value='';if(view==='local'){state.data=window.MSU.localSkills.map((s,i)=>({...s,rank:i+1}));render();return}rows.innerHTML='<div class="empty">Loading '+view+'…</div>';try{const res=await fetch('/data/'+view+'.json',{cache:'no-cache'});if(!res.ok)throw new Error('catalog not synced');const payload=await res.json();state.data=payload.data||[];if(view==='all-time'){document.getElementById('catalogMetric').textContent=fmt(payload.reportedTotal||payload.count)}render()}catch{state.data=[];rows.innerHTML='<div class="empty">Catalog sync is pending. Mohammed Pack is available now.</div>';more.hidden=true}}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');load(b.dataset.view)});search.oninput=()=>{state.query=search.value;state.visible=50;render()};more.onclick=()=>{state.visible+=50;render()};load('all-time');
</script>
</body></html>`;

await mkdir(distRoot, { recursive: true });
await writeFile(join(distRoot, 'index.html'), html, 'utf8');
await writeFile(join(distRoot, '404.html'), html, 'utf8');
console.log(`Dashboard built: ${localSkills.length} local skills, ${Number(catalogSummary?.indexedSkills || 0)} catalog skills, mirror ${mirrorCount}/${mirrorTotal || '?'}.`);
