import assert from 'node:assert/strict';

const base = process.env.SEO_TEST_URL || 'http://127.0.0.1:3107';
const origin = 'https://tropeaminepacks.vercel.app';
const publicPaths = ['/', '/discover', '/series', '/packs', '/albums', '/odds', '/terms', '/privacy', '/data'];
const privatePaths = ['/binder', '/quests', '/requests', '/login', '/showcase', '/showcase/create', '/showcase/quick'];
async function get(path) {
  const response = await fetch(`${base}${path}`, {headers: {'User-Agent': 'Googlebot'}, redirect: 'manual'});
  assert.equal(response.status, 200, path);
  return response.text();
}
const robots = await get('/robots.txt');
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
for (const path of ['/admin', '/binder', '/quests', '/requests', '/login', '/auth', '/api', '/showcase', '/preview']) {
  assert.ok(robots.includes(`Disallow: ${path}`), path);
}
const sitemap = await get('/sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.deepEqual(urls, publicPaths.map(path => new URL(path, origin).href));
for (const path of publicPaths) {
  const html = await get(path);
  assert.equal(new URL(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]).href, new URL(path, origin).href, `${path} canonical`);
  assert.ok(!html.includes('content="noindex'), `${path} is indexable`);
  if (path === '/') {
    // Strip script payloads: content must exist as real HTML without JavaScript.
    const rendered = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    assert.ok(rendered.includes('Collect book characters with Tropeamine Packs'));
    assert.ok(rendered.includes('unofficial, fan-made digital card collection'));
    assert.ok(rendered.includes('href="/discover"'));
  }
}
for (const path of privatePaths) {
  const html = await get(path);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.ok(!html.includes('rel="canonical"'), `${path} must not canonicalize to homepage`);
}
const query = await get('/?utm_source=seo-check');
assert.equal(new URL(query.match(/<link rel="canonical" href="([^"]+)"/)?.[1]).href, `${origin}/`);
for (const path of ['/admin', '/admin/cards', '/admin/users']) {
  const response = await fetch(`${base}${path}`, {redirect: 'manual'});
  assert.ok([303, 307, 308].includes(response.status), `${path} still requires sign-in`);
  assert.ok(response.headers.get('location')?.startsWith('/login'));
}
assert.equal((await fetch(`${base}/not-a-public-route`)).status, 404);
console.log('SEO integration checks passed: crawler files, 9 public canonicals, 7 noindex pages, raw homepage HTML, query canonical, admin guards, and unknown-route 404.');
