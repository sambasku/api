import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_MENTION_MAX_PER_MESSAGE,
  CHAT_MENTION_PUSH_COOLDOWN_SECONDS,
  NotifyChatMentionsUseCase,
  extractChatMentions,
  resolveChatMentionUsernames,
} from '../../application/use-cases/notify-chat-mentions.use-case';
import type { ChatMessage } from '../../domain/entities/chat-message.entity';

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    channel: 'public',
    userId: 'author',
    username: 'andi',
    displayName: 'Andi',
    avatarUrl: null,
    kind: 'text',
    body: 'halo @budi',
    stickerId: null,
    audioUrl: null,
    audioPath: null,
    audioSha: null,
    durationMs: null,
    replyToId: null,
    replySnippet: null,
    replyUsername: null,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2026-11-26T10:00:00Z'),
    updatedAt: null,
    ...over,
  } as ChatMessage;
}

function setup(opts: { found?: Array<{ id: string; username: string; displayName: string }>; inserted?: boolean; lastPushAt?: Date | null } = {}) {
  const findMentionableByUsernames = vi.fn(async () => opts.found ?? [
    { id: 'budi-id', username: 'budi', displayName: 'Budi' },
  ]);
  const executeIfNew = vi.fn(async () => opts.inserted ?? true);
  const execute = vi.fn(async () => undefined);
  const get = vi.fn(async () =>
    opts.lastPushAt ? { userId: 'x', channel: 'chat_mention', lastPushAt: opts.lastPushAt } : null,
  );
  const touch = vi.fn(async () => undefined);
  const deleteByTarget = vi.fn(async () => 1);
  const now = new Date('2026-11-26T10:00:30Z');
  const uc = new NotifyChatMentionsUseCase(
    { findMentionableByUsernames },
    { executeIfNew },
    { execute },
    { get, touch } as never,
    { deleteByTarget },
    () => now,
  );
  return { uc, findMentionableByUsernames, executeIfNew, execute, get, touch, deleteByTarget };
}

describe('extractChatMentions', () => {
  it('dedupe dan buang titik/strip di akhir', () => {
    expect(extractChatMentions('hai @budi. dan @budi @siti-')).toEqual(['budi', 'siti']);
  });
  it('abaikan terlalu pendek dan user anonim', () => {
    expect(extractChatMentions('@ab @anonim @budi')).toEqual(['budi']);
  });
});

describe('resolveChatMentionUsernames', () => {
  const base = { authorUsername: 'andi', replyToId: null, replyUsername: null };

  it('lewati self-mention (case-insensitive)', () => {
    expect(resolveChatMentionUsernames({ ...base, body: '@ANDI @budi' })).toEqual(['budi']);
  });

  it('batasi jumlah mention per pesan', () => {
    const body = '@aaa @bbb @ccc @ddd @eee';
    expect(resolveChatMentionUsernames({ ...base, body })).toHaveLength(
      CHAT_MENTION_MAX_PER_MESSAGE,
    );
  });

  it('edit: hanya username baru', () => {
    expect(
      resolveChatMentionUsernames({
        ...base,
        body: 'hai @budi dan @siti',
        previousBody: 'hai @budi',
      }),
    ).toEqual(['siti']);
  });

  it('auto-mention dari reply tidak dihitung', () => {
    expect(
      resolveChatMentionUsernames({
        authorUsername: 'andi',
        replyToId: 'p1',
        replyUsername: 'budi',
        body: '@budi setuju',
      }),
    ).toEqual([]);
  });

  it('reply tetap menghitung mention manual orang lain', () => {
    expect(
      resolveChatMentionUsernames({
        authorUsername: 'andi',
        replyToId: 'p1',
        replyUsername: 'budi',
        body: '@budi setuju, cc @siti',
      }),
    ).toEqual(['siti']);
  });
});

