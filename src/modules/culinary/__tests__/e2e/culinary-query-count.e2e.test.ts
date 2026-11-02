import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { config } from "dotenv";

const { parsed } = config({ path: ".env.test", quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget subrequest (rule join-bukan-n-panggilan): list kuliner wajib 1 query
 * (kategori di-JOIN, bukan resolve per baris); detail <= 2 query.
 */
describe.skipIf(!hasTestDb)("Culinary query budget - list & detail", () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  const CUISINE_IDS = Array.from(
    { length: 20 },
    (_, i) => `01EKCULBUDGET${String(i).padStart(15, "0")}`,
  );
  const PLACE_ID = "01EKPLBUDGET0000000000001";

  beforeAll(async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const schema = await import("@/shared/database/drizzle/schema");
    const { cuisines, culinaryPlaces, culinaryPlaceCuisines } = schema;
    const { truncateAll, reseedTestReferenceData } = await import(
      "@/shared/database/drizzle/test-utils"
    );
    const seedDb = getTestDb();
    await truncateAll(seedDb);
    await reseedTestReferenceData(seedDb);

    const now = new Date();
    await seedDb.insert(cuisines).values(
      CUISINE_IDS.map((id, i) => ({
        id,
        slug: `kuliner-budget-${i}`,
        name: `Kuliner Budget ${i}`,
        description: "Kuliner uji budget query.",
        categoryId: "makanan-utama",
        publishStatus: "published" as const,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })),
    );

    await seedDb.insert(culinaryPlaces).values({
      id: PLACE_ID,
      slug: "tempat-budget",
      name: "Tempat Budget",
      type: "warung" as const,
      publishStatus: "published" as const,
      operationalStatus: "operating" as const,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await seedDb.insert(culinaryPlaceCuisines).values(
      CUISINE_IDS.map((cuisineId, i) => ({
        id: `01EKLINKBUDGET${String(i).padStart(14, "0")}`,
        cuisineId,
        placeId: PLACE_ID,
        availability: "available" as const,
        publishStatus: "published" as const,
        createdAt: now,
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

  it("list 20 kuliner pakai 1 query (kategori di-JOIN)", async () => {
    const { CulinaryRepositoryImpl } = await import(
      "@/modules/culinary/infrastructure/culinary.repository.impl"
    );
    const repo = new CulinaryRepositoryImpl(db);
    queryCount = 0;
    const res = await repo.listCuisines({ limit: 20, publicOnly: true });
    expect(res.items.length).toBe(20);
    expect(queryCount).toBe(1);
    expect(res.items[0].category?.name).toBeTruthy();
  });

  it("detail kuliner pakai <= 2 query (kuliner join + relasi tempat)", async () => {
    const { CulinaryRepositoryImpl } = await import(
      "@/modules/culinary/infrastructure/culinary.repository.impl"
    );
    const repo = new CulinaryRepositoryImpl(db);
    queryCount = 0;
    const cuisine = await repo.findCuisineBySlug("kuliner-budget-0", {
      publicOnly: true,
    });
    expect(cuisine).toBeTruthy();
    expect(cuisine!.places.length).toBe(1);
    expect(queryCount).toBeLessThanOrEqual(2);
  });

  it("list tempat pakai 1 query", async () => {
    const { CulinaryRepositoryImpl } = await import(
      "@/modules/culinary/infrastructure/culinary.repository.impl"
    );
    const repo = new CulinaryRepositoryImpl(db);
    queryCount = 0;
    const res = await repo.listPlaces({ limit: 20, publicOnly: true });
    expect(res.items.length).toBe(1);
    expect(queryCount).toBe(1);
  });
});
