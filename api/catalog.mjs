import { getVercelOidcToken } from '@vercel/oidc';

export const maxDuration = 60;

const ALLOWED_VIEWS = new Set(['all-time', 'trending', 'hot']);
const API_BASE = 'https://skills.sh';

export default async function handler(request, response) {
  const requestUrl = new URL(request.url, 'https://mohammed-skills-universe.vercel.app');
  const view = requestUrl.searchParams.get('view') || 'all-time';
  if (!ALLOWED_VIEWS.has(view)) {
    response.status(400).json({ error: 'invalid_view' });
    return;
  }

  try {
    const skills = [];
    let page = 0;
    let reportedTotal = 0;

    while (true) {
      const token = await getVercelOidcToken({ expirationBufferMs: 5 * 60 * 1000 });
      if (!token) throw new Error('Vercel OIDC token unavailable');

      const url = new URL(`${API_BASE}/api/v1/skills`);
      url.searchParams.set('view', view);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', '500');

      const upstream = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          'user-agent': 'Mohammed-Skills-Universe-Live/2.4'
        }
      });

      if (!upstream.ok) {
        throw new Error(`skills.sh returned ${upstream.status}: ${(await upstream.text()).slice(0, 300)}`);
      }

      const payload = await upstream.json();
      if (!Array.isArray(payload.data) || !payload.pagination) throw new Error('Unexpected skills.sh response');
      reportedTotal = Number(payload.pagination.total || reportedTotal);
      skills.push(...payload.data);
      if (!payload.pagination.hasMore) break;
      page += 1;
      if (page > 100) throw new Error('Pagination safety limit reached');
    }

    const seen = new Set();
    const data = [];
    for (const skill of skills) {
      if (!skill?.id || seen.has(skill.id)) continue;
      seen.add(skill.id);
      data.push({
        id: skill.id,
        slug: skill.slug || skill.name || skill.id,
        name: skill.name || skill.slug || skill.id,
        source: skill.source || 'unknown',
        sourceType: skill.sourceType || null,
        installUrl: skill.installUrl || null,
        url: skill.url || null,
        installs: Number(skill.installs || 0),
        isDuplicate: Boolean(skill.isDuplicate),
        rank: data.length + 1
      });
    }

    response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.status(200).json({
      generatedAt: new Date().toISOString(),
      source: 'skills.sh live API',
      view,
      reportedTotal,
      count: data.length,
      data
    });
  } catch (error) {
    response.setHeader('Cache-Control', 'no-store');
    response.status(502).json({ error: 'catalog_upstream_failed', detail: String(error.message || error) });
  }
}
