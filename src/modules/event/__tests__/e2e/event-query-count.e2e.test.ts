import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { config } from "dotenv";

const { parsed } = config({ path: ".env.test", quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget subrequest (rule join-bukan-n-panggilan): list event publik wajib
 * hemat - relasi (places/kategori/desa) di-batch, bukan per-baris. Spy
 * `client.execute` hitung query per operasi repo.
 */
describe.skipIf(!hasTestDb)("Event query budget - list & detail", () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  beforeAll(async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const schema = await import("@/shared/database/drizzle/schema");
    const { regions, events } = schema;
    const { truncateAll } = await import(
      "@/shared/database/drizzle/test-utils"
    );
    const seedDb = getTestDb();
    await truncateAll(seedDb);

    await seedDb.insert(regions).values([
      {
        id: "01EVKECQCBUDGET0000000001",
        slug: "kec-budget",
        name: "Kecamatan Budget",
        type: "kecamatan",
        status: "published" as const,
      },
      {
        id: "01EVDESQBUDGET00000000001",
        slug: "kec-budget/desa-budget",
        name: "Desa Budget",
        type: "desa",
        parentId: "01EVKECQCBUDGET0000000001",
        status: "published",
      },
    ]);

    const now = Date.now();
    await seedDb.insert(events).values(
      Array.from({ length: 20 }, (_, i) => ({
        id: `01EVBUDGET${String(i).padStart(13, "0")}`,
        slug: `acara-budget-${i}`,
        name: `Acara Budget ${i}`,
        description: "Acara uji budget query.",
        categoryId: "festival-hiburan",
        startsAt: new Date(now + i * 3_600_000),
        endsAt: new Date(now + (i + 1) * 3_600_000),
        locationText: "Somewhere",
        villageId: "01EVDESQBUDGET00000000001",
        status: "published" as const,
        publishedAt: new Date(),
      })),
    );
  });

  beforeEach(async () => {
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");
    const schema = await import("@/shared/database/drizzle/schema");
    const client = createClient({ url: process.env.DATABASE_URL! });
    const realExecute = client.execute.bind(client);
    queryCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).execute = async (...args: unknown[]) => {
      queryCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (realExecute as any)(...args);
    };
    db = drizzle(client, { schema });
  });

  it("list 20 event pakai <= 3 query (1 event + batch places + batch refs)", async () => {
    const { EventRepositoryImpl } = await import(
      "@/modules/event/infrastructure/event.repository.impl"
    );
    const repo = new EventRepositoryImpl(db);
    queryCount = 0;
    const res = await repo.list({
      limit: 20,
      publicOnly: true,
      order: "asc",
    });
    expect(res.items.length).toBe(20);
    // Relasi ter-join per batch, bukan per baris.
    expect(queryCount).toBeLessThanOrEqual(3);
    expect(res.items[0].village?.name).toBe("Desa Budget");
    expect(res.items[0].category?.name).toBe("Festival dan Hiburan");
  });

  it("detail event pakai <= 4 query", async () => {
    const { EventRepositoryImpl } = await import(
      "@/modules/event/infrastructure/event.repository.impl"
    );
    const repo = new EventRepositoryImpl(db);
    queryCount = 0;
    const event = await repo.findBySlug("acara-budget-0", {
      publicOnly: true,
    });
    expect(event).toBeTruthy();
    expect(queryCount).toBeLessThanOrEqual(4);
  });

  it("filter village_id pakai ULID maupun slug katalog publik", async () => {
    const { EventRepositoryImpl } = await import(
      "@/modules/event/infrastructure/event.repository.impl"
    );
    const repo = new EventRepositoryImpl(db);
    // ULID (isi FK events.village_id).
    const byUlid = await repo.list({
      limit: 20,
      publicOnly: true,
      villageId: "01EVDESQBUDGET00000000001",
    });
    expect(byUlid.items.length).toBe(20);
    // Slug publik (id katalog regions di mobile/web) - hasil sama.
    const bySlug = await repo.list({
      limit: 20,
      publicOnly: true,
      villageId: "kec-budget/desa-budget",
    });
    expect(bySlug.items.length).toBe(20);
  });

  it("filter region_id (kecamatan) ikut menjangkau acara yang hanya punya village_id", async () => {
    const { EventRepositoryImpl } = await import(
      "@/modules/event/infrastructure/event.repository.impl"
    );
    const repo = new EventRepositoryImpl(db);
    // ULID kecamatan.
    const byUlid = await repo.list({
      limit: 20,
      publicOnly: true,
      regionId: "01EVKECQCBUDGET0000000001",
    });
    expect(byUlid.items.length).toBe(20);
    // Slug kecamatan katalog publik - hasil sama, tetap satu query.
    queryCount = 0;
    const bySlug = await repo.list({
      limit: 20,
      publicOnly: true,
      regionId: "kec-budget",
    });
    expect(bySlug.items.length).toBe(20);
    expect(queryCount).toBeLessThanOrEqual(3);
  });
});
