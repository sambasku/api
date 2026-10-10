import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

// Pengumuman admin (#102): tayang di feed publik sebagai item kind
// `announcement` (write-through activity_events saat create) + halaman
// detail in-app mobile. Action = buka link eksternal (opsional, nullable).
// Masa berlaku: expires_at opsional - feed menyaring yang kadaluarsa.
// Pinned: pinned_at tidak null = tampil di halaman pinned/carousel mobile.
export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    title: text('title').notNull(),
    body: text('body').notNull(),
    // #124 lanjutan: format isi - plain | html | md | webview.
    // html = render native client; webview = client load body (URL/HTML).
    bodyType: text('body_type', {
      enum: ['plain', 'html', 'md', 'webview'],
    }).notNull().default('plain'),
    // URL https eksternal (opsional). Konsisten whitelist mobile - kosong
    // = pengumuman tanpa action.
    actionUrl: text('action_url'),
    actionLabel: text('action_label'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    pinnedAt: integer('pinned_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    // List admin: terbaru dulu.
    index('announcements_created_at_idx').on(t.createdAt),
    // Pinned query: pinned terbaru dulu, filter deletedAt null.
    index('announcements_pinned_idx').on(t.pinnedAt),
  ],
);
