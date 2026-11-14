import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePost, extractItems, extractCursor } from '../scripts/lib/normalize.mjs';

// NOTE: these fixtures are SYNTHETIC, written from my understanding of common Instagram shapes.
// They check that normalize.mjs handles those shapes consistently. They do NOT prove the real
// ScrapeCreators response looks like this. Replace with a captured live response in Phase 0a.

test('mobile-API style carousel', () => {
  const p = normalizePost(
    {
      id: '111',
      code: 'AbC123',
      media_type: 8,
      like_count: 2500,
      comment_count: 310,
      taken_at: 1_799_000_000,
      caption: { text: 'שמרו את זה' },
      carousel_media: [
        { image_versions2: { candidates: [{ url: 'https://x/1.jpg' }] } },
        { image_versions2: { candidates: [{ url: 'https://x/2.jpg' }] } },
        { image_versions2: { candidates: [{ url: 'https://x/3.jpg' }] } },
      ],
    },
    'creator',
  );
  assert.equal(p.type, 'carousel');
  assert.equal(p.slideCount, 3);
  assert.deepEqual(p.slideUrls, ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
  assert.equal(p.likes, 2500);
  assert.equal(p.comments, 310);
  assert.equal(p.caption, 'שמרו את זה');
  assert.equal(p.url, 'https://www.instagram.com/p/AbC123/');
  assert.equal(p.takenAt, 1_799_000_000);
});

test('GraphQL style sidecar with hidden likes', () => {
  const p = normalizePost(
    {
      id: '222',
      shortcode: 'Zed999',
      __typename: 'GraphSidecar',
      like_and_view_counts_disabled: true,
      edge_media_preview_like: { count: 7 },
      edge_media_to_comment: { count: 90 },
      taken_at_timestamp: 1_799_100_000,
      edge_media_to_caption: { edges: [{ node: { text: 'hello' } }] },
      edge_sidecar_to_children: { edges: [{ node: { display_url: 'https://x/a.jpg' } }, { node: { display_url: 'https://x/b.jpg' } }] },
    },
    'creator',
  );
  assert.equal(p.type, 'carousel');
  assert.equal(p.likes, null); // hidden, even though a placeholder count was present
  assert.equal(p.comments, 90);
  assert.equal(p.slideCount, 2);
  assert.equal(p.caption, 'hello');
});

test('like_count -1 means hidden; ms timestamps and ISO strings are normalized', () => {
  assert.equal(normalizePost({ id: '1', like_count: -1, taken_at: 1_799_000_000_000 }, 'c').likes, null);
  assert.equal(normalizePost({ id: '1', taken_at: 1_799_000_000_000 }, 'c').takenAt, 1_799_000_000);
  assert.equal(normalizePost({ id: '1', taken_at: '2027-01-15T08:00:00Z' }, 'c').takenAt, Date.parse('2027-01-15T08:00:00Z') / 1000);
});

test('video and image types', () => {
  assert.equal(normalizePost({ id: '1', media_type: 2 }, 'c').type, 'video');
  assert.equal(normalizePost({ id: '1', media_type: 1 }, 'c').type, 'image');
  assert.equal(normalizePost({ id: '1' }, 'c').type, 'unknown');
});

test('extractItems / extractCursor tolerate several envelopes', () => {
  assert.deepEqual(extractItems({ items: [1] }), [1]);
  assert.deepEqual(extractItems({ posts: [2] }), [2]);
  assert.deepEqual(extractItems({ data: { items: [3] } }), [3]);
  assert.deepEqual(extractItems([4]), [4]);
  assert.deepEqual(extractItems({}), []);
  assert.equal(extractCursor({ next_max_id: 'abc' }), 'abc');
  assert.equal(extractCursor({ page_info: { end_cursor: 'xyz' } }), 'xyz');
  assert.equal(extractCursor({}), null);
});