describe('NotifyChatMentionsUseCase', () => {
  it('kirim inbox + push + sentuh cooldown', async () => {
    const t = setup();
    await t.uc.notify(msg());
    expect(t.executeIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'budi-id',
        type: 'chat_mention',
        targetKind: 'chat',
        targetId: 'm1',
        actorId: 'author',
        actionKind: 'chat',
      }),
    );
    expect(t.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'budi-id',
        data: expect.objectContaining({ type: 'chat_mention', target_id: 'm1' }),
      }),
    );
    expect(t.touch).toHaveBeenCalledWith('budi-id', 'chat_mention', expect.any(Date));
  });

  it('satu query penerima walau banyak mention (budget)', async () => {
    const t = setup({
      found: [
        { id: 'a', username: 'aaa', displayName: 'A' },
        { id: 'b', username: 'bbb', displayName: 'B' },
        { id: 'c', username: 'ccc', displayName: 'C' },
      ],
    });
    await t.uc.notify(msg({ body: '@aaa @bbb @ccc @ddd @eee @fff' }));
    expect(t.findMentionableByUsernames).toHaveBeenCalledTimes(1);
    expect(t.findMentionableByUsernames).toHaveBeenCalledWith(['aaa', 'bbb', 'ccc']);
    expect(t.executeIfNew).toHaveBeenCalledTimes(3);
  });

  it('inbox sudah ada (edit/duplikat): tidak push lagi', async () => {
    const t = setup({ inserted: false });
    await t.uc.notify(msg());
    expect(t.execute).not.toHaveBeenCalled();
  });

  it('push dibatasi cooldown, inbox tetap masuk', async () => {
    const t = setup({ lastPushAt: new Date('2026-11-26T10:00:00Z') });
    await t.uc.notify(msg());
    expect(t.executeIfNew).toHaveBeenCalledTimes(1);
    expect(t.execute).not.toHaveBeenCalled();
    expect(t.touch).not.toHaveBeenCalled();
  });

  it('push lagi setelah jendela cooldown lewat', async () => {
    const t = setup({
      lastPushAt: new Date(
        new Date('2026-11-26T10:00:30Z').getTime() -
          (CHAT_MENTION_PUSH_COOLDOWN_SECONDS + 1) * 1000,
      ),
    });
    await t.uc.notify(msg());
    expect(t.execute).toHaveBeenCalledTimes(1);
  });

  it('penulis sendiri dan pesan dihapus/sistem dilewati', async () => {
    const t = setup({ found: [{ id: 'author', username: 'budi', displayName: 'B' }] });
    await t.uc.notify(msg());
    expect(t.executeIfNew).not.toHaveBeenCalled();

    const t2 = setup();
    await t2.uc.notify(msg({ deletedAt: '2026-11-26T10:01:00Z' as never }));
    await t2.uc.notify(msg({ kind: 'system' }));
    expect(t2.findMentionableByUsernames).not.toHaveBeenCalled();
  });

  it('safe tidak melempar saat dependensi gagal', async () => {
    const t = setup();
    t.findMentionableByUsernames.mockRejectedValueOnce(new Error('db down'));
    await expect(t.uc.safe(msg())).resolves.toBeUndefined();
  });

  it('gagal di satu penerima tidak menghentikan penerima lain', async () => {
    const t = setup({
      found: [
        { id: 'a', username: 'aaa', displayName: 'A' },
        { id: 'b', username: 'bbb', displayName: 'B' },
      ],
    });
    t.executeIfNew.mockRejectedValueOnce(new Error('boom'));
    await t.uc.notify(msg({ body: '@aaa @bbb' }));
    expect(t.executeIfNew).toHaveBeenCalledTimes(2);
    expect(t.execute).toHaveBeenCalledTimes(1);
  });

  it('clear menghapus inbox mention untuk pesan itu', async () => {
    const t = setup();
    await t.uc.clear('m1');
    expect(t.deleteByTarget).toHaveBeenCalledWith({
      type: 'chat_mention',
      targetKind: 'chat',
      targetId: 'm1',
    });
  });
});
