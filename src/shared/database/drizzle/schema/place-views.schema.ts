import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { places } from "./places.schema";

/**
 * Counter view detail place (wisata/kuliner/budaya) per hari - sumber
 * metrik "terpopuler" di console. Satu baris per (place, hari WIB),
 * upsert count+1 dari POST /places/:slug/view (web + mobile).
 * Pola sama dengan search_daily (docs/api/45-api-place-views.md).
 */
export const placeViews = sqliteTable(
  "place_views",
  {
    placeId: text("place_id")
      .notNull()
      .references(() => places.id),
    day: text("day").notNull(), // 'YYYY-MM-DD' WIB
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.day] }),
    // Rentang per periode (day >= from) lalu agregasi per place.
    index("place_views_day_idx").on(t.day),
  ],
);
