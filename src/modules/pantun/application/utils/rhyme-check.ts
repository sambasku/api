/**
 * Deteksi rima pantun berbasis suffix substring (PRD Pantun).
 *
 * ponytail: substring endsWith bukan pencocokan fonetis - "jalan"/"capal"
 * dianggap tidak berima meski mirip bunyi. Upgrade ke phoneme-group
 * (KBBI/dialek Sambas) bila butuh akurasi; kontrak return tidak berubah.
 */
export type RhymeScheme = 'ABAB' | 'AAAA';

export type RhymeCheckResult =
  | { ok: true; warning: string | null }
  | { ok: false; reason: 'LAST_WORD_UNDETECTED'; lineIndex: number }
  | {
      ok: false;
      reason: 'RHYME_MISMATCH';
      /** Pasangan baris (1-based) yang belum berima. */
      pairs: Array<[number, number]>;
    };

/** Pasangan baris (0-based) per skema: pasangan harus berima. */
const SCHEME_PAIRS: Record<RhymeScheme, Array<[number, number]>> = {
  ABAB: [
    [0, 2],
    [1, 3],
  ],
  AAAA: [
    [0, 1],
    [0, 2],
    [0, 3],
  ],
};

/** Ambil kata terakhir: strip tanda baca trailing + lowercase. */
export function extractLastWord(line: string): string | null {
  const words = line
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]+$/u, ''))
    .filter((w) => w.length > 0);
  const last = words[words.length - 1];
  if (!last) return null;
  return last.toLowerCase();
}

/**
 * Dua kata dianggap berima bila salah satu suffix minimal 2 huruf sama.
 * Kata pendek (< 2 huruf) dibandingkan penuh.
 */
export function suffixRhymes(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.min(a.length, b.length, 3);
  if (maxLen < 2) return a === b;
  for (let len = maxLen; len >= 2; len--) {
    if (a.endsWith(b.slice(-len)) || b.endsWith(a.slice(-len))) return true;
  }
  return false;
}

/**
 * Cek 4 baris pantun terhadap skema.
 *
 * - ok + warning null: rima cocok yakin.
 * - ok + warning: rima cocok via suffix pendek - mungkin keliru (ambigu),
 *   UI menampilkan peringatan keterbatasan pemeriksaan.
 * - LAST_WORD_UNDETECTED: baris tanpa kata ber-huruf - minta perbaikan.
 * - RHYME_MISMATCH: pasangan baris bermasalah (1-based) dikembalikan.
 */
export function detectRhyme(
  lines: readonly string[],
  scheme: RhymeScheme,
): RhymeCheckResult {
  const lastWords: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const w = extractLastWord(lines[i] ?? '');
    if (!w) return { ok: false, reason: 'LAST_WORD_UNDETECTED', lineIndex: i };
    lastWords.push(w);
  }
  const pairs: Array<[number, number]> = [];
  let minMatchLen = Infinity;
  for (const [i, j] of SCHEME_PAIRS[scheme]) {
    if (!suffixRhymes(lastWords[i], lastWords[j])) {
      pairs.push([i + 1, j + 1]);
      continue;
    }
    minMatchLen = Math.min(minMatchLen, matchedSuffixLen(lastWords[i], lastWords[j]));
  }
  if (pairs.length > 0) return { ok: false, reason: 'RHYME_MISMATCH', pairs };
  // Match hanya via suffix pendek (mis. 2 huruf) = ambigu: mirip teks,
  // belum tentu berima bunyi. UI peringatkan, tidak hard-fail.
  const ambiguous = minMatchLen <= 2;
  return {
    ok: true,
    warning: ambiguous
      ? 'Rima terdeteksi dari akhiran teks pendek; pemeriksa bunyi bisa keliru'
      : null,
  };
}

// AAAA dulu: semua baris berima = himpunan paling ketat (ABAB ikut lolos),
// jadi tanpa urutan ini AAAA tak pernah terpilih.
const AUTO_ORDER: readonly RhymeScheme[] = ['AAAA', 'ABAB'];

function matchedSuffixLen(a: string, b: string): number {
  const maxLen = Math.min(a.length, b.length);
  for (let len = maxLen; len >= 1; len--) {
    if (a.endsWith(b.slice(-len)) && b.endsWith(a.slice(-len))) return len;
  }
  return 0;
}

/**
 * Tebak skema rima tanpa user memilih. AAAA dicek dulu (semua baris berima
 * = pola paling ketat); bila tidak, ABAB (pasangan 1-3 & 2-4). null = tak
 * ada yang cocok.
 */
export function pickRhymeScheme(lines: readonly string[]): RhymeScheme | null {
  for (const scheme of AUTO_ORDER) {
    if (detectRhyme(lines, scheme).ok) return scheme;
  }
  return null;
}

/** Skema dengan pasangan gagal paling sedikit - untuk pesan error. */
export function closestRhymeScheme(lines: readonly string[]): RhymeScheme {
  let bestScheme: RhymeScheme = 'ABAB';
  let fewest = Infinity;
  for (const scheme of AUTO_ORDER) {
    const r = detectRhyme(lines, scheme);
    if (!r.ok && r.reason === 'RHYME_MISMATCH' && r.pairs.length < fewest) {
      fewest = r.pairs.length;
      bestScheme = scheme;
    }
  }
  return bestScheme;
}
