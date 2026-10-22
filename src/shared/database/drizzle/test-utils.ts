import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "./client";
import { ensureTestDbReady } from "./test-client";
import {
  accountDeletionTokens,
  activityEvents,
  announcements,
  achievements,
  userAchievements,
  apiClients,
  appSettings,
  auditLogs,
  authIdentities,
  bookmarks,
  bugReports,
  categories,
  categorySuggestions,
  commentBlocklistWords,
  comments,
  contributionReviews,
  contributions,
  deviceTokens,
  dialects,
  emailVerificationOtps,
  examples,
  languages,
  legalDocuments,
  lexicalRelations,
  wordGroupMembers,
  wordGroups,
  meanings,
  meaningTranslations,
  notificationCampaignRecipients,
  notificationCampaigns,
  notificationTemplates,
  notificationPushCooldowns,
  notifications,
  passwordResetTokens,
  placeContributions,
  placeImages,
  placeViews,
  places,
  placeCategories,
  regions,
  pronunciations,
  refreshTokens,
  searchMisses,
  searchMissSearchers,
  discussionReplies,
  discussions,
  userConsents,
  userRoles,
  users,
  userSkips,
  ugcAbuseEvents,
  ugcAnonAbuseEvents,
  ugcAnonMutes,
  databaseBackupLogs,
  // WA admin (console #31) - log anak, sebelum template + usage
  waMessageLogs,
  waMessageTemplates,
  waUsage,
  verifierApplications,
  votes,
  wordAudios,
  wordCategories,
  wordClasses,
  wordEditSuggestions,
  wordImages,
  wordImportSessions,
  wordReports,
  wordCardShares,
  wordVoteCounts,
  wordVariants,
  words,
} from "./schema";
import { FIRST_PARTY_SCOPE_STRING } from "@/modules/developer-oauth/domain/entities/api-client.entity";

const LEGAL_VERSION = "2026-09-26";
const FIRST_PARTY_SCOPES_JSON = JSON.stringify(
  FIRST_PARTY_SCOPE_STRING.split(" "),
);

/**
 * Seed referensi yang wajib ada setelah truncate (register consent + login
 * first-party). Isi selaras migrasi 0020/0021/0025.
 */
