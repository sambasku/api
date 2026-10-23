import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { places } from "./places.schema";

/**
 * Viewer unik yang membuka detail place per hari - sumber metrik
 * "terpopuler" di console (docs/api/45-api-place-views.md).
 *
 * Satu baris per (place, hari WIB, viewer). `viewer_key` yang menentukan
 * identitas pembaca, bukan `count`:
 * - `u:<user_id>`  - user login (stabil lintas perangkat)
 * - `d:<device_id>` - anonim, device id dari header X-Device-Id
 * - `ip:<ip>`      - fallback terakhir kalau device id absen
 * - `legacy`       - baris hasil migrasi 0089 (sudah teragregasi, asal tidak diketahui)
 *
 * PK tiga kolom = dedupe di server. Insert pakai ON CONFLICT DO NOTHING,
 * jadi 1 pembaca = 1 baris per hari (refresh berkali-kali tetap 1).
 */
export const placeViews = sqliteTable(
  "place_views",
  {
    placeId: text("place_id")
      .notNull()
      .references(() => places.id),
    day: text("day").notNull(), // 'YYYY-MM-DD' WIB
    /** Identitas pembaca (lihat daftar di atas). */
    viewerKey: text("viewer_key").notNull(),
    /** Selalu 1 - jumlah dihitung dari jumlah baris, bukan kolom ini. */
    count: integer("count").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.day, t.viewerKey] }),
    // Rentang per periode (day >= from) lalu agregasi per place.
    index("place_views_day_idx").on(t.day),
  ],
);
