/**
 * Kredit foto stock (Unsplash/Openverse CC/Pixabay), disimpan sebagai JSON
 * di `word_images.attribution`. Hanya untuk provider stock; upload user null.
 */
export interface WordImageAttribution {
  name: string;
  url?: string;
  license?: string;
  license_url?: string;
  source?: string;
}