export async function reseedTestReferenceData(db: AppDatabase): Promise<void> {
  const now = new Date();
  await db
    .insert(appSettings)
    .values([
      {
        key: "oauth.third_party_registration",
        value: "closed",
        updatedAt: now,
        updatedBy: null,
      },
      {
        key: "oauth.request_log_retention_days",
        value: "90",
        updatedAt: now,
        updatedBy: null,
      },
      {
        key: "legal.terms_version",
        value: LEGAL_VERSION,
        updatedAt: now,
        updatedBy: null,
      },
      {
        key: "legal.privacy_version",
        value: LEGAL_VERSION,
        updatedAt: now,
        updatedBy: null,
      },
      // Migrasi 0025 - cooldown push hasil review (default 6 jam)
      {
        key: "notification.review_approve_push_cooldown_minutes",
        value: "360",
        updatedAt: now,
        updatedBy: null,
      },
      {
        key: "notification.review_reject_push_cooldown_minutes",
        value: "360",
        updatedAt: now,
        updatedBy: null,
      },
      // Migrasi 0029 - cooldown push diskusi komentar (default 3 menit)
      {
        key: "notification.word_comment_push_cooldown_minutes",
        value: "3",
        updatedAt: now,
        updatedBy: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(legalDocuments)
    .values([
      {
        id: "01LEGALPRIVACY20260926001",
        documentType: "privacy",
        version: LEGAL_VERSION,
        title: "Kebijakan Privasi",
        bodyMarkdown: "# Kebijakan Privasi (test seed)",
        status: "published",
        publishedAt: now,
        createdBy: null,
        updatedBy: null,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: "01LEGALSTERMS202609260001",
        documentType: "terms",
        version: LEGAL_VERSION,
        title: "Syarat dan Ketentuan",
        bodyMarkdown: "# Syarat Ketentuan (test seed)",
        status: "published",
        publishedAt: now,
        createdBy: null,
        updatedBy: null,
        createdAt: now,
        updatedAt: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(apiClients)
    .values([
      {
        id: "01APICLIENTMOBILE000000001",
        clientId: "sambasku-mobile",
        clientSecretHash: null,
        name: "SambasKu Mobile",
        description: "Test seed",
        ownerUserId: null,
        status: "approved",
        isFirstParty: true,
        homepageUrl: null,
        privacyUrl: null,
        redirectUris: "[]",
        allowedScopes: FIRST_PARTY_SCOPES_JSON,
        allowedChannels: '["mobile"]',
        rateLimitTier: "first_party",
        createdAt: now,
        updatedAt: null,
      },
      {
        id: "01APICLIENTWEB00000000001",
        clientId: "sambasku-web",
        clientSecretHash: null,
        name: "SambasKu Web",
        description: "Test seed",
        ownerUserId: null,
        status: "approved",
        isFirstParty: true,
        homepageUrl: null,
        privacyUrl: null,
        redirectUris: "[]",
        allowedScopes: FIRST_PARTY_SCOPES_JSON,
        allowedChannels: '["web"]',
        rateLimitTier: "first_party",
        createdAt: now,
        updatedAt: null,
      },
      {
        id: "01APICLIENTCONSOLE00000001",
        clientId: "sambasku-console",
        clientSecretHash: null,
        name: "SambasKu Console",
        description: "Test seed",
        ownerUserId: null,
        status: "approved",
        isFirstParty: true,
        homepageUrl: null,
        privacyUrl: null,
        redirectUris: "[]",
        allowedScopes: FIRST_PARTY_SCOPES_JSON,
        allowedChannels: '["web"]',
        rateLimitTier: "first_party",
        createdAt: now,
        updatedAt: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(placeCategories)
    .values([
      {
        id: "wisata",
        name: "Wisata",
        sortOrder: 0,
        status: "published",
        createdAt: now,
      },
      {
        id: "kuliner",
        name: "Kuliner",
        sortOrder: 1,
        status: "published",
        createdAt: now,
      },
      {
        id: "budaya",
        name: "Budaya",
        sortOrder: 2,
        status: "published",
        createdAt: now,
      },
    ])
    .onConflictDoNothing();
}

// Hapus semua tabel dalam urutan aman FK (anak dulu) - pakai ini di
// beforeEach/beforeAll integration & e2e test, jangan delete per tabel.
export async function truncateAll(db: AppDatabase): Promise<void> {
  await ensureTestDbReady();
  // FK siklus users.active_border_id -> user_achievements.id -> users.id:
  // kosongkan dulu kolom border aktif SEBELUM hapus tabel manapun.
  await db.run(sql`update users set active_border_id = null`);
  for (const table of [
    auditLogs,
    wordReports,
    wordCardShares,
    bugReports,
    discussionReplies,
    discussions,
    contributionReviews,
    contributions,
    wordEditSuggestions,
    votes,
    userSkips,
    commentBlocklistWords,
    comments,
    bookmarks,
    notificationCampaignRecipients,
    notificationCampaigns,
    notificationTemplates,
    notificationPushCooldowns,
    notifications,
    deviceTokens,
    verifierApplications,
    waMessageLogs,
    waMessageTemplates,
    waUsage,
    lexicalRelations,
    // PRD relasi-lemma: anak word_groups (FK word_id) + grup (FK created_by) - sebelum words/users.
    wordGroupMembers,
    wordGroups,
    pronunciations,
    wordAudios,
    examples,
    meaningTranslations,
    passwordResetTokens,
    accountDeletionTokens,
    refreshTokens,
    authIdentities,
    emailVerificationOtps,
    // Anak search_misses (FK) - wajib sebelum search_misses di bawah.
    searchMissSearchers,
    searchMisses,
    wordCategories,
    wordImages,
    wordVoteCounts,
    wordVariants,
    meanings,
    words,
    // Anak users (FK proposed_by/reviewed_by) - sebelum users.
    categorySuggestions,
    categories,
    wordClasses,
    dialects,
    languages,
    wordImportSessions,
    // Ledger abuse (FK user_id) + backup logs - sebelum users
    ugcAbuseEvents,
    ugcAnonAbuseEvents,
    ugcAnonMutes,
    databaseBackupLogs,
    // Pengumuman admin (#102) (FK created_by) - sebelum users
    announcements,
    // Achievement (FK user_id) - sebelum users
    userAchievements,
    // Katalog achievement - sebelum userAchievements (FK achievement_id)
    achievements,
    // Places CRUD (FK place_images.place_id) - anak dulu
    placeContributions,
    placeImages,
    placeViews,
    places,
    placeCategories,
    regions,
    // Event feed publik (FK actor_id) - sebelum users
    activityEvents,
    // Legal / OAuth - harus sebelum users (FK created_by / user_id / owner)
    userConsents,
    legalDocuments,
    appSettings,
    apiClients,
    userRoles,
    users,
  ]) {
    await db.delete(table);
  }

  await reseedTestReferenceData(db);
}

/** Set roles user di fixture test (multi role, junction user_roles). */
export async function setRoles(
  db: AppDatabase,
  userId: string,
  roles: string[],
): Promise<void> {
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  if (roles.length === 0) return;
  await db
    .insert(userRoles)
    .values(roles.map((role) => ({ userId, role })))
    .onConflictDoNothing();
}
