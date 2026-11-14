// Maps a raw ScrapeCreators / Instagram post object to the normalized shape used by select.mjs.
//
// !! The field names below are EDUCATED GUESSES covering the common Instagram shapes
// !! (GraphQL-style and mobile-API-style). They are NOT verified against a live
// !! ScrapeCreators response yet; that is Phase 0a in the plan. Once a real response is
// !! captured, trim this to the real shape and replace the synthetic test fixtures.

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

function slideUrl(c) {
  return (
    c?.image_versions2?.candidates?.[0]?.url ||
    c?.display_url ||
    c?.display_uri ||
    c?.image_url ||
    c?.thumbnail_url ||
    c?.url ||
    null
  );
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
