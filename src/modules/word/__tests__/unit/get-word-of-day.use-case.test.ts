import { describe, it, expect, vi } from 'vitest';
import {
  GetWordOfDayUseCase,
  wibDateString,
} from '../../application/use-cases/get-word-of-day.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { WordDetail } from '../../domain/entities/word.entity';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';

const WIB_NOW = new Date('2026-09-21T10:00:00Z'); // 17:00 WIB → 2026-09-21

function makeDetail(verifiedAt: Date | null): WordDetail {
  return { id: 'A'.repeat(26), verifiedAt } as unknown as WordDetail;
}

function makeRepo(overrides: Record<string, ReturnType<typeof vi.fn>>) {
  return overrides as unknown as WordRepository;
}

/** Fake AppSettingsRepository: map + optional spy overrides. */
function makeSettings(options?: {
  stored?: Record<string, string>;
  getValue?: ReturnType<typeof vi.fn>;
  setIfAbsent?: ReturnType<typeof vi.fn>;
}) {
  const stored = options?.stored ?? {};
  return {
    getAll: vi.fn(),
    getByKeys: vi.fn(),
    getValue:
      options?.getValue ?? vi.fn(async (key: string) => stored[key] ?? null),
    setIfAbsent:
      options?.setIfAbsent ??
      vi.fn(async (key: string, value: string) => {
        if (!(key in stored)) stored[key] = value;
      }),
    getLegalActiveVersions: vi.fn(),
    upsertMany: vi.fn(),
  } as unknown as AppSettingsRepository;
}

describe('wibDateString', () => {
  it('UTC+7: 21 Sep 10:00 UTC masih 21 Sep di WIB, 16:59+ UTC sudah esok', () => {
    expect(wibDateString(WIB_NOW)).toBe('2026-09-21');
    // 2026-09-21T17:00:01Z = 2026-09-22 00:00:01 WIB
    expect(wibDateString(new Date('2026-09-21T17:00:01Z'))).toBe('2026-09-22');
  });
});

