// Maps a raw ScrapeCreators / Instagram post object to the normalized shape used by select.mjs.
//
// VERIFIED live on 2026-11-14 against GET /v2/instagram/user/posts?handle=nick_saraev:
//   items[]: code, id, media_type (8 = carousel, 2 = video/reel, 1 = image), product_type
//   ('carousel_container' | 'clips'), like_count, comment_count, taken_at (epoch seconds),
//   caption.text, carousel_media[] (each: media_type, image_versions2.candidates[{url,width,height}]),
//   carousel_media_count, like_and_view_counts_disabled, play_count (reels only).
//   Envelope: { user: { follower_count }, items, next_max_id, more_available }.
//   There are NO share or save counts anywhere in the response.
// The other shapes handled below (GraphQL-style names) are fallbacks that were not observed.
// test/fixtures/real-posts.json holds a trimmed copy of the real response.

function toEpochSec(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  const ms = Date.parse(String(v));
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function firstNumber(...vals) {
  for (const v of vals) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

// Pick the smallest image that is still >= 720px wide (good enough to read text, cheap to download);
// if none is that wide, take the largest one available.
function pickCandidate(candidates) {
  const list = (candidates || []).filter((c) => c?.url);
  if (list.length === 0) return null;
  const wide = list.filter((c) => (c.width || 0) >= 720).sort((a, b) => a.width - b.width);
  if (wide.length) return wide[0].url;
  return list.sort((a, b) => (b.width || 0) - (a.width || 0))[0].url;
}

function slideUrl(c) {
  return (
    pickCandidate(c?.image_versions2?.candidates) ||
    c?.display_url ||
    c?.display_uri ||
    c?.image_url ||
    c?.thumbnail_url ||
    c?.url ||
    null
  );
}

// For video slides the image is only a poster frame.
function slideKind(c) {
  return c?.media_type === 2 || c?.is_video === true ? 'video' : 'image';
}

export function normalizePost(raw, handle) {
  const code = raw.code || raw.shortcode || raw.short_code || null;
  const id = String(raw.id ?? raw.pk ?? code ?? '');

  const children =
    raw.carousel_media ||
    raw.edge_sidecar_to_children?.edges?.map((e) => e.node) ||
    raw.children ||
    raw.slides ||
    [];

  const typeHint = String(raw.media_type ?? raw.product_type ?? raw.__typename ?? raw.type ?? '');
  let type = 'unknown';
  if (raw.media_type === 8 || /sidecar|carousel|album/i.test(typeHint) || children.length >= 2) type = 'carousel';
  else if (raw.media_type === 2 || /video|reel|clip/i.test(typeHint)) type = 'video';
  else if (raw.media_type === 1 || /image|photo/i.test(typeHint)) type = 'image';

  const slideUrls = children.map(slideUrl).filter(Boolean);
  const slideKinds = children.map(slideKind);
  const slideCount = children.length || raw.carousel_media_count || (type === 'carousel' ? 0 : 1);

  let likes = firstNumber(raw.like_count, raw.edge_media_preview_like?.count, raw.edge_liked_by?.count, raw.likes);
  if (raw.like_and_view_counts_disabled === true || likes === -1) likes = null;

  const comments = firstNumber(raw.comment_count, raw.edge_media_to_comment?.count, raw.comments) ?? 0;

  const caption =
    typeof raw.caption === 'string'
      ? raw.caption
      : raw.caption?.text ?? raw.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';

  return {
    id,
    code,
    url: code ? `https://www.instagram.com/p/${code}/` : raw.url || null,
    handle,
    type,
    slideCount,
    slideUrls,
    slideKinds,
    likes,
    comments,
    takenAt: toEpochSec(raw.taken_at ?? raw.taken_at_timestamp ?? raw.timestamp ?? raw.date ?? raw.created_at),
    caption,
  };
}

// Pull the list of posts out of whichever envelope the API uses.
export function extractItems(body) {
  if (Array.isArray(body)) return body;
  return body?.items || body?.posts || body?.data?.items || body?.data || body?.edges?.map((e) => e.node) || [];
}

// Pull a pagination cursor out of whichever field the API uses (null = no more pages).
export function extractCursor(body) {
  return (
    body?.next_max_id ||
    body?.next_cursor ||
    body?.cursor ||
    body?.page_info?.end_cursor ||
    body?.data?.next_max_id ||
    null
  );
}
