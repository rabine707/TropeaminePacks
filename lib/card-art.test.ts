import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {cardArtUrl, browseArtUrl, newCardArtPath} from './card-art.ts';
import {deliverCardArt} from './card-art-delivery.ts';

const id = '11111111-1111-4111-8111-111111111111';
const path = 'sfw/card/revision-front.png';
const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
function fixture({exists = true, upstreamStatus = 200, type = 'image/png', databaseError = false} = {}) {
  const calls: {url: URL; init?: RequestInit}[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({url, init});
    if (url.pathname.startsWith('/rest/')) return new Response(JSON.stringify(databaseError ? {message: 'offline'} : exists ? {storage_path: path} : null), {
      status: databaseError ? 500 : 200, headers: {'content-type': 'application/json'},
    });
    if (url.pathname.includes('/object/sign/') && init?.method === 'POST') return new Response(JSON.stringify({signedURL: '/object/sign/card-art/file?token=private'}), {headers: {'content-type': 'application/json'}});
    return new Response(bytes, {status: upstreamStatus, headers: {'content-type': type, 'cache-control': 'no-cache'}});
  };
  const client = createClient('https://project.supabase.co', 'public-test-key', {
    global: {fetch: fetcher}, auth: {persistSession: false, autoRefreshToken: false},
  });
  const request = (url = cardArtUrl(id, path)) => deliverCardArt(new Request('https://app.example' + url), id, client, fetcher);
  return {calls, request};
}

test('URLs are stable, revisions invalidate them, local/demo images are unchanged', () => {
  assert.equal(cardArtUrl(id, path), cardArtUrl(id, path));
  assert.notEqual(cardArtUrl(id, path), cardArtUrl(id, path + '.new'));
  assert.equal(browseArtUrl(cardArtUrl(id, path)), cardArtUrl(id, path, 'browse'));
  for (const url of ['/local.png', 'data:image/png;base64,abc', 'https://example.com/card.png']) assert.equal(browseArtUrl(url), url);
});

test('replacement uploads use unique revisions compatible with existing Storage path policies', () => {
  const first = newCardArtPath('sfw', id, 'front', 'png');
  assert.notEqual(first, newCardArtPath('sfw', id, 'front', 'png'));
  assert.match(first, /^sfw\/[0-9a-f-]{36}\/[0-9a-f-]{36}-front\.png$/);
  assert.match(newCardArtPath('adult', id, 'back', 'webp'), /^adult\/[0-9a-f-]{36}\/[0-9a-f-]{36}-back\.webp$/);
});

test('original is byte-identical and cacheable; access query matches published SFW catalog rules', async () => {
  const {request, calls} = fixture();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600, s-maxage=3600');
  assert.equal(response.headers.get('set-cookie'), null);
  const query = calls[0].url.searchParams;
  for (const [key, value] of Object.entries({id, storage_path: path, 'variants.rating': 'sfw', 'variants.available': 'true', 'variants.cards.published': 'true'})) assert.equal(query.get(key), `eq.${value}`);
  assert.equal(query.get('variants.cards.characters.series.published'), null);
  assert.equal(query.get('variants.cards.card_sets.published'), null);
  assert.equal(JSON.parse(String(calls[1].init?.body)).transform, undefined);
});

test('browse uses one bounded thumbnail representation and a fixed WebP accept header', async () => {
  const {request, calls} = fixture({type: 'image/webp'});
  assert.equal((await request(cardArtUrl(id, path, 'browse'))).status, 200);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)).transform, {width: 560, quality: 85});
  assert.deepEqual(calls[2].init?.headers, {Accept: 'image/webp'});
});

test('unknown, unpublished, or RLS-hidden assets never reach Storage and never cache errors', async () => {
  const {request, calls} = fixture({exists: false});
  const response = await request();
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.length, 1);
});

test('rejects adult paths, arbitrary sizes, duplicate and cache-busting query parameters before fetching', async () => {
  const {request, calls} = fixture();
  for (const url of [cardArtUrl(id, 'adult/secret.png'), cardArtUrl(id, path) + '&width=4000', cardArtUrl(id, path) + '&v=other', cardArtUrl(id, path) + '&size=browse', cardArtUrl(id, path).replace('original', 'huge')]) {
    assert.equal((await request(url)).status, 400);
  }
  assert.equal(calls.length, 0);
});

test('database/Storage errors and unexpected file types fail closed without caching', async () => {
  for (const options of [{databaseError: true}, {upstreamStatus: 403}, {type: 'text/html'}]) {
    const response = await fixture(options).request();
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
