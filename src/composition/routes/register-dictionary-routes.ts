/** Words, users, votes, contributions, search, achievements. */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import * as di from '../container';
import { publicImageController, wordReportController } from './shared-late-controllers';
import {
  createAdminWordViewsRoutes,
  createPublicWordViewsRoutes,
} from "@/modules/word/presentation/v1/word-views.routes";
import {
  createAdminWordRoutes,
  createPublicWordRoutes,
} from "@/modules/word/presentation/v1/word.routes";
import {
  createExampleSelfRoutes,
  createMeaningExampleRoutes,
  createWordMediaRoutes,
} from "@/modules/word/presentation/v1/word-media.routes";
import { createAnonContributionRoutes } from "@/modules/word/presentation/v1/anon-contribution.routes";
import { createWordClassRoutes } from "@/modules/word/presentation/v1/word-class.routes";
import { createLemmaMergeRoutes } from "@/modules/lemma-merge/presentation/v1/lemma-merge.routes";
import { createAdminLemmaMergeRoutes } from "@/modules/lemma-merge/presentation/v1/lemma-merge-admin.routes";
import {
  createWordSuggestionRoutes,
  createWordHistoryRoutes,
  createAdminSuggestionRoutes,
} from "@/modules/word-suggestions/presentation/v1/word-suggestions.routes";
import { createContributionRoutes } from "@/modules/contribution/presentation/v1/contribution.routes";
import { createMyContributionRoutes } from "@/modules/contribution/presentation/v1/my-contribution.routes";
import { createDuplicateConfirmRoutes } from "@/modules/contribution/presentation/v1/duplicate-confirm.routes";
import {
  createAdminSearchMissRoutes,
  createSearchMissRoutes,
} from "@/modules/search-miss/presentation/v1/search-miss.routes";
import { createHotTopicsRoutes } from "@/modules/hot-topics/presentation/v1/hot-topics.routes";
import {
  createAdminAnnouncementRoutes,
  createPublicAnnouncementRoutes,
} from "@/modules/announcement/presentation/v1/announcement.routes";
import {
  createAdminSponsorshipRoutes,
  createPublicAboutRoutes,
  createPublicAboutUserListRoutes,
} from "@/modules/about/presentation/v1/about.routes";
import { db } from "@/shared/database/drizzle/client";
import { CashflowService } from "@/modules/cashflow/application/cashflow.service";
import { createAdminCashflowRoutes } from "@/modules/cashflow/presentation/v1/cashflow.routes";
import {
  createAdminProfileCoverRoutes,
  createPublicProfileCoverRoutes,
} from "@/modules/profile-cover/presentation/v1/profile-cover.routes";
import { createAdminWordOfDayRoutes } from "@/modules/word/presentation/v1/word-of-day-admin.routes";
import {
  createAdminAchievementRoutes,
  createMyAchievementRoutes,
  createMyProfileBorderRoutes,
  createPublicAchievementRoutes,
  createPublicUserAchievementsRoutes,
} from "@/modules/achievement/presentation/v1/achievement.routes";
import {
  createAdminLeaderboardRoutes,
  createPublicLeaderboardRoutes,
} from "@/modules/leaderboard/presentation/v1/leaderboard.routes";
import { createWordReportRoutes } from "@/modules/word-report/presentation/v1/word-report.routes";
import { createVoteRoutes } from "@/modules/vote/presentation/v1/vote.routes";
import { createAdminVoteRoutes } from "@/modules/vote/presentation/v1/admin-vote.routes";
import { createAdminWordVotersRoutes } from "@/modules/vote/presentation/v1/word-voters.routes";
import {
  createCommentRoutes,
  createWordCommentRoutes,
} from "@/modules/comment/presentation/v1/comment.routes";
import { createAdminCommentRoutes } from "@/modules/comment/presentation/v1/admin-comment.routes";
import { createAdminExploreCommentRoutes } from "@/modules/comment/presentation/v1/admin-explore-comment.routes";
import { createAdminExplorePhotoRoutes } from "@/modules/public-image/presentation/v1/admin-explore-photo.routes";
import { createAdminCommentBlocklistRoutes } from "@/modules/comment-blocklist/presentation/v1/admin-comment-blocklist.routes";
import { createBookmarkRoutes } from "@/modules/bookmark/presentation/v1/bookmark.routes";
import {
  createMeAvatarRoutes,
  createMeProfileRoutes,
  createPublicUserRoutes,
} from "@/modules/user/presentation/v1/user.routes";
import { createPublicImageRoutes } from "@/modules/public-image/presentation/v1/public-image.routes";
import { createDeviceRoutes } from "@/modules/device/presentation/v1/device.routes";
import { ListMyNotificationsUseCase } from "@/modules/notification/application/use-cases/list-my-notifications.use-case";
import { GetUnreadNotificationCountUseCase } from "@/modules/notification/application/use-cases/get-unread-notification-count.use-case";
import { MarkNotificationReadUseCase } from "@/modules/notification/application/use-cases/mark-notification-read.use-case";
import { MarkAllNotificationsReadUseCase } from "@/modules/notification/application/use-cases/mark-all-notifications-read.use-case";
import { NotificationController } from "@/modules/notification/presentation/v1/notification.controller";
import { createNotificationRoutes } from "@/modules/notification/presentation/v1/notification.routes";

