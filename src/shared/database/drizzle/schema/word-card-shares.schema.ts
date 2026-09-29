import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { words } from './words.schema';

// Share kartu kata yang sukses dari app (user masuk). Sumber baris feed
// "Membagikan kartu". Satu baris per user+kata per 24 jam (dicek di repo).
export const wordCardShares = sqliteTable(
  'word_card_shares',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('word_card_shares_created_idx').on(t.createdAt, t.id),
    index('word_card_shares_user_word_idx').on(t.userId, t.wordId, t.createdAt),
  ],
);
