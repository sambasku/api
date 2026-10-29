/** Potong teks untuk copy feed (#94 payload beku). Ellipsis ASCII. */
export function snippetActivityBody(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Payload `discussion_created`: cuplikan isi atau fallback docs
 * (`37-api-activity-feed.md`).
 */
export function discussionCreatedPayload(
  body: string | null | undefined,
): string {
  const t = body?.trim();
  return t ? snippetActivityBody(t, 120) : 'Membuka ruang diskusi';
}
