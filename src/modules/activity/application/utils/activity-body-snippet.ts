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

/**
 * Copy feed/timeline Jinye (`jinye_created` / `jinye_quote_created`).
 * Prioritas: teks → Foto → Suara → "Jinye".
 */
export function jinyeFeedPayload(input: {
  body?: string | null;
  quoteBody?: string | null;
  imageCount?: number;
  hasAudio?: boolean;
}): string {
  const text = (input.quoteBody ?? input.body ?? '').trim();
  if (text) return `Jinye : ${snippetActivityBody(text, 120)}`;
  if ((input.imageCount ?? 0) > 0) return 'Jinye : Foto';
  if (input.hasAudio) return 'Jinye : Suara';
  return 'Jinye';
}
