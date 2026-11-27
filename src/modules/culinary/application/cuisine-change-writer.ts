import type {
  EntityChangeContext,
  RecordEntityChange,
} from '@/modules/change-history/application/record-entity-change';
import { cuisineSnapshot } from '@/modules/change-history/domain/entity-change';
import type { Cuisine } from '../domain/entities/culinary.entity';
import type {
  CreateCuisineInput,
  CulinaryRepository,
  UpdateCuisineInput,
} from '../domain/repositories/culinary.repository';

/**
 * Semua mutasi kuliner (admin, approve usulan, pembatasan/pemulihan) lewat
 * sini supaya riwayat publik tercatat di satu tempat. Tanpa recorder =
 * pass-through murni ke repo (tidak ada query tambahan).
 */
export class CuisineChangeWriter {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly changes?: RecordEntityChange,
  ) {}

  async create(
    input: CreateCuisineInput,
    ctx?: Partial<EntityChangeContext>,
  ): Promise<Cuisine> {
    const cuisine = await this.repo.createCuisine(input);
    await this.changes?.created('cuisine', cuisine.id, cuisineSnapshot(cuisine), {
      actorId: ctx?.actorId ?? input.authorId ?? null,
      sourceContributionId: ctx?.sourceContributionId,
      requestId: ctx?.requestId,
    });
    return cuisine;
  }

  async update(
    input: UpdateCuisineInput,
    ctx?: Partial<EntityChangeContext>,
  ): Promise<Cuisine | null> {
    const before = this.changes ? await this.repo.findCuisineById(input.id) : null;
    const updated = await this.repo.updateCuisine(input);
    if (!updated || !before || !this.changes) return updated;
    // Snapshot "sesudah" dibaca dengan loader yang sama (kategori ter-JOIN) agar
    // tidak ada selisih palsu antara dua bentuk entity.
    const after = (await this.repo.findCuisineById(input.id)) ?? updated;
    await this.changes.updated('cuisine', input.id, cuisineSnapshot(before), cuisineSnapshot(after), {
      actorId: ctx?.actorId ?? null,
      sourceContributionId: ctx?.sourceContributionId,
      requestId: ctx?.requestId,
    });
    return updated;
  }

  async remove(id: string, ctx?: Partial<EntityChangeContext>): Promise<boolean> {
    const before = this.changes ? await this.repo.findCuisineById(id) : null;
    const ok = await this.repo.softDeleteCuisine(id);
    if (ok && before) {
      await this.changes?.deleted('cuisine', id, cuisineSnapshot(before), {
        actorId: ctx?.actorId ?? null,
        requestId: ctx?.requestId,
      });
    }
    return ok;
  }
}