export function registerDictionaryRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {
  // Modul word - admin (write) + publik (read)
  // Views literal /views sebelum /:id di admin word routes.
  app.route(
    "/api/v1/admin/words",
    createAdminWordViewsRoutes({
      controller: di.wordViewsController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/words",
    createAdminWordRoutes({ controller: di.wordController, authenticate: di.authenticate }),
  );
  // Voter makna per kata (moderasi) - mount terpisah supaya modul vote tidak
  // digabung ke word.routes; path /:wordId/voters tidak bentrok dengan /:id.
  app.route(
    "/api/v1/admin/words",
    createAdminWordVotersRoutes({
      controller: di.wordVotersController,
      authenticate: di.authenticate,
    }),
  );
  // Kontribusi media (pronounce/gambar/contoh) DI-MOUNT SEBELUM public routes -
  // public punya rate limit IP 100/menit global (use '*'), limit per-user 30/menit
  // tetap jadi batas efektif; urutan mount menentukan middleware yang berlaku
  app.route(
    "/api/v1/words",
    createWordMediaRoutes({
      controller: di.wordController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
    }),
  );
  // Komentar per kata (09) - SEBELUM public word routes (pola media routes),
  // supaya /:wordId/comments tidak tertelan routes.use('*') rate limit publik
  app.route(
    "/api/v1/words",
    createWordCommentRoutes({
      controller: di.commentController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireCommentWriteClient,
      onUgcRateLimited: di.onUgcRateLimited,
    }),
  );
  app.route(
    "/api/v1/words",
    createWordReportRoutes({
      controller: wordReportController,
      authenticate: di.authenticate,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  // POST .../view sebelum GET /:id publik (path lebih spesifik).
  app.route(
    "/api/v1/words",
    createPublicWordViewsRoutes({
      controller: di.wordViewsController,
      softAuthenticate: di.softAuthenticate,
    }),
  );
  app.route(
    "/api/v1/words",
    createPublicWordRoutes({
      controller: di.wordController,
      authenticate: di.authenticate,
      softAuthenticate: di.softAuthenticate,
    }),
  );
  app.route(
    "/api/v1/words",
    createWordHistoryRoutes({ controller: di.suggestionController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/words",
    createLemmaMergeRoutes({
      controller: di.lemmaMergeController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
    }),
  );
  app.route(
    "/api/v1/words",
    createWordSuggestionRoutes({
      controller: di.suggestionController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  app.route(
    "/api/v1/admin",
    createAdminSuggestionRoutes({
      controller: di.suggestionController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin",
    createAdminLemmaMergeRoutes({
      controller: di.lemmaMergeController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/meanings",
    createMeaningExampleRoutes({
      controller: di.wordController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
    }),
  );
  app.route(
    "/api/v1/examples",
    createExampleSelfRoutes({
      controller: di.wordController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
    }),
  );
  app.route(
    "/api/v1/word-classes",
    createWordClassRoutes({ controller: di.wordController }),
  );

  // Vote polymorphic (08-api-upvote-downvote.md) - toggle (login) + counts
  // (publik) + my (login). Tanpa prefix bentrok, urutan mount bebas.
  app.route(
    "/api/v1/votes",
    createVoteRoutes({
      controller: di.voteController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireVoteWriteClient,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );

  // Komentar (09-api-comment.md): my + delete by author; admin takedown
  app.route(
    "/api/v1/comments",
    createCommentRoutes({
      controller: di.commentController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireCommentWriteClient,
      requireLegalConsent: di.requireLegalConsent,
      onUgcRateLimited: di.onUgcRateLimited,
    }),
  );

  // Bookmark kata per user (16-api-bookmark.md) - toggle + my (login, semua
  // role). Tanpa prefix bentrok, urutan mount bebas.
  app.route(
    "/api/v1/bookmarks",
    createBookmarkRoutes({
      controller: di.bookmarkController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireBookmarkWriteClient,
    }),
  );

  // Profil publik by username (19-api-profil-publik.md) - tanpa auth, rate
  // limit 100/menit/IP di routes factory. Tidak bentrok /admin/users.
  // Mount /me dulu supaya tidak tertangkap oleh /:username.
  app.route(
    "/api/v1/users/me",
    createMeProfileRoutes({
      controller: di.userController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireProfileWriteClient,
    }),
  );
  app.route(
    "/api/v1/users/me/avatar",
    createMeAvatarRoutes({
      controller: di.userController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireProfileWriteClient,
    }),
  );
  // Contributors/verifiers SEBELUM /:username (hindari bentrok path).
  app.route(
    "/api/v1/users",
    createPublicAboutUserListRoutes({ controller: di.aboutController }),
  );
  app.route(
    "/api/v1/users",
    createPublicUserRoutes({ controller: di.userController }),
  );
  // Badge profil: GET /api/v1/users/:username/achievements (kontrak mobile/Bruno).
  app.route(
    "/api/v1/users",
    createPublicUserAchievementsRoutes({ controller: di.achievementController }),
  );
  app.route(
    "/api/v1/about",
    createPublicAboutRoutes({ controller: di.aboutController }),
  );
  app.route(
    "/api/v1/about",
    createPublicProfileCoverRoutes({ controller: di.profileCoverController }),
  );
  app.route(
    "/api/v1/admin/profile-covers",
    createAdminProfileCoverRoutes({
      controller: di.profileCoverController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/word-of-day",
    createAdminWordOfDayRoutes({
      controller: di.wordOfDayAdminController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/cashflow",
    createAdminCashflowRoutes({
      service: new CashflowService(db),
      authenticate: di.authenticate,
    }),
  );

  app.route(
    "/api/v1/admin/sponsorships",
    createAdminSponsorshipRoutes({
      controller: di.aboutController,
      authenticate: di.authenticate,
    }),
  );

  app.route(
    "/api/v1/images",
    createPublicImageRoutes({
      controller: publicImageController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
    }),
  );
  app.route(
    "/api/v1/device",
    createDeviceRoutes({
      controller: di.deviceController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireDeviceWriteClient,
    }),
  );
  app.route(
    "/api/v1/notifications",
    createNotificationRoutes({
      controller: new NotificationController({
        list: new ListMyNotificationsUseCase(di.notificationRepo),
        unreadCount: new GetUnreadNotificationCountUseCase(di.notificationRepo),
        markRead: new MarkNotificationReadUseCase(di.notificationRepo),
        markAllRead: new MarkAllNotificationsReadUseCase(di.notificationRepo),
      }),
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/comments",
    createAdminCommentRoutes({ controller: di.commentController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/explore-comments",
    createAdminExploreCommentRoutes({
      service: di.adminExploreCommentService,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/explore-photos",
    createAdminExplorePhotoRoutes({
      service: di.adminExplorePhotoService,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/comment-blocklist",
    createAdminCommentBlocklistRoutes({
      controller: di.commentBlocklistController,
      authenticate: di.authenticate,
    }),
  );

  // Moderasi vote (hapus vote spam individual + reset massal per target),
  // gate role + rate limit ada di routes factory (root/admin/reviewer)
  app.route(
    "/api/v1/admin/votes",
    createAdminVoteRoutes({ controller: di.adminVotesController, authenticate: di.authenticate }),
  );

  // Antrean review kontribusi - hanya verifikator (Section 22)
  app.route(
    "/api/v1/admin/contributions",
    createContributionRoutes({
      controller: di.contributionController,
      authenticate: di.authenticate,
    }),
  );

  // Submit kata publik - rate limit IP/device untuk tamu; mute per sumber
  // (bukan ANONIM_USER_ID). Login → assertCanContribute.
  app.route(
    "/api/v1/contributions",
    createAnonContributionRoutes({
      controller: di.wordController,
      optionalAuthenticate: di.optionalAuthenticate,
      requireApprovedClient: di.requireContributeWriteIfAuthed,
      requireLegalConsent: di.requireLegalConsent,
      onAnonRateLimited: di.onAnonRateLimited,
    }),
  );
  app.route(
    "/api/v1/contributions",
    createMyContributionRoutes({
      controller: di.myContributionController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/contributions",
    createDuplicateConfirmRoutes({
      confirmDuplicate: di.confirmDuplicateMeaning,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireVoteWriteClient,
    }),
  );

  // Search miss - beranda publik (peluang kontribusi) + panel admin
  app.route(
    "/api/v1/search-misses",
    createSearchMissRoutes({ controller: di.searchMissController, authenticate: di.authenticate }),
  );
  // G4: kartu Hot Home (dicari / diusulkan / dekati ambang)
  app.route(
    "/api/v1/hot-topics",
    createHotTopicsRoutes({ controller: di.hotTopicsController }),
  );
  app.route(
    "/api/v1/admin/search-misses",
    createAdminSearchMissRoutes({
      controller: di.searchMissController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/announcements",
    createAdminAnnouncementRoutes({
      controller: di.announcementController,
      authenticate: di.authenticate,
    }),
  );
  // Publik: detail pengumuman by id (deep link mobile #102).
  app.route(
    "/api/v1/announcements",
    createPublicAnnouncementRoutes({ controller: di.announcementController }),
  );

  // Achievement (Pencapaian) - katalog reward, milik sendiri, border profil.
  // Badge publik: GET /api/v1/users/:username/achievements (mount di blok users).
  // Katalog: GET /api/v1/achievements. `/me/achievements` + `/me/profile/border`
  // butuh auth. Border TIDAK lewat /users/:username (hindari bentrok profil).
  app.route(
    "/api/v1/achievements",
    createPublicAchievementRoutes({ controller: di.achievementController }),
  );
  // Border profil: mount di `/api/v1/me/profile` + path `/border` =
  // PATCH /api/v1/me/profile/border (jangan mount dua-duanya "border").
  app.route(
    "/api/v1/me/achievements",
    createMyAchievementRoutes({
      controller: di.achievementController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/me/profile",
    createMyProfileBorderRoutes({
      controller: di.achievementController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/achievements",
    createAdminAchievementRoutes({
      controller: di.achievementController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/leaderboard",
    createPublicLeaderboardRoutes({
      controller: di.leaderboardController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/leaderboard",
    createAdminLeaderboardRoutes({
      controller: di.leaderboardController,
      authenticate: di.authenticate,
    }),
  );

}