describe('GetWordOfDayUseCase', () => {
  it('store sudah berisi pilihan hari itu → algoritma hash tidak dipanggil', async () => {
    const findWordOfDayId = vi.fn();
    const findDetailById = vi
      .fn()
      .mockResolvedValue({ id: 'C'.repeat(26), verifiedAt: null } as unknown as WordDetail);
    const setIfAbsent = vi.fn();
    const settings = makeSettings({ stored: { 'word_of_the_day:2026-09-21': 'C'.repeat(26) }, setIfAbsent });
    const uc = new GetWordOfDayUseCase(
      makeRepo({ findWordOfDayId, findDetailById }),
      settings,
    );

    const result = await uc.execute(WIB_NOW);

    expect(findWordOfDayId).not.toHaveBeenCalled();
    expect(findDetailById).toHaveBeenCalledWith('C'.repeat(26));
    expect(result.word?.id).toBe('C'.repeat(26));
    expect(setIfAbsent).not.toHaveBeenCalled();
  });

  it('store kosong → algoritma lama jalan lalu id disimpan (selection tak berubah)', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue('A'.repeat(26));
    const findDetailById = vi.fn().mockResolvedValue(makeDetail(null));
    const stored: Record<string, string> = {};
    const uc = new GetWordOfDayUseCase(
      makeRepo({ findWordOfDayId, findDetailById }),
      makeSettings({ stored }),
    );

    await uc.execute(WIB_NOW);

    expect(findWordOfDayId).toHaveBeenCalledWith('2026-09-21');
    expect(stored['word_of_the_day:2026-09-21']).toBe('A'.repeat(26));
  });

  it('dua instance berbeda (isolate baru) memakai id tersimpan yang sama', async () => {
    const stored: Record<string, string> = {};
    const findWordOfDayId = vi.fn().mockResolvedValue('A'.repeat(26));
    const findDetailById = vi.fn().mockResolvedValue(makeDetail(null));
    const repo = makeRepo({ findWordOfDayId, findDetailById });

    const first = new GetWordOfDayUseCase(repo, makeSettings({ stored }));
    const second = new GetWordOfDayUseCase(repo, makeSettings({ stored }));
    const a = await first.execute(WIB_NOW);
    const b = await second.execute(WIB_NOW);

    expect(findWordOfDayId).toHaveBeenCalledTimes(1);
    expect(b.word?.id).toBe(a.word?.id);
  });

  it('store error (transien) → tetap jalan lewat algoritma lama', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue('A'.repeat(26));
    const findDetailById = vi.fn().mockResolvedValue(makeDetail(null));
    const settings = makeSettings({
      getValue: vi.fn().mockRejectedValue(new Error('db down')),
      setIfAbsent: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const uc = new GetWordOfDayUseCase(
      makeRepo({ findWordOfDayId, findDetailById }),
      settings,
    );

    const result = await uc.execute(WIB_NOW);

    expect(findWordOfDayId).toHaveBeenCalledTimes(1);
    expect(result.word?.id).toBe('A'.repeat(26));
  });

  it('tanggal sama → hasil instance sama (cache), repo dipanggil sekali', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue('A'.repeat(26));
    const findDetailById = vi
      .fn()
      .mockResolvedValue(makeDetail(new Date('2026-09-01T00:00:00Z')));
    const uc = new GetWordOfDayUseCase(makeRepo({ findWordOfDayId, findDetailById }));

    const first = await uc.execute(WIB_NOW);
    const second = await uc.execute(new Date('2026-09-21T12:00:00Z')); // hari WIB sama

    expect(second).toBe(first); // cache: identik by reference
    expect(findWordOfDayId).toHaveBeenCalledTimes(1);
    expect(findWordOfDayId).toHaveBeenCalledWith('2026-09-21');
    expect(first?.date).toBe('2026-09-21');
    expect(first?.word?.id).toBe('A'.repeat(26));
  });

  it('tanggal WIB berganti → query baru memakai tanggal baru', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue('B'.repeat(26));
    const findDetailById = vi.fn().mockResolvedValue(makeDetail(null));
    const uc = new GetWordOfDayUseCase(makeRepo({ findWordOfDayId, findDetailById }));

    await uc.execute(new Date('2026-09-21T17:00:00Z')); // 22 Sep 00:00 WIB
    await uc.execute(new Date('2026-09-22T05:00:00Z')); // masih 22 Sep WIB

    expect(findWordOfDayId).toHaveBeenCalledWith('2026-09-22');
    expect(findWordOfDayId).toHaveBeenCalledTimes(1);
  });

  it('korpus kosong → word null, tetap di-cache (bukan error)', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue(null);
    const findDetailById = vi.fn();
    const uc = new GetWordOfDayUseCase(makeRepo({ findWordOfDayId, findDetailById }));

    const result = await uc.execute(WIB_NOW);

    expect(result.word).toBeNull();
    expect(result.date).toBe('2026-09-21');
    expect(result.isNewThisWeek).toBe(false);
    expect(findDetailById).not.toHaveBeenCalled();
  });

  it('is_new_this_week: verified_at 3 hari lalu true, 8 hari lalu false', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue('A'.repeat(26));
    const uc = new GetWordOfDayUseCase(
      makeRepo({
        findWordOfDayId,
        findDetailById: vi
          .fn()
          .mockResolvedValueOnce(makeDetail(new Date('2026-09-18T10:00:00Z')))
          .mockResolvedValueOnce(makeDetail(new Date('2026-09-13T10:00:00Z'))),
      }),
    );

    const baru = await uc.execute(WIB_NOW);
    expect(baru.isNewThisWeek).toBe(true);

    // Paksa cache miss dengan tanggal WIB berbeda
    const lama = await uc.execute(new Date('2026-09-21T17:00:01Z'));
    expect(lama.isNewThisWeek).toBe(false);
  });

  it('race: id terpilih tapi detail null (ter-unpublish) → word null tanpa throw', async () => {
    const findWordOfDayId = vi.fn().mockResolvedValue('A'.repeat(26));
    const findDetailById = vi.fn().mockResolvedValue(null);
    const uc = new GetWordOfDayUseCase(makeRepo({ findWordOfDayId, findDetailById }));

    const result = await uc.execute(WIB_NOW);

    expect(result.word).toBeNull();
    expect(result.isNewThisWeek).toBe(false);
  });

  it('cache invalid jika kata ter-cache punya label feed-excluded', async () => {
    const findWordOfDayId = vi
      .fn()
      .mockResolvedValueOnce('A'.repeat(26))
      .mockResolvedValueOnce('B'.repeat(26));
    const findDetailById = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'A'.repeat(26),
        verifiedAt: new Date('2026-09-01T00:00:00Z'),
        usageLabels: ['kasar'],
      } as unknown as WordDetail)
      .mockResolvedValueOnce({
        id: 'B'.repeat(26),
        verifiedAt: new Date('2026-09-01T00:00:00Z'),
        usageLabels: ['informal'],
      } as unknown as WordDetail);
    const uc = new GetWordOfDayUseCase(makeRepo({ findWordOfDayId, findDetailById }));

    const first = await uc.execute(WIB_NOW);
    expect(first.word).toBeNull();

    // Simulasikan cache berisi kata sensitif (setelah assign manual)
    (uc as unknown as { cache: { date: string; result: unknown } }).cache = {
      date: '2026-09-21',
      result: {
        date: '2026-09-21',
        isNewThisWeek: false,
        word: {
          id: 'A'.repeat(26),
          usageLabels: ['seksual'],
          verifiedAt: null,
        },
      },
    };

    const second = await uc.execute(WIB_NOW);
    expect(second.word?.id).toBe('B'.repeat(26));
    expect(findWordOfDayId).toHaveBeenCalledTimes(2);
  });
});
