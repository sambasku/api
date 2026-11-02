import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { config } from "dotenv";

const { parsed } = config({ path: ".env.test", quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget subrequest (rule join-bukan-n-panggilan): list & detail usaha wajib
 * hemat - kategori/desa di-JOIN, katalog item di batch, bukan per baris.
 * Spy `client.execute` hitung query per operasi repo.
 */
describe.skipIf(!hasTestDb)("Usaha query budget - list & detail", () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  const KEC_ID = "01EVKECQBUDGETUSAHA00000001";
  const VILLAGE_ID = "01EVDESQBUDGETUSAHA0000001";

  beforeAll(async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const schema = await import("@/shared/database/drizzle/schema");
    const { regions, usahas, usahaItems } = schema;
    const { truncateAll } = await import(
      "@/shared/database/drizzle/test-utils"
    );
    const seedDb = getTestDb();
    await truncateAll(seedDb);

    await seedDb.insert(regions).values([
      {
        id: KEC_ID,
        slug: "kec-usaha-budget",
        name: "Kecamatan Usaha Budget",
        type: "kecamatan",
        status: "published" as const,
      },
      {
        id: VILLAGE_ID,
        slug: "kec-usaha-budget/desa-usaha-budget",
        name: "Desa Usaha Budget",
        type: "desa",
        parentId: KEC_ID,
        status: "published",
      },
    ]);

    const now = new Date();
    await seedDb.insert(usahas).values(
      Array.from({ length: 20 }, (_, i) => ({
        id: `01EUSBUDGET${String(i).padStart(15, "0")}`,
        slug: `usaha-budget-${i}`,
        name: `Usaha Budget ${i}`,
        description: "Usaha uji budget query.",
        categoryId: "kuliner",
        kind: "product" as const,
        regionId: KEC_ID,
        villageId: VILLAGE_ID,
        publishStatus: "published" as const,
        operationalStatus: "open" as const,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })),
    );

    // 20 usaha x 3 item = 60 baris katalog. Detail SATU usaha hanya boleh
    // ambil item miliknya sendiri (satu query, bukan per usaha).
    await seedDb.insert(usahaItems).values(
      Array.from({ length: 20 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) => ({
          id: `01EUSITEM${String(i).padStart(4, "0")}${String(j).padStart(12, "0")}`,
          usahaId: `01EUSBUDGET${String(i).padStart(15, "0")}`,
          name: `Item ${i}-${j}`,
          priceText: "Rp 5.000",
          sortOrder: j,
        })),
      ).flat(),
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

  it("list 20 usaha pakai 1 query (kategori + desa di-JOIN)", async () => {
    const { UsahaRepositoryImpl } = await import(
      "@/modules/usaha/infrastructure/usaha.repository.impl"
    );
    const repo = new UsahaRepositoryImpl(db);
    queryCount = 0;
    const res = await repo.list({ limit: 20, publicOnly: true });
    expect(res.items.length).toBe(20);
    expect(queryCount).toBe(1);
    expect(res.items[0].village?.name).toBe("Desa Usaha Budget");
    expect(res.items[0].category?.name).toBe("Kuliner");
  });

  it("detail usaha pakai <= 2 query (usaha join + katalog item)", async () => {
    const { UsahaRepositoryImpl } = await import(
      "@/modules/usaha/infrastructure/usaha.repository.impl"
    );
    const repo = new UsahaRepositoryImpl(db);
    queryCount = 0;
    const usaha = await repo.findBySlug("usaha-budget-0", { publicOnly: true });
    expect(usaha).toBeTruthy();
    expect(usaha!.items.length).toBe(3);
    expect(queryCount).toBeLessThanOrEqual(2);
  });

  it("filter village_id pakai ULID maupun slug katalog publik", async () => {
    const { UsahaRepositoryImpl } = await import(
      "@/modules/usaha/infrastructure/usaha.repository.impl"
    );
    const repo = new UsahaRepositoryImpl(db);
    const byUlid = await repo.list({
      limit: 20,
      publicOnly: true,
      villageId: VILLAGE_ID,
    });
    expect(byUlid.items.length).toBe(20);

    const bySlug = await repo.list({
      limit: 20,
      publicOnly: true,
      villageId: "kec-usaha-budget/desa-usaha-budget",
    });
    expect(bySlug.items.length).toBe(20);
  });
});
