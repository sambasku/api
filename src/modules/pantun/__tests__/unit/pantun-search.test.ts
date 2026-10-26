import { describe, expect, it, vi } from 'vitest';
import { createPantunRoutes } from '../../presentation/v1/pantun.routes';
import type { PantunController } from '../../presentation/v1/pantun.controller';
import type { PantunSearchHit } from '../../domain/repositories/pantun.repository';

/**
 * /search harus didaftarkan SEBELUM /:id, kalau tidak opaqueId menolak
 * literal 'search' sebagai param id (404/400) dan pencarian mati.
 */
describe('GET /pantuns/search', () => {
  const hit: PantunSearchHit = {
    kind: 'reply',
    reply: {
      id: '01M5S90NK8ERSX5AF9VMTDQP23',
      parentId: '01M5S90NK8ERSX5AF9VMTDQP22',
      userId: 'u1',
      username: 'penulis',
      displayName: null,
      avatarUrl: null,
      userRole: null,
      categoryId: null,
      language: 'id',
      rhymeScheme: 'ABAB',
      lines: ['a satu', 'a dua', 'a tiga', 'a empat'],
      status: 'published',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: null,
    },
  };

  it('memanggil controller.search dan mengembalikan parent_id balasan', async () => {
    const search = vi.fn((c: { json: (body: unknown) => Response }) =>
      c.json({
        success: true,
        data: [{ ...hit.reply, parent_id: hit.reply.parentId, status: 'published' }],
        meta: { limit: 20, q: 'ikan' },
      }),
    );
    const app = createPantunRoutes({
      controller: { search } as unknown as PantunController,
      authenticate: async (_c, next) => next(),
    });

    const res = await app.request('/search?q=ikan');
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith(expect.anything(), { q: 'ikan', limit: 20 });
    const json = (await res.json()) as { data: Array<{ parent_id: string | null }> };
    expect(json.data[0]?.parent_id).toBe('01M5S90NK8ERSX5AF9VMTDQP22');
  });

  it('menolak q kosong (400)', async () => {
    const search = vi.fn();
    const app = createPantunRoutes({
      controller: { search } as unknown as PantunController,
      authenticate: async (_c, next) => next(),
    });
    const res = await app.request('/search?q=%20');
    expect(res.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });
});
