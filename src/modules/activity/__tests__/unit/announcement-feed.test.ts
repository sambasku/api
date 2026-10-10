import { describe, expect, it } from 'vitest';

// buildItem private; feed repo diuji lewat listFeed end-to-end shape dengan
// db mock minimal. Fokus #124: announcement di wire.
import { ActivityEventFeedRepositoryImpl } from '../../infrastructure/activity-event-feed.repository.impl';
import type { AppDatabase } from '@/shared/database/drizzle/client';

function makeDb() {
  return {} as unknown as AppDatabase;
}

describe('#124 announcement feed', () => {
  it('body announcement = title human-readable, bukan JSON beku', async () => {
    const repo = new ActivityEventFeedRepositoryImpl(makeDb());
    // Panggil private buildItem via any (test-only).
    const row = {
      kind: 'announcement',
      id: 'evt1',
      occurredAt: new Date('2026-10-08T10:00:00.000Z'),
      payload: JSON.stringify({
        title: 'Maintenance singkat',
        body: 'Server istirahat 10 menit.',
        actionUrl: 'https://example.com/x',
        actionLabel: 'Buka',
      }),
      targetId: 'ann1',
      // kolom JOIN lain kosong
    };
    const item = await (
      repo as unknown as { buildItem: (r: unknown) => Record<string, unknown> }
    ).buildItem(row);
    expect(item['body']).toBe('Maintenance singkat');
    expect(String(item['body'])).not.toContain('{"title"');
    expect(item['announcement']).toMatchObject({
      title: 'Maintenance singkat',
      body: 'Server istirahat 10 menit.',
      actionUrl: 'https://example.com/x',
    });
  });

  it('payload announcement rusak (bukan JSON) = fallback title Pengumuman', async () => {
    const repo = new ActivityEventFeedRepositoryImpl(makeDb());
    const row = {
      kind: 'announcement',
      id: 'evt2',
      occurredAt: new Date('2026-10-08T10:00:00.000Z'),
      payload: 'bukan json',
      targetId: 'ann2',
    };
    const item = await (
      repo as unknown as { buildItem: (r: unknown) => Record<string, unknown> }
    ).buildItem(row);
    expect(item['body']).toBe('Pengumuman');
    expect(item['announcement']).toMatchObject({ title: 'Pengumuman' });
  });
});


describe('#124 body_type', () => {
  it('payload bodyType valid -> wire announcement.bodyType', async () => {
    const repo = new ActivityEventFeedRepositoryImpl(makeDb());
    const row = {
      kind: 'announcement',
      id: 'evt3',
      occurredAt: new Date('2026-10-08T10:00:00.000Z'),
      payload: JSON.stringify({
        title: 'Artikel profil',
        body: '<h1>Halo</h1>',
        bodyType: 'html',
      }),
      targetId: 'ann3',
    };
    const item = await (
      repo as unknown as { buildItem: (r: unknown) => Record<string, unknown> }
    ).buildItem(row);
    expect((item['announcement'] as Record<string, unknown>)['bodyType']).toBe('html');
  });

  it('payload tanpa bodyType -> default plain', async () => {
    const repo = new ActivityEventFeedRepositoryImpl(makeDb());
    const row = {
      kind: 'announcement',
      id: 'evt4',
      occurredAt: new Date('2026-10-08T10:00:00.000Z'),
      payload: JSON.stringify({ title: 'T', body: 'Isi' }),
      targetId: 'ann4',
    };
    const item = await (
      repo as unknown as { buildItem: (r: unknown) => Record<string, unknown> }
    ).buildItem(row);
    expect((item['announcement'] as Record<string, unknown>)['bodyType']).toBe('plain');
  });
});
