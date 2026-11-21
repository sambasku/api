import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import {
  CHAT_CHANNEL_PUBLIC,
  CHAT_PING_BODY,
  CHAT_PING_COOLDOWN_SECONDS,
  type ChatMessage,
} from '@/modules/chat/domain/entities/chat-message.entity';
import type { ChatRepository } from '@/modules/chat/domain/repositories/chat.repository';
import type { ChatSupabaseMirror } from '@/modules/chat/infrastructure/chat-supabase-mirror';
import { NotFoundError, RateLimitedError } from '@/shared/errors/app-error';

export type ChatPingStatus = {
  availableAt: string | null;
  cooldownSeconds: number;
  lastPingAt: string | null;
};

function cooldownRemainingSeconds(lastPingAt: Date, now = new Date()): number {
  const elapsedMs = now.getTime() - lastPingAt.getTime();
  const remainMs = CHAT_PING_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainMs / 1000));
}

export class GetChatPingStatusUseCase {
  constructor(private readonly repo: ChatRepository) {}

  async execute(): Promise<ChatPingStatus> {
    const last = await this.repo.findLatestPing(CHAT_CHANNEL_PUBLIC);
    if (!last) {
      return {
        availableAt: null,
        cooldownSeconds: CHAT_PING_COOLDOWN_SECONDS,
        lastPingAt: null,
      };
    }
    const remain = cooldownRemainingSeconds(last.createdAt);
    if (remain <= 0) {
      return {
        availableAt: null,
        cooldownSeconds: CHAT_PING_COOLDOWN_SECONDS,
        lastPingAt: last.createdAt.toISOString(),
      };
    }
    const availableAt = new Date(
      last.createdAt.getTime() + CHAT_PING_COOLDOWN_SECONDS * 1000,
    ).toISOString();
    return {
      availableAt,
      cooldownSeconds: CHAT_PING_COOLDOWN_SECONDS,
      lastPingAt: last.createdAt.toISOString(),
    };
  }
}

export class SendChatPingUseCase {
  constructor(
    private readonly repo: ChatRepository,
    private readonly userRepo: UserRepository,
    private readonly mirror: ChatSupabaseMirror,
    private readonly activityEvents?: Pick<RecordActivityEventUseCase, 'safe'>,
  ) {}

  async execute(userId: string): Promise<{ message: ChatMessage; status: ChatPingStatus }> {
    await assertCanContribute(userId);

    const last = await this.repo.findLatestPing(CHAT_CHANNEL_PUBLIC);
    if (last) {
      const remain = cooldownRemainingSeconds(last.createdAt);
      if (remain > 0) {
        throw new RateLimitedError(
          `Ping baru saja dikirim. Coba lagi sekitar ${Math.ceil(remain / 60)} menit lagi ya.`,
          remain,
        );
      }
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'Akun tidak ditemukan');
    }

    const created = await this.repo.create({
      channel: CHAT_CHANNEL_PUBLIC,
      userId,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl ?? null,
      kind: 'system',
      body: CHAT_PING_BODY,
      stickerId: null,
      replyToId: null,
      replySnippet: null,
      replyUsername: null,
    });
    await this.mirror.upsert(created);

    await this.activityEvents?.safe({
      kind: 'chat_ping',
      actorId: userId,
      targetId: CHAT_CHANNEL_PUBLIC,
      occurredAt: created.createdAt,
    });

    const availableAt = new Date(
      created.createdAt.getTime() + CHAT_PING_COOLDOWN_SECONDS * 1000,
    ).toISOString();

    return {
      message: created,
      status: {
        availableAt,
        cooldownSeconds: CHAT_PING_COOLDOWN_SECONDS,
        lastPingAt: created.createdAt.toISOString(),
      },
    };
  }
}