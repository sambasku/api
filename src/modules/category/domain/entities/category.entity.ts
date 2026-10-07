export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  /** Jumlah kata berkategori ini (api#50) - hanya diisi listCategories. */
  wordCount?: number;
}
