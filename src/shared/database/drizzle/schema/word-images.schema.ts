import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, unique, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { words } from './words.schema';
import { users } from './users.schema';
import type { WordImageAttribution } from '@/shared/constants/word-image-attribution';

// Gambar contoh per kata - referensi ke file di provider eksternal
// (ImageKit via ImageStoragePort). Provider-agnostic: kolom `provider`
// + `provider_file_id` supaya ganti provider tinggal ganti wrapper.
export const wordImages = sqliteTable(
  'word_images',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    provider: text('provider').notNull().default('imagekit'),
    providerFileId: text('provider_file_id').notNull(),
    /** Blob sha GitHub - null untuk baris ImageKit lama */
    sha: text('sha'),
    url: text('url').notNull(),
    altText: text('alt_text'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    /** Peringatan visual per foto (JSON array closed enum), bukan usage_labels kata. */
    contentWarnings: text('content_warnings', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Kredit foto stock (JSON WordImageAttribution); null untuk upload user. */
    attribution: text('attribution', { mode: 'json' }).$type<WordImageAttribution>(),
    // Approval gate (Section 22) - kontribusi mandiri: pending sampai
    // disetujui verifikator; identitas reviewer ada di contribution_reviews
    status: text('status').notNull().default('published'),
    isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
    isCorrected: integer('is_corrected', { mode: 'boolean' }).notNull().default(false),
    /** Asal foto (mis. `jinye`); null = upload langsung / stock. */
    sourceType: text('source_type'),
    /** `<jinyeId>:<providerFileId foto Jinye>` bila source_type=jinye. */
    sourceReference: text('source_reference'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    // Per kata: foto stock yang sama boleh dipakai di banyak kata.
    unique('word_images_word_file_unique').on(t.wordId, t.provider, t.providerFileId),
    index('word_images_word_idx').on(t.wordId),
    // Satu foto sumber hanya sekali per kata (race double-tap); baris
    // ditolak/dibatalkan (deleted_at) tidak menghalangi promote ulang.
    uniqueIndex('word_images_source_uidx')
      .on(t.wordId, t.sourceType, t.sourceReference)
      .where(sql`source_type IS NOT NULL AND deleted_at IS NULL`),
    index('word_images_source_ref_idx').on(t.sourceType, t.sourceReference),
  ],
);
