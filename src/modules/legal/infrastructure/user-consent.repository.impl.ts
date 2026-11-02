import { and, desc, eq } from 'drizzle-orm';
import { userConsents } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ConsentDocumentType,
  NewUserConsent,
  UserConsent,
} from '../domain/entities/user-consent.entity';
import type {
  DbExecutor,
  UserConsentRepository,
} from '../domain/repositories/user-consent.repository';

function toEntity(row: typeof userConsents.$inferSelect): UserConsent {
  return {
    id: row.id,
    userId: row.userId,
    documentType: row.documentType as ConsentDocumentType,
    documentVersion: row.documentVersion,
    acceptedAt: row.acceptedAt,
    source: row.source as UserConsent['source'],
    clientId: row.clientId,
    requestId: row.requestId,
    ip: row.ip,
    userAgent: row.userAgent,
  };
}

export class UserConsentRepositoryImpl implements UserConsentRepository {
  constructor(private readonly db: AppDatabase) {}

  async insertMany(rows: NewUserConsent[], executor: DbExecutor = this.db): Promise<UserConsent[]> {
    if (rows.length === 0) return [];
    const inserted = await executor
      .insert(userConsents)
      .values(
        rows.map((r) => ({
          userId: r.userId,
          documentType: r.documentType,
          documentVersion: r.documentVersion,
          source: r.source,
          clientId: r.clientId ?? null,
          requestId: r.requestId ?? null,
          ip: r.ip ?? null,
          userAgent: r.userAgent ?? null,
          acceptedAt: r.acceptedAt ?? new Date(),
        })),
      )
      .returning();
    return inserted.map(toEntity);
  }

  async findLatestByUser(
    userId: string,
    documentType: ConsentDocumentType,
  ): Promise<UserConsent | null> {
    const [row] = await this.db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.documentType, documentType),
        ),
      )
      .orderBy(desc(userConsents.acceptedAt))
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async findLatestByUserAll(
    userId: string,
  ): Promise<Partial<Record<ConsentDocumentType, UserConsent>>> {
    // Semua baris user, urut terbaru duluan; versi pertama per tipe menang.
    // ponytail: muat semua tipe (max beberapa baris/user) lalu dedupe di
    // memori. Kalau user terbukti punya ratusan baris consent, upgrade ke
    // window function MAX(accepted_at) per document_type.
    const rows = await this.db
      .select()
      .from(userConsents)
      .where(eq(userConsents.userId, userId))
      .orderBy(desc(userConsents.acceptedAt));
    const latest: Partial<Record<ConsentDocumentType, UserConsent>> = {};
    for (const row of rows) {
      const type = row.documentType as ConsentDocumentType;
      if (latest[type]) continue;
      latest[type] = toEntity(row);
    }
    return latest;
  }

  async deleteByUserId(userId: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.delete(userConsents).where(eq(userConsents.userId, userId));
  }
}
