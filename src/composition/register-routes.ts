/** Mount route + late controllers yang bergantung pada container. */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import * as di from './container';
import { env } from "@/shared/config/env";
import { db } from "@/shared/database/drizzle/client";
import {
  CreateAdminApiClientUseCase,
  GetAdminApiClientUseCase,
  ListAdminApiClientsUseCase,
  UpdateAdminApiClientUseCase,
} from "@/modules/developer-oauth/application/use-cases/admin-api-client.use-cases";
import { AdminApiClientController } from "@/modules/developer-oauth/presentation/v1/admin-api-client.controller";
import { createAdminApiClientRoutes } from "@/modules/developer-oauth/presentation/v1/admin-api-client.routes";
import { GithubActionsDispatchService } from "@/modules/system/infrastructure/github-actions-dispatch";
import { DatabaseBackupLogRepositoryImpl } from "@/modules/system/infrastructure/database-backup-log.repository.impl";
import { SupabaseHealthCheckRepositoryImpl } from "@/modules/system/infrastructure/supabase-health-check.repository.impl";
import { TriggerSqliteBackupUseCase } from "@/modules/system/application/use-cases/trigger-sqlite-backup.use-case";
import { ListDatabaseBackupLogsUseCase } from "@/modules/system/application/use-cases/list-database-backup-logs.use-case";
import { ListSupabaseHealthChecksUseCase } from "@/modules/system/application/use-cases/list-supabase-health-checks.use-case";
import { TriggerSupabaseHealthCheckUseCase } from "@/modules/system/application/use-cases/trigger-supabase-health-check.use-case";
import { SystemDatabaseController } from "@/modules/system/presentation/v1/system-database.controller";
import { createSystemDatabaseRoutes } from "@/modules/system/presentation/v1/system-database.routes";
import { SystemSupabaseController } from "@/modules/system/presentation/v1/system-supabase.controller";
import { createSystemSupabaseRoutes } from "@/modules/system/presentation/v1/system-supabase.routes";
import { MobileReleaseRepositoryImpl } from "@/modules/mobile-release/infrastructure/mobile-release.repository.impl";
import {
  GetLatestMobileReleaseUseCase,
  ListMobileReleasesUseCase,
  UpsertMobileReleaseUseCase,
} from "@/modules/mobile-release/application/use-cases/mobile-release.use-cases";
import { MobileReleaseController } from "@/modules/mobile-release/presentation/v1/mobile-release.controller";
import {
  createMobileReleasePublicRoutes,
  createMobileReleaseAdminRoutes,
} from "@/modules/mobile-release/presentation/v1/mobile-release.routes";
import { createEmailAdminRoutes } from "@/modules/email/presentation/v1/email-admin.routes";
import {
  GetCurrentLegalUseCase,
  GetLegalDocumentUseCase,
} from "@/modules/legal/application/use-cases/get-legal.use-cases";
import {
  ArchiveLegalDocumentUseCase,
  CreateLegalDocumentDraftUseCase,
  ListAdminLegalDocumentsUseCase,
  PublishLegalDocumentUseCase,
  UpdateLegalDocumentDraftUseCase,
} from "@/modules/legal/application/use-cases/admin-legal.use-cases";
import {
  GetAppSettingsUseCase,
  UpdateAppSettingsUseCase,
} from "@/modules/legal/application/use-cases/app-settings.use-cases";
import { AcceptLegalUseCase } from "@/modules/legal/application/use-cases/accept-legal.use-case";
import { LegalController } from "@/modules/legal/presentation/v1/legal.controller";
import {
  createAdminLegalRoutes,
  createLegalAuthRoutes,
  createLegalPublicRoutes,
} from "@/modules/legal/presentation/v1/legal.routes";
import { AccountDeletionUseCase } from "@/modules/auth/application/use-cases/account-deletion.use-case";
import { AccountErasureRepositoryImpl } from "@/modules/auth/infrastructure/account-erasure.repository.impl";
import { AccountDeletionTokenRepositoryImpl } from "@/modules/auth/infrastructure/account-deletion-token.repository.impl";
import { createAuthRoutes } from "@/modules/auth/presentation/v1/auth.routes";
import { ListAdminUsersUseCase } from "@/modules/auth/application/use-cases/list-admin-users.use-case";
import { UpdateUserRoleUseCase } from "@/modules/auth/application/use-cases/update-user-role.use-case";
import { AdminUsersController } from "@/modules/auth/presentation/v1/admin-user.controller";
import { SetCanContributeUseCase } from "@/modules/auth/application/use-cases/set-can-contribute.use-case";
import { CreateAdminUserUseCase } from "@/modules/auth/application/use-cases/create-admin-user.use-case";
import { SetUserActiveUseCase } from "@/modules/auth/application/use-cases/set-user-active.use-case";
import { AdminVerifyEmailUseCase } from "@/modules/auth/application/use-cases/admin-verify-email.use-case";
import { ListUserAbuseEventsUseCase } from "@/modules/auth/application/use-cases/list-user-abuse-events.use-case";
import {
  createAdminUserRoutes,
  createContributionAccessRoutes,
} from "@/modules/auth/presentation/v1/admin-user.routes";
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
import {
  createAdminPlaceRoutes,
  createPublicPlaceRoutes,
} from "@/modules/place/presentation/v1/place.routes";
import {
  createAdminPlaceCommentRoutes,
  createPublicPlaceCommentRoutes,
} from "@/modules/place/presentation/v1/place-comment.routes";
import {
  createAdminPlaceContributionRoutes,
  createPlaceContributionRoutes,
} from "@/modules/place-contribution/presentation/v1/place-contribution.routes";
import {
  createAdminEventRoutes,
  createAdminEventCommentRoutes,
  createPublicEventRoutes,
  createUserEventImageRoutes,
  createPublicEventCommentRoutes,
} from "@/modules/event/presentation/v1/event.routes";
import {
  createAdminEventContributionRoutes,
  createEventContributionRoutes,
} from "@/modules/event-contribution/presentation/v1/event-contribution.routes";
import {
  createAdminEventGoingRoutes,
  createEventGoingRoutes,
} from "@/modules/event-going/presentation/v1/event-going.routes";
import {
  createAdminPlaceVisitRoutes,
  createPlaceVisitRoutes,
} from "@/modules/place-visit/presentation/v1/place-visit.routes";
import {
  createAdminUsahaVisitRoutes,
  createUsahaVisitRoutes,
} from "@/modules/usaha-visit/presentation/v1/usaha-visit.routes";
// Fitur Usaha (PRD usaha): direktori usaha + usulan + klaim + laporan.
import {
  createAdminUsahaCategoryRoutes,
  createPublicUsahaCategoryRoutes,
} from "@/modules/usaha-category/presentation/v1/usaha-category.routes";
import {
  createAdminUsahaRoutes,
  createPublicUsahaRoutes,
} from "@/modules/usaha/presentation/v1/usaha.routes";
import {
  createAdminUsahaViewsRoutes,
  createPublicUsahaViewsRoutes,
} from "@/modules/usaha/presentation/v1/usaha-views.routes";
import {
  createAdminUsahaCommentRoutes,
  createPublicUsahaCommentRoutes,
} from "@/modules/usaha/presentation/v1/usaha-comment.routes";
import { createUsahaMineRoutes } from "@/modules/usaha/presentation/v1/usaha-mine.routes";
import {
  createAdminUsahaContributionRoutes,
  createUsahaContributionRoutes,
} from "@/modules/usaha-contribution/presentation/v1/usaha-contribution.routes";
import {
  createAdminLayananContributionRoutes,
  createAdminLayananRoutes,
  createLayananContributionRoutes,
  createPublicLayananRoutes,
} from "@/modules/layanan/presentation/v1/layanan.routes";
import {
  createAdminKaryaContributionRoutes,
  createAdminKaryaRoutes,
  createKaryaContributionRoutes,
  createPublicKaryaRoutes,
} from "@/modules/karya/presentation/v1/karya.routes";
import {
  createKaryaExcerptLemmaLinkRoutes,
  createKaryaLemmaLinkDeleteRoutes,
} from "@/modules/karya/presentation/v1/karya-lemma-link.routes";
import {
  createAdminKaryaCreditLinkRoutes,
  createAdminKreatorClaimRoutes,
  createAdminKreatorRoutes,
  createAuthKreatorClaimRoutes,
  createMineKreatorClaimRoutes,
  createPublicKreatorRoutes,
} from "@/modules/kreator/presentation/v1/kreator.routes";
import {
  createAdminBalehoRoutes,
  createAuthBalehoRoutes,
  createPublicBalehoRoutes,
} from "@/modules/baleho/presentation/v1/baleho.routes";
import {
  createAdminUsahaClaimRoutes,
  createUsahaClaimRoutes,
} from "@/modules/usaha-claim/presentation/v1/usaha-claim.routes";
import {
  createAdminUsahaReportRoutes,
  createUsahaReportRoutes,
} from "@/modules/usaha-report/presentation/v1/usaha-report.routes";
// Fitur Kuliner (PRD kuliner): jelajah kuliner + tempat + usulan + klaim + laporan.
import {
  createAdminCulinaryCategoryRoutes,
  createPublicCulinaryCategoryRoutes,
} from "@/modules/culinary-category/presentation/v1/culinary-category.routes";
import {
  createAdminCulinaryRoutes,
  createPublicCulinaryRoutes,
} from "@/modules/culinary/presentation/v1/culinary.routes";
import {
  createAdminCuisineViewsRoutes,
  createPublicCuisineViewsRoutes,
} from "@/modules/culinary/presentation/v1/cuisine-views.routes";
import {
  createAdminCuisineCommentRoutes,
  createPublicCuisineCommentRoutes,
} from "@/modules/culinary/presentation/v1/cuisine-comment.routes";
import {
  createAdminCulinaryContributionRoutes,
  createCulinaryContributionRoutes,
} from "@/modules/culinary-contribution/presentation/v1/culinary-contribution.routes";
import {
  createAdminCulinaryClaimRoutes,
  createCulinaryClaimRoutes,
} from "@/modules/culinary-claim/presentation/v1/culinary-claim.routes";
import {
  createAdminCulinaryReportRoutes,
  createCulinaryReportRoutes,
} from "@/modules/culinary-report/presentation/v1/culinary-report.routes";
import {
  createAdminPlaceCategoryRoutes,
  createPublicPlaceCategoryRoutes,
} from "@/modules/place-category/presentation/v1/place-category.routes";
import { createWordGroupRoutes } from "@/modules/word-group/presentation/v1/word-group.routes";
import {
  createAdminRegionRoutes,
  createPublicRegionRoutes,
} from "@/modules/region/presentation/v1/region.routes";
import {
  createDialectRoutes,
  createLanguageRoutes,
} from "@/modules/language/presentation/v1/language.routes";
import { createCategoryRoutes } from "@/modules/category/presentation/v1/category.routes";
import { ListAuditLogsUseCase } from "@/modules/audit/application/use-cases/list-audit-logs.use-case";
import { AuditController } from "@/modules/audit/presentation/v1/audit.controller";
import { createAuditRoutes } from "@/modules/audit/presentation/v1/audit.routes";
import { AbuseController } from "@/modules/abuse/presentation/v1/abuse.controller";
import { createAbuseRoutes } from "@/modules/abuse/presentation/v1/abuse.routes";
import { LiftAbuseMuteUseCase } from "@/modules/abuse/application/use-cases/lift-abuse-mute.use-case";
import { CreateUploadCredentialsUseCase } from "@/modules/image/application/use-cases/create-upload-credentials.use-case";
import { ImageController } from "@/modules/image/presentation/v1/image.controller";
import { createImageRoutes } from "@/modules/image/presentation/v1/image.routes";
import { CreateWordReportUseCase } from "@/modules/word-report/application/use-cases/create-word-report.use-case";
import { ListWordReportsUseCase } from "@/modules/word-report/application/use-cases/list-word-reports.use-case";
import {
  ResolveWordReportUseCase,
  TakedownWordReportUseCase,
  RemoveMeaningWordReportUseCase,
  FlagViolentImageReportUseCase,
} from "@/modules/word-report/application/use-cases/resolve-word-report.use-case";
import { SetWordImageContentWarningsUseCase } from "@/modules/word/application/use-cases/set-word-image-content-warnings.use-case";
import { WordReportController } from "@/modules/word-report/presentation/v1/word-report.controller";
import { createWordReportRoutes } from "@/modules/word-report/presentation/v1/word-report.routes";
import { createAdminWordReportRoutes } from "@/modules/word-report/presentation/v1/admin-word-report.routes";
import { BugReportRepositoryImpl } from "@/modules/bug-report/infrastructure/bug-report.repository.impl";
import { CreateBugReportUseCase } from "@/modules/bug-report/application/use-cases/create-bug-report.use-case";
import { ListBugReportsUseCase } from "@/modules/bug-report/application/use-cases/list-bug-reports.use-case";
import { ResolveBugReportUseCase } from "@/modules/bug-report/application/use-cases/resolve-bug-report.use-case";
import { BugReportController } from "@/modules/bug-report/presentation/v1/bug-report.controller";
import { createBugReportRoutes } from "@/modules/bug-report/presentation/v1/bug-report.routes";
import { ResolveMapsUrlUseCase } from "@/modules/geo/application/resolve-maps-url.use-case";
import { GeoController } from "@/modules/geo/presentation/v1/geo.controller";
import { createGeoRoutes } from "@/modules/geo/presentation/v1/geo.routes";
import { createCategorySuggestionModule } from "@/modules/category-suggestion/factories/category-suggestion.factory";
import {
  createAdminCategorySuggestionRoutes,
  createCategorySuggestionRoutes,
} from "@/modules/category-suggestion/presentation/v1/category-suggestion.routes";
import { createAdminBugReportRoutes } from "@/modules/bug-report/presentation/v1/admin-bug-report.routes";
import { DiscussionRepositoryImpl } from "@/modules/discussion/infrastructure/discussion.repository.impl";
import { CreateDiscussionUseCase } from "@/modules/discussion/application/use-cases/create-discussion.use-case";
import { ListPublishedDiscussionsUseCase } from "@/modules/discussion/application/use-cases/list-published-discussions.use-case";
import { ListMyDiscussionsUseCase } from "@/modules/discussion/application/use-cases/list-my-discussions.use-case";
import { GetDiscussionDetailUseCase } from "@/modules/discussion/application/use-cases/get-discussion-detail.use-case";
import { ListAdminDiscussionsUseCase } from "@/modules/discussion/application/use-cases/list-admin-discussions.use-case";
import { ApproveDiscussionUseCase } from "@/modules/discussion/application/use-cases/approve-discussion.use-case";
import { RejectDiscussionUseCase } from "@/modules/discussion/application/use-cases/reject-discussion.use-case";
import { TakedownDiscussionUseCase } from "@/modules/discussion/application/use-cases/takedown-discussion.use-case";
import { CreateDiscussionReplyUseCase } from "@/modules/discussion/application/use-cases/create-discussion-reply.use-case";
import { CreateDiscussionReplyAudioUseCase } from "@/modules/discussion/application/use-cases/create-discussion-reply-audio.use-case";
import { AttachDiscussionAudioUseCase } from "@/modules/discussion/application/use-cases/attach-discussion-audio.use-case";
import { DeleteDiscussionReplyUseCase } from "@/modules/discussion/application/use-cases/delete-discussion-reply.use-case";
import { DeleteDiscussionUseCase } from "@/modules/discussion/application/use-cases/delete-discussion.use-case";
import { UpdateDiscussionReplyUseCase } from "@/modules/discussion/application/use-cases/update-discussion-reply.use-case";
import { UpdateDiscussionUseCase } from "@/modules/discussion/application/use-cases/update-discussion.use-case";
import { GetDiscussionReplyEditHistoryUseCase } from "@/modules/discussion/application/use-cases/get-discussion-reply-edit-history.use-case";
import { GetDiscussionEditHistoryUseCase } from "@/modules/discussion/application/use-cases/get-discussion-edit-history.use-case";
import { PinDiscussionReplyUseCase } from "@/modules/discussion/application/use-cases/pin-discussion-reply.use-case";
import { TakedownDiscussionReplyUseCase } from "@/modules/discussion/application/use-cases/takedown-discussion-reply.use-case";
import { CreateDiscussionLemmaLinkUseCase } from "@/modules/discussion/application/use-cases/create-discussion-lemma-link.use-case";
import { ListDiscussionLemmaLinksUseCase } from "@/modules/discussion/application/use-cases/list-discussion-lemma-links.use-case";
import { ProposeDiscussionLemmaCorrectionUseCase } from "@/modules/discussion/application/use-cases/propose-discussion-lemma-correction.use-case";
import { ResolveDiscussionLemmaCorrectionUseCase } from "@/modules/discussion/application/use-cases/resolve-discussion-lemma-correction.use-case";
import { DeleteDiscussionLemmaLinkUseCase } from "@/modules/discussion/application/use-cases/delete-discussion-lemma-link.use-case";
import { DiscussionController } from "@/modules/discussion/presentation/v1/discussion.controller";
import { createDiscussionRoutes } from "@/modules/discussion/presentation/v1/discussion.routes";
import { createAdminDiscussionRoutes } from "@/modules/discussion/presentation/v1/admin-discussion.routes";
import { ChatRepositoryImpl } from "@/modules/chat/infrastructure/chat.repository.impl";
import { ChatSupabaseMirrorService } from "@/modules/chat/infrastructure/chat-supabase-mirror";
import {
  CreateChatMessageUseCase,
  CreateChatVoiceNoteUseCase,
  DeleteChatMessageUseCase,
  EditChatMessageUseCase,
  GetChatCapabilitiesUseCase,
  ListChatMessagesUseCase,
  ListChatRevisionsUseCase,
} from "@/modules/chat/application/use-cases/chat.use-cases";
import { ChatController } from "@/modules/chat/presentation/v1/chat.controller";
import { createChatRoutes } from "@/modules/chat/presentation/v1/chat.routes";
import {
  createAdminStickerRoutes,
  createPublicStickerRoutes,
} from "@/modules/sticker/presentation/v1/sticker.routes";
import { MintVoiceTokenUseCase } from "@/modules/voice/application/mint-voice-token.use-case";
import { RecordVoiceRoomEventUseCase } from "@/modules/voice/application/record-voice-room-event.use-case";
import { VoiceRoomEventsRepository } from "@/modules/voice/infrastructure/voice-room-events.repository";
import { VoiceController } from "@/modules/voice/presentation/v1/voice.controller";
import { createVoiceRoutes } from "@/modules/voice/presentation/v1/voice.routes";
import { PantunRepositoryImpl } from "@/modules/pantun/infrastructure/pantun.repository.impl";
import { PantunReportRepositoryImpl } from "@/modules/pantun-report/infrastructure/pantun-report.repository.impl";
import { SubmitPantunReportUseCase } from "@/modules/pantun-report/application/use-cases/submit-pantun-report.use-case";
import { ListPantunReportsUseCase } from "@/modules/pantun-report/application/use-cases/list-pantun-reports.use-case";
import { ResolvePantunReportUseCase } from "@/modules/pantun-report/application/use-cases/resolve-pantun-report.use-case";
import { PantunReportController } from "@/modules/pantun-report/presentation/v1/pantun-report.controller";
import {
  createPantunReportRoutes,
  createAdminPantunReportRoutes,
} from "@/modules/pantun-report/presentation/v1/pantun-report.routes";
// Ensiklopedia (artikel + kontribusi + komentar + laporan)
import { EncyclopediaRepositoryImpl } from "@/modules/encyclopedia/infrastructure/encyclopedia.repository.impl";
import {
  CreateArticleUseCase,
  GetArticleBySlugUseCase,
  ListArticleRevisionsUseCase,
  ListArticlesUseCase,
  ListEncyclopediaCategoriesUseCase,
  MergeTagUseCase,
  RestoreArticleRevisionUseCase,
  SearchArticlesUseCase,
  SetArticleStatusUseCase,
  UpdateArticleUseCase,
} from "@/modules/encyclopedia/application/use-cases/article.use-cases";
import {
  CreateArticleCommentUseCase,
  DeleteArticleCommentUseCase,
  ListArticleCommentsUseCase,
  ListArticleContributionsUseCase,
  ListMyArticleContributionsUseCase,
  ResubmitArticleContributionUseCase,
  ReviewArticleContributionUseCase,
  SubmitArticleContributionUseCase,
  TakedownArticleCommentUseCase,
  ToggleArticleBookmarkUseCase,
  UpdateArticleCommentUseCase,
} from "@/modules/encyclopedia/application/use-cases/encyclopedia-contribution.use-cases";
import { ArticleReportUseCases } from "@/modules/encyclopedia/application/use-cases/article-report.use-cases";
import { CreateArticleCommentAudioUseCase } from "@/modules/encyclopedia/application/use-cases/article-comment-audio.use-case";
import { EncyclopediaController } from "@/modules/encyclopedia/presentation/v1/encyclopedia.controller";
import {
  createAdminEncyclopediaRoutes,
  createEncyclopediaRoutes,
} from "@/modules/encyclopedia/presentation/v1/encyclopedia.routes";
import {
  GetArticleViewReportUseCase,
  ListArticleViewsUseCase,
  RecordArticleViewBySlugUseCase,
} from "@/modules/encyclopedia/application/use-cases/article-views.use-cases";
import { ArticleViewsRepositoryImpl } from "@/modules/encyclopedia/infrastructure/article-views.repository.impl";
import { ArticleViewsController } from "@/modules/encyclopedia/presentation/v1/article-views.controller";
import {
  createAdminArticleViewsRoutes,
  createPublicArticleViewsRoutes,
} from "@/modules/encyclopedia/presentation/v1/article-views.routes";
import { CreatePantunUseCase } from "@/modules/pantun/application/use-cases/create-pantun.use-case";
import { CreatePantunWithAudioUseCase } from "@/modules/pantun/application/use-cases/create-pantun-with-audio.use-case";
import { CreatePantunReplyUseCase } from "@/modules/pantun/application/use-cases/create-pantun-reply.use-case";
import { CreatePantunReplyWithAudioUseCase } from "@/modules/pantun/application/use-cases/create-pantun-reply-with-audio.use-case";
import { ListPublishedPantunsUseCase } from "@/modules/pantun/application/use-cases/list-published-pantuns.use-case";
import { GetPantunDetailUseCase } from "@/modules/pantun/application/use-cases/get-pantun-detail.use-case";
import { TakedownPantunUseCase } from "@/modules/pantun/application/use-cases/takedown-pantun.use-case";
import { TakedownPantunReplyUseCase } from "@/modules/pantun/application/use-cases/takedown-pantun-reply.use-case";
import { DeletePantunReplyUseCase } from "@/modules/pantun/application/use-cases/delete-pantun-reply.use-case";
import { UpdatePantunReplyUseCase } from "@/modules/pantun/application/use-cases/update-pantun-reply.use-case";
import { GetPantunReplyEditHistoryUseCase } from "@/modules/pantun/application/use-cases/get-pantun-reply-edit-history.use-case";
import { DeletePantunUseCase } from "@/modules/pantun/application/use-cases/delete-pantun.use-case";
import { ListAdminPantunsUseCase } from "@/modules/pantun/application/use-cases/list-admin-pantuns.use-case";
import { SearchPantunsUseCase } from "@/modules/pantun/application/use-cases/search-pantuns.use-case";
import { PantunController } from "@/modules/pantun/presentation/v1/pantun.controller";
import { createPantunRoutes } from "@/modules/pantun/presentation/v1/pantun.routes";
import { createAdminPantunRoutes } from "@/modules/pantun/presentation/v1/admin-pantun.routes";
import { JinyeRepositoryImpl } from "@/modules/jinye/infrastructure/jinye.repository.impl";
import { CreateJinyeUseCase } from "@/modules/jinye/application/use-cases/create-jinye.use-case";
import { ListPublishedJinyeUseCase } from "@/modules/jinye/application/use-cases/list-published-jinye.use-case";
import { GetJinyeDetailUseCase } from "@/modules/jinye/application/use-cases/get-jinye-detail.use-case";
import { DeleteJinyeUseCase } from "@/modules/jinye/application/use-cases/delete-jinye.use-case";
import { AttachJinyeAudioUseCase } from "@/modules/jinye/application/use-cases/attach-jinye-audio.use-case";
import { CreateJinyeCommentUseCase } from "@/modules/jinye/application/use-cases/create-jinye-comment.use-case";
import { ListJinyeCommentsUseCase } from "@/modules/jinye/application/use-cases/list-jinye-comments.use-case";
import { DeleteJinyeCommentUseCase } from "@/modules/jinye/application/use-cases/delete-jinye-comment.use-case";
import { UpdateJinyeCommentUseCase } from "@/modules/jinye/application/use-cases/update-jinye-comment.use-case";
import { GetJinyeCommentEditHistoryUseCase } from "@/modules/jinye/application/use-cases/get-jinye-comment-edit-history.use-case";
import { ArchiveJinyeUseCase } from "@/modules/jinye/application/use-cases/archive-jinye.use-case";
import { UnarchiveJinyeUseCase } from "@/modules/jinye/application/use-cases/unarchive-jinye.use-case";
import { PinJinyeUseCase } from "@/modules/jinye/application/use-cases/pin-jinye.use-case";
import { UnpinJinyeUseCase } from "@/modules/jinye/application/use-cases/unpin-jinye.use-case";
import { ListArchivedJinyeUseCase } from "@/modules/jinye/application/use-cases/list-archived-jinye.use-case";
import { CreateJinyeLemmaLinkUseCase } from "@/modules/jinye/application/use-cases/create-jinye-lemma-link.use-case";
import { ListJinyeLemmaLinksUseCase } from "@/modules/jinye/application/use-cases/list-jinye-lemma-links.use-case";
import { ProposeJinyeLemmaCorrectionUseCase } from "@/modules/jinye/application/use-cases/propose-jinye-lemma-correction.use-case";
import { ResolveJinyeLemmaCorrectionUseCase } from "@/modules/jinye/application/use-cases/resolve-jinye-lemma-correction.use-case";
import { DeleteJinyeLemmaLinkUseCase } from "@/modules/jinye/application/use-cases/delete-jinye-lemma-link.use-case";
import { PromoteJinyeExampleUseCase } from "@/modules/jinye/application/use-cases/promote-jinye-example.use-case";
import { UpdateJinyeUseCase } from "@/modules/jinye/application/use-cases/update-jinye.use-case";
import { CreateTranslationUseCase } from "@/modules/translation/application/use-cases/create-translation.use-case";
import { ListTranslationsUseCase } from "@/modules/translation/application/use-cases/list-translations.use-case";
import { ResolveTranslationUseCase } from "@/modules/translation/application/use-cases/resolve-translation.use-case";
import { TranslationController } from "@/modules/translation/presentation/v1/translation.controller";
import { createTranslationRoutes } from "@/modules/translation/presentation/v1/translation.routes";
import { GetJinyeEditHistoryUseCase } from "@/modules/jinye/application/use-cases/get-jinye-edit-history.use-case";
import { RepostJinyeUseCase } from "@/modules/jinye/application/use-cases/repost-jinye.use-case";
import { UnrepostJinyeUseCase } from "@/modules/jinye/application/use-cases/unrepost-jinye.use-case";
import { QuoteJinyeUseCase } from "@/modules/jinye/application/use-cases/quote-jinye.use-case";
import { ListAdminJinyeUseCase } from "@/modules/jinye/application/use-cases/list-admin-jinye.use-case";
import { TakedownJinyeUseCase } from "@/modules/jinye/application/use-cases/takedown-jinye.use-case";
import { TakedownJinyeCommentUseCase } from "@/modules/jinye/application/use-cases/takedown-jinye-comment.use-case";
import { JinyeController } from "@/modules/jinye/presentation/v1/jinye.controller";
import { createJinyeRoutes } from "@/modules/jinye/presentation/v1/jinye.routes";
import { createAdminJinyeRoutes } from "@/modules/jinye/presentation/v1/admin-jinye.routes";
import { JinyeReportRepositoryImpl } from "@/modules/jinye-report/infrastructure/jinye-report.repository.impl";
import { SubmitJinyeReportUseCase } from "@/modules/jinye-report/application/use-cases/submit-jinye-report.use-case";
import { ListJinyeReportsUseCase } from "@/modules/jinye-report/application/use-cases/list-jinye-reports.use-case";
import { ResolveJinyeReportUseCase } from "@/modules/jinye-report/application/use-cases/resolve-jinye-report.use-case";
import { JinyeReportController } from "@/modules/jinye-report/presentation/v1/jinye-report.controller";
import {
  createAdminJinyeReportRoutes,
  createJinyeReportRoutes,
} from "@/modules/jinye-report/presentation/v1/jinye-report.routes";
import { createDashboardRoutes } from "@/modules/dashboard/presentation/v1/dashboard.routes";
import { createWebAnalyticsRoutes } from "@/modules/web-analytics/presentation/v1/web-analytics.routes";
import { createPlayAnalyticsRoutes } from "@/modules/play-analytics/presentation/v1/play-analytics.routes";
import { createFcmAnalyticsRoutes } from "@/modules/fcm-analytics/presentation/v1/fcm-analytics.routes";
import { createMobileAnalyticsRoutes } from "@/modules/mobile-analytics/presentation/v1/mobile-analytics.routes";
import { createVoteRoutes } from "@/modules/vote/presentation/v1/vote.routes";
import { createAdminVoteRoutes } from "@/modules/vote/presentation/v1/admin-vote.routes";
import { createAdminWordVotersRoutes } from "@/modules/vote/presentation/v1/word-voters.routes";
import {
  createCommentRoutes,
  createWordCommentRoutes,
} from "@/modules/comment/presentation/v1/comment.routes";
import { createAdminCommentRoutes } from "@/modules/comment/presentation/v1/admin-comment.routes";
import { createAdminCommentBlocklistRoutes } from "@/modules/comment-blocklist/presentation/v1/admin-comment-blocklist.routes";
import { createBookmarkRoutes } from "@/modules/bookmark/presentation/v1/bookmark.routes";
import {
  createMeAvatarRoutes,
  createMeProfileRoutes,
  createPublicUserRoutes,
} from "@/modules/user/presentation/v1/user.routes";
import { UploadPublicImageUseCase } from "@/modules/public-image/application/use-cases/upload-public-image.use-case";
import { PublicImageController } from "@/modules/public-image/presentation/v1/public-image.controller";
import { createPublicImageRoutes } from "@/modules/public-image/presentation/v1/public-image.routes";
import { createDeviceRoutes } from "@/modules/device/presentation/v1/device.routes";
import { ListMyNotificationsUseCase } from "@/modules/notification/application/use-cases/list-my-notifications.use-case";
import { GetUnreadNotificationCountUseCase } from "@/modules/notification/application/use-cases/get-unread-notification-count.use-case";
import { MarkNotificationReadUseCase } from "@/modules/notification/application/use-cases/mark-notification-read.use-case";
import { MarkAllNotificationsReadUseCase } from "@/modules/notification/application/use-cases/mark-all-notifications-read.use-case";
import { NotificationController } from "@/modules/notification/presentation/v1/notification.controller";
import { createNotificationRoutes } from "@/modules/notification/presentation/v1/notification.routes";
import { createLemmaDefinitionProviderRegistry } from "@/modules/lemma-definition/infrastructure/lemma-definition-provider.factory";
import { LookupLemmaDefinitionUseCase } from "@/modules/lemma-definition/application/use-cases/lookup-lemma-definition.use-case";
import { LemmaDefinitionController } from "@/modules/lemma-definition/presentation/v1/lemma-definition.controller";
import { createLemmaDefinitionRoutes } from "@/modules/lemma-definition/presentation/v1/lemma-definition.routes";
import {
  createShareBackgroundProviderRegistry,
  listShareBackgroundProviderInfos,
} from "@/modules/share/infrastructure/share-background.factory";
import { ListShareBackgroundsUseCase } from "@/modules/share/application/use-cases/list-share-backgrounds.use-case";
import { ShareController } from "@/modules/share/presentation/v1/share.controller";
import { createShareRoutes } from "@/modules/share/presentation/v1/share.routes";
import { ActivityRepositoryImpl } from "@/modules/activity/infrastructure/activity.repository.impl";
import { ListActivityUseCase } from "@/modules/activity/application/use-cases/list-activity.use-case";
import { ActivityController } from "@/modules/activity/presentation/v1/activity.controller";
import {
  createActivityRoutes,
  createCardShareRoutes,
} from "@/modules/activity/presentation/v1/activity.routes";
import { RecordCardShareUseCase } from "@/modules/activity/application/use-cases/record-card-share.use-case";
import { VerifierApplicationRepositoryImpl } from "@/modules/verifier-application/infrastructure/verifier-application.repository.impl";
import { CreateVerifierApplicationUseCase } from "@/modules/verifier-application/application/use-cases/create-verifier-application.use-case";
import { GetMyVerifierApplicationUseCase } from "@/modules/verifier-application/application/use-cases/get-my-verifier-application.use-case";
import { ResubmitVerifierApplicationUseCase } from "@/modules/verifier-application/application/use-cases/resubmit-verifier-application.use-case";
import { ListVerifierApplicationsUseCase } from "@/modules/verifier-application/application/use-cases/list-verifier-applications.use-case";
import { GetVerifierApplicationDetailUseCase } from "@/modules/verifier-application/application/use-cases/get-verifier-application-detail.use-case";
import { ApproveVerifierApplicationUseCase } from "@/modules/verifier-application/application/use-cases/approve-verifier-application.use-case";
import { RejectVerifierApplicationUseCase } from "@/modules/verifier-application/application/use-cases/reject-verifier-application.use-case";
import { UpdateVerifierApplicationScreenshotUseCase } from "@/modules/verifier-application/application/use-cases/update-verifier-application-screenshot.use-case";
import { VerifierApplicationController } from "@/modules/verifier-application/presentation/v1/verifier-application.controller";
import { WebImportController } from "@/modules/web-import/presentation/v1/web-import.controller";
import {
  createAdminWebImportRoutes,
  createPublicWebImportRoutes,
} from "@/modules/web-import/presentation/v1/web-import.routes";
import { WebImportRepositoryImpl } from "@/modules/web-import/infrastructure/web-import.repository.impl";
import {
  ApproveWebImportUseCase,
  GetWebImportUseCase,
  ListWebImportsUseCase,
  PreviewWebImportUseCase,
  RejectWebImportUseCase,
  SubmitWebImportUseCase,
} from "@/modules/web-import/application/use-cases/web-import.use-cases";
import { createVerifierApplicationRoutes } from "@/modules/verifier-application/presentation/v1/verifier-application.routes";
import { createAdminVerifierApplicationRoutes } from "@/modules/verifier-application/presentation/v1/admin-verifier-application.routes";
import {
  WaTemplateRepositoryImpl,
  WaMessageLogRepositoryImpl,
  WaUsageRepositoryImpl,
} from "@/modules/wa/infrastructure/wa-message.repository.impl";
import { OpenWaSender } from "@/modules/wa/infrastructure/openwa-wa.sender";
import { SendWaMessageUseCase } from "@/modules/wa/application/use-cases/send-wa-message.use-case";
import { SendVerifierWaNotificationUseCase } from "@/modules/wa/application/use-cases/send-verifier-wa.use-case";
import { createWaAdminRoutes } from "@/modules/wa/presentation/v1/wa-admin.routes";
import { NotificationCampaignRepositoryImpl } from "@/modules/notification-campaign/infrastructure/notification-campaign.repository.impl";
import {
  CreateNotificationTemplateUseCase,
  UpdateNotificationTemplateUseCase,
  DeleteNotificationTemplateUseCase,
  ListNotificationTemplatesUseCase,
  GetNotificationTemplateUseCase,
} from "@/modules/notification-campaign/application/use-cases/template.use-cases";
import {
  CreateCampaignDraftUseCase,
  ListCampaignsUseCase,
  GetCampaignDetailUseCase,
  CancelCampaignUseCase,
  SendCampaignUseCase,
  RetryFailedCampaignRecipientsUseCase,
  ProcessCampaignDeliveryUseCase,
  EstimateCampaignAudienceUseCase,
} from "@/modules/notification-campaign/application/use-cases/campaign.use-cases";
import { NotificationCampaignController } from "@/modules/notification-campaign/presentation/v1/notification-campaign.controller";
import {
  createAdminNotificationCampaignRoutes,
  createAdminNotificationTemplateRoutes,
} from "@/modules/notification-campaign/presentation/v1/notification-campaign.routes";

export function registerRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {
  const accountDeletion = new AccountDeletionUseCase(
    di.userRepo,
    di.hasher,
    new AccountErasureRepositoryImpl(db),
    new AccountDeletionTokenRepositoryImpl(db),
    di.mailer,
    di.publicImageStorage,
    di.imageStorage,
    di.auditRepo,
    `${env.webAppUrl}/hapus-akun`,
  );
  app.route(
    "/api/v1/auth",
    createAuthRoutes({ controller: di.authController, authenticate: di.authenticate, accountDeletion }),
  );

  app.route(
    "/api/v1/stickers",
    createPublicStickerRoutes({
      controller: di.stickerController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/stickers",
    createAdminStickerRoutes({
      controller: di.stickerController,
      authenticate: di.authenticate,
    }),
  );

  const legalController = new LegalController({
    getCurrent: new GetCurrentLegalUseCase(di.appSettingsRepo, di.legalDocumentRepo),
    getDocument: new GetLegalDocumentUseCase(di.appSettingsRepo, di.legalDocumentRepo),
    acceptLegal: new AcceptLegalUseCase(di.appSettingsRepo, di.userConsentRepo),
    listAdmin: new ListAdminLegalDocumentsUseCase(di.legalDocumentRepo),
    createDraft: new CreateLegalDocumentDraftUseCase(
      di.legalDocumentRepo,
      di.auditRepo,
    ),
    updateDraft: new UpdateLegalDocumentDraftUseCase(
      di.legalDocumentRepo,
      di.auditRepo,
    ),
    publish: new PublishLegalDocumentUseCase(di.legalDocumentRepo, di.auditRepo),
    archive: new ArchiveLegalDocumentUseCase(di.legalDocumentRepo, di.auditRepo),
    getSettings: new GetAppSettingsUseCase(di.appSettingsRepo),
    updateSettings: new UpdateAppSettingsUseCase(di.appSettingsRepo, di.auditRepo),
  });
  app.route(
    "/api/v1/legal",
    createLegalPublicRoutes({ controller: legalController }),
  );
  app.route(
    "/api/v1/auth",
    createLegalAuthRoutes({ controller: legalController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/legal",
    createAdminLegalRoutes({ controller: legalController, authenticate: di.authenticate }),
  );

  const adminApiClientController = new AdminApiClientController({
    list: new ListAdminApiClientsUseCase(di.apiClientRepo),
    get: new GetAdminApiClientUseCase(di.apiClientRepo),
    create: new CreateAdminApiClientUseCase(di.apiClientRepo, di.auditRepo),
    update: new UpdateAdminApiClientUseCase(di.apiClientRepo, di.auditRepo),
  });
  app.route(
    "/api/v1/admin/api-clients",
    createAdminApiClientRoutes({
      controller: adminApiClientController,
      authenticate: di.authenticate,
    }),
  );

  const githubActionsDispatch = new GithubActionsDispatchService();
  const databaseBackupLogRepo = new DatabaseBackupLogRepositoryImpl(db);
  const systemDatabaseController = new SystemDatabaseController({
    trigger: new TriggerSqliteBackupUseCase(
      githubActionsDispatch,
      di.userRepo,
      databaseBackupLogRepo,
    ),
    list: new ListDatabaseBackupLogsUseCase(databaseBackupLogRepo),
  });
  app.route(
    "/api/v1/admin/system/database",
    createSystemDatabaseRoutes({
      controller: systemDatabaseController,
      authenticate: di.authenticate,
    }),
  );

  const supabaseHealthCheckRepo = new SupabaseHealthCheckRepositoryImpl(db);
  const systemSupabaseController = new SystemSupabaseController({
    list: new ListSupabaseHealthChecksUseCase(supabaseHealthCheckRepo),
    ping: new TriggerSupabaseHealthCheckUseCase(supabaseHealthCheckRepo),
  });
  app.route(
    "/api/v1/admin/system/supabase",
    createSystemSupabaseRoutes({
      controller: systemSupabaseController,
      authenticate: di.authenticate,
    }),
  );

  // Modul mobile-release (issue mobile#196): publik (cek versi) + admin (upsert)
  const mobileReleaseRepo = new MobileReleaseRepositoryImpl(db);
  const mobileReleaseController = new MobileReleaseController({
    getLatest: new GetLatestMobileReleaseUseCase(mobileReleaseRepo),
    list: new ListMobileReleasesUseCase(mobileReleaseRepo),
    upsert: new UpsertMobileReleaseUseCase(mobileReleaseRepo, di.auditRepo),
  });
  app.route(
    "/api/v1/mobile-release",
    createMobileReleasePublicRoutes({ controller: mobileReleaseController }),
  );
  app.route(
    "/api/v1/admin/mobile-release",
    createMobileReleaseAdminRoutes({
      controller: mobileReleaseController,
      authenticate: di.authenticate,
    }),
  );

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
  const setWordImageContentWarnings = new SetWordImageContentWarningsUseCase(
    di.wordRepo,
    di.auditRepo,
  );
  const wordReportController = new WordReportController({
    create: new CreateWordReportUseCase(di.wordReportRepo, di.wordRepo, di.auditRepo),
    list: new ListWordReportsUseCase(di.wordReportRepo),
    resolve: new ResolveWordReportUseCase(di.wordReportRepo, di.auditRepo),
    takedown: new TakedownWordReportUseCase(di.wordReportRepo, di.takedownWord),
    flagViolentImage: new FlagViolentImageReportUseCase(
      di.wordReportRepo,
      setWordImageContentWarnings,
      di.auditRepo,
    ),
    removeMeaning: new RemoveMeaningWordReportUseCase(
      di.wordReportRepo,
      di.softDeleteMeaning,
    ),
  });
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
    "/api/v1/admin/sponsorships",
    createAdminSponsorshipRoutes({
      controller: di.aboutController,
      authenticate: di.authenticate,
    }),
  );

  const publicImageController = new PublicImageController({
    uploadPublicImage: new UploadPublicImageUseCase(di.publicImageStorage),
  });
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
    createPublicLeaderboardRoutes({ controller: di.leaderboardController }),
  );
  app.route(
    "/api/v1/admin/leaderboard",
    createAdminLeaderboardRoutes({
      controller: di.leaderboardController,
      authenticate: di.authenticate,
    }),
  );

  // Places CRUD - katalog wisata/kuliner/budaya (SoT Turso).
  app.route(
    "/api/v1/admin/places",
    createAdminPlaceRoutes({ controller: di.placeController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/places",
    createAdminPlaceCommentRoutes({ controller: di.placeController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/places",
    createPublicPlaceRoutes({
      controller: di.placeController,
      optionalAuthenticate: di.optionalAuthenticate,
      softAuthenticate: di.softAuthenticate,
    }),
  );
  app.route(
    "/api/v1/places",
    createPlaceVisitRoutes({
      controller: di.placeVisitController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/places",
    createPublicPlaceCommentRoutes({
      controller: di.placeController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/admin/places",
    createAdminPlaceVisitRoutes({
      controller: di.placeVisitController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/place-contributions",
    createAdminPlaceContributionRoutes({
      controller: di.placeContributionController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/place-contributions",
    createPlaceContributionRoutes({
      controller: di.placeContributionController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
      uploadPlaceImage: (c) =>
        publicImageController.upload(c, { purpose: "place" }),
    }),
  );
  app.route(
    "/api/v1/admin/place-categories",
    createAdminPlaceCategoryRoutes({
      controller: di.placeCategoryController,
      authenticate: di.authenticate,
    }),
  );

  // Event/acara - katalog acara + usulan pengguna.
  app.route(
    "/api/v1/admin/events",
    createAdminEventRoutes({ controller: di.eventController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/events",
    createAdminEventCommentRoutes({ controller: di.eventController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/events",
    createAdminEventGoingRoutes({
      controller: di.eventGoingController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/events",
    createPublicEventRoutes({
      controller: di.eventController,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/events",
    createEventGoingRoutes({
      controller: di.eventGoingController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/events",
    createPublicEventCommentRoutes({
      controller: di.eventController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/events",
    createUserEventImageRoutes({
      controller: di.eventController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/event-contributions",
    createAdminEventContributionRoutes({
      controller: di.eventContributionController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/event-contributions",
    createEventContributionRoutes({
      controller: di.eventContributionController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
      uploadEventImage: (c) =>
        publicImageController.upload(c, { purpose: "event" }),
    }),
  );
  app.route(
    "/api/v1/place-categories",
    createPublicPlaceCategoryRoutes({ controller: di.placeCategoryController }),
  );

  // Fitur Usaha - direktori usaha & jasa lokal (PRD usaha).
  // Urutan penting: `/usaha/mine` + usulan/klaim/laporan didaftarkan SEBELUM
  // route publik `/usaha/:slug` supaya segmen statis tidak tertelan param.
  app.route(
    "/api/v1/admin/usaha",
    createAdminUsahaViewsRoutes({
      controller: di.usahaViewsController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/usaha",
    createAdminUsahaRoutes({ controller: di.usahaController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/usaha",
    createAdminUsahaCommentRoutes({ controller: di.usahaController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/usaha-categories",
    createAdminUsahaCategoryRoutes({
      controller: di.usahaCategoryController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/usaha-contributions",
    createAdminUsahaContributionRoutes({
      controller: di.usahaContributionController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/usaha-claims",
    createAdminUsahaClaimRoutes({
      controller: di.usahaClaimController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/usaha-reports",
    createAdminUsahaReportRoutes({
      controller: di.usahaReportController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/usaha",
    createUsahaMineRoutes({ listMyUc: di.listMyUsahaUc, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/usaha",
    createUsahaClaimRoutes({ controller: di.usahaClaimController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/usaha",
    createUsahaReportRoutes({ controller: di.usahaReportController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/usaha-contributions",
    createUsahaContributionRoutes({
      controller: di.usahaContributionController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/usaha-categories",
    createPublicUsahaCategoryRoutes({ controller: di.usahaCategoryController }),
  );
  app.route(
    "/api/v1/usaha",
    createPublicUsahaViewsRoutes({
      controller: di.usahaViewsController,
      softAuthenticate: di.softAuthenticate,
    }),
  );
  app.route(
    "/api/v1/usaha",
    createPublicUsahaRoutes({ controller: di.usahaController, optionalAuthenticate: di.optionalAuthenticate }),
  );
  app.route(
    "/api/v1/usaha",
    createPublicUsahaCommentRoutes({
      controller: di.usahaController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/usaha",
    createUsahaVisitRoutes({
      controller: di.usahaVisitController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/usaha",
    createAdminUsahaVisitRoutes({
      controller: di.usahaVisitController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/layanan",
    createAdminLayananRoutes({ controller: di.layananController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/layanan-contributions",
    createAdminLayananContributionRoutes({
      controller: di.layananController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/layanan-contributions",
    createLayananContributionRoutes({
      controller: di.layananController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/layanan",
    createPublicLayananRoutes({ controller: di.layananController }),
  );
  app.route(
    "/api/v1/admin/karya",
    createAdminKaryaRoutes({ controller: di.karyaController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/karya-contributions",
    createAdminKaryaContributionRoutes({
      controller: di.karyaController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/karya-contributions",
    createKaryaContributionRoutes({
      controller: di.karyaController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/karya",
    createPublicKaryaRoutes({ controller: di.karyaController }),
  );
  app.route(
    "/api/v1/karya-excerpts",
    createKaryaExcerptLemmaLinkRoutes({
      controller: di.karyaLemmaLinkController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  app.route(
    "/api/v1/karya-lemma-links",
    createKaryaLemmaLinkDeleteRoutes({
      controller: di.karyaLemmaLinkController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  app.route(
    "/api/v1/kreators",
    createPublicKreatorRoutes({ controller: di.kreatorController }),
  );
  app.route(
    "/api/v1/kreators",
    createAuthKreatorClaimRoutes({
      controller: di.kreatorController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/kreator-claims",
    createMineKreatorClaimRoutes({
      controller: di.kreatorController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/kreators",
    createAdminKreatorRoutes({ controller: di.kreatorController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/karya-credits",
    createAdminKaryaCreditLinkRoutes({ controller: di.kreatorController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/kreator-claims",
    createAdminKreatorClaimRoutes({ controller: di.kreatorController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/baleho",
    createPublicBalehoRoutes({
      controller: di.balehoController,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/baleho",
    createAuthBalehoRoutes({
      controller: di.balehoController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/baleho",
    createAdminBalehoRoutes({
      controller: di.balehoController,
      authenticate: di.authenticate,
    }),
  );
  // PRD relasi-lemma: kelompok makna - publik GET + auth tulis.
  // Fitur Kuliner - jelajah kuliner & tempat makan (PRD kuliner).
  // Urutan penting: route usulan/klaim/laporan didaftarkan SEBELUM route
  // publik `/culinary/*/:slug` supaya segmen statis tidak tertelan param.
  app.route(
    "/api/v1/admin/culinary",
    createAdminCuisineViewsRoutes({
      controller: di.cuisineViewsController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/culinary",
    createAdminCulinaryRoutes({ controller: di.culinaryController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/culinary",
    createAdminCuisineCommentRoutes({ controller: di.culinaryController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/culinary-categories",
    createAdminCulinaryCategoryRoutes({
      controller: di.culinaryCategoryController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/culinary-contributions",
    createAdminCulinaryContributionRoutes({
      controller: di.culinaryContributionController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/culinary-claims",
    createAdminCulinaryClaimRoutes({
      controller: di.culinaryClaimController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/culinary-reports",
    createAdminCulinaryReportRoutes({
      controller: di.culinaryReportController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/culinary",
    createCulinaryClaimRoutes({
      controller: di.culinaryClaimController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/culinary",
    createCulinaryReportRoutes({
      controller: di.culinaryReportController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/culinary/contributions",
    createCulinaryContributionRoutes({
      controller: di.culinaryContributionController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
      uploadCulinaryImage: (c) =>
        publicImageController.upload(c, { purpose: "culinary" }),
    }),
  );
  app.route(
    "/api/v1/culinary-categories",
    createPublicCulinaryCategoryRoutes({ controller: di.culinaryCategoryController }),
  );
  app.route(
    "/api/v1/culinary",
    createPublicCuisineViewsRoutes({
      controller: di.cuisineViewsController,
      softAuthenticate: di.softAuthenticate,
    }),
  );
  app.route(
    "/api/v1/culinary",
    createPublicCulinaryRoutes({ controller: di.culinaryController, optionalAuthenticate: di.optionalAuthenticate }),
  );
  app.route(
    "/api/v1/culinary",
    createPublicCuisineCommentRoutes({
      controller: di.culinaryController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/word-groups",
    createWordGroupRoutes({ controller: di.wordGroupController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/regions",
    createAdminRegionRoutes({ controller: di.regionController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/regions",
    createPublicRegionRoutes({ controller: di.regionController }),
  );

  // Data referensi form admin
  app.route(
    "/api/v1/languages",
    createLanguageRoutes({ controller: di.languageController }),
  );
  app.route(
    "/api/v1/dialects",
    createDialectRoutes({ controller: di.languageController }),
  );
  app.route(
    "/api/v1/categories",
    createCategoryRoutes({ controller: di.categoryController, authenticate: di.authenticate }),
  );

  // Audit log - hanya admin & root (Section 21)
  const auditController = new AuditController({
    listAuditLogs: new ListAuditLogsUseCase(di.auditRepo),
  });
  app.route(
    "/api/v1/admin/audit-logs",
    createAuditRoutes({ controller: auditController, authenticate: di.authenticate }),
  );

  // Image provider - wrapper ImageKit via ImageStoragePort (Section 8);
  // di.imageStorage sudah di-instantiate di atas (dipakai di.wordController juga)
  const imageController = new ImageController({
    createUploadCredentials: new CreateUploadCredentialsUseCase({
      imageStorage: di.imageStorage,
      defaultFolder: "/words",
    }),
  });
  app.route(
    "/api/v1/admin/images/upload-token",
    createImageRoutes({
      controller: imageController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireContributeWriteClient,
    }),
  );

  const bugReportRepo = new BugReportRepositoryImpl(db);
  const bugReportController = new BugReportController({
    create: new CreateBugReportUseCase(bugReportRepo, di.auditRepo),
    list: new ListBugReportsUseCase(bugReportRepo),
    resolve: new ResolveBugReportUseCase(bugReportRepo, di.auditRepo),
    imageController,
  });
  app.route(
    "/api/v1/bug-reports",
    createBugReportRoutes({
      controller: bugReportController,
      optionalAuthenticate: di.optionalAuthenticate,
      authenticate: di.authenticate,
    }),
  );
  const categorySuggestionModule = createCategorySuggestionModule({
    db,
    auditRepo: di.auditRepo,
  });
  app.route(
    "/api/v1/category-suggestions",
    createCategorySuggestionRoutes({
      controller: categorySuggestionModule.controller,
      optionalAuthenticate: di.optionalAuthenticate,
    }),
  );
  app.route(
    "/api/v1/admin/category-suggestions",
    createAdminCategorySuggestionRoutes({
      controller: categorySuggestionModule.controller,
      authenticate: di.authenticate,
    }),
  );

  app.route(
    "/api/v1/admin/bug-reports",
    createAdminBugReportRoutes({ controller: bugReportController, authenticate: di.authenticate }),
  );

  const discussionRepo = new DiscussionRepositoryImpl(db);
  const discussionController = new DiscussionController({
    create: new CreateDiscussionUseCase(
      discussionRepo,
      di.auditRepo,
      di.userRepo,
      di.recordInbox,
      di.notifyUser,
      di.recordAbuseSignal,
      di.commentBlocklistRepo,
    ),
    listPublished: new ListPublishedDiscussionsUseCase(discussionRepo, di.voteRepo),
    listMine: new ListMyDiscussionsUseCase(discussionRepo),
    getDetail: new GetDiscussionDetailUseCase(discussionRepo, di.voteRepo),
    listAdmin: new ListAdminDiscussionsUseCase(discussionRepo),
    approve: new ApproveDiscussionUseCase(
      discussionRepo,
      di.publicImageStorage,
      di.imageStorage,
      di.auditRepo,
      di.recordInbox,
      di.activityEvents,
    ),
    reject: new RejectDiscussionUseCase(
      discussionRepo,
      di.imageStorage,
      di.auditRepo,
      di.recordInbox,
      di.pronunciationStorage,
    ),
    takedown: new TakedownDiscussionUseCase(
      discussionRepo,
      di.auditRepo,
      di.recordInbox,
      di.pronunciationStorage,
    ),
    createReply: new CreateDiscussionReplyUseCase(
      discussionRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.userRepo,
      di.recordInbox,
      di.notifyUser,
      di.discussionReplyPushCooldown,
      di.recordAbuseSignal,
      di.stickerRepo,
    ),
    createReplyAudio: new CreateDiscussionReplyAudioUseCase(
      discussionRepo,
      di.pronunciationStorage,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.userRepo,
      di.recordInbox,
      di.notifyUser,
      di.discussionReplyPushCooldown,
      di.recordAbuseSignal,
    ),
    attachAudio: new AttachDiscussionAudioUseCase(
      discussionRepo,
      di.pronunciationStorage,
      di.auditRepo,
    ),
    deleteReply: new DeleteDiscussionReplyUseCase(
      discussionRepo,
      di.auditRepo,
      di.pronunciationStorage,
    ),
    updateReply: new UpdateDiscussionReplyUseCase(
      discussionRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
    ),
    replyEditHistory: new GetDiscussionReplyEditHistoryUseCase(discussionRepo),
    update: new UpdateDiscussionUseCase(
      discussionRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.userRepo,
      di.recordInbox,
      di.notifyUser,
    ),
    delete: new DeleteDiscussionUseCase(
      discussionRepo,
      di.auditRepo,
      di.pronunciationStorage,
    ),
    editHistory: new GetDiscussionEditHistoryUseCase(discussionRepo),
    pinReply: new PinDiscussionReplyUseCase(discussionRepo, di.auditRepo),
    takedownReply: new TakedownDiscussionReplyUseCase(discussionRepo, di.auditRepo),
    createLemmaLink: new CreateDiscussionLemmaLinkUseCase(
      discussionRepo,
      di.wordRepo,
      di.auditRepo,
    ),
    listLemmaLinks: new ListDiscussionLemmaLinksUseCase(discussionRepo),
    proposeLemmaCorrection: new ProposeDiscussionLemmaCorrectionUseCase(
      discussionRepo,
      di.wordRepo,
      di.auditRepo,
    ),
    resolveLemmaCorrection: new ResolveDiscussionLemmaCorrectionUseCase(
      discussionRepo,
      di.auditRepo,
    ),
    deleteLemmaLink: new DeleteDiscussionLemmaLinkUseCase(
      discussionRepo,
      di.auditRepo,
    ),
    imageController,
  });
  app.route(
    "/api/v1/discussions",
    createDiscussionRoutes({
      controller: discussionController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
      requireApprovedClient: di.requireDiscussionWriteClient,
      requireLegalConsent: di.requireLegalConsent,
      onUgcRateLimited: di.onUgcRateLimited,
    }),
  );
  app.route(
    "/api/v1/admin/discussions",
    createAdminDiscussionRoutes({
      controller: discussionController,
      authenticate: di.authenticate,
    }),
  );

  // Chat publik F1a + F1b voice note (teks/stiker/VN/reply/edit/tombstone).
  const chatRepo = new ChatRepositoryImpl(db);
  const chatMirror = new ChatSupabaseMirrorService();
  const chatController = new ChatController(
    new GetChatCapabilitiesUseCase(di.appSettingsRepo),
    new ListChatMessagesUseCase(chatRepo),
    new CreateChatMessageUseCase(
      chatRepo,
      di.userRepo,
      di.commentBlocklistRepo,
      chatMirror,
      di.stickerRepo,
      di.recordAbuseSignal,
    ),
    new CreateChatVoiceNoteUseCase(
      chatRepo,
      di.userRepo,
      di.pronunciationStorage,
      chatMirror,
    ),
    new EditChatMessageUseCase(
      chatRepo,
      di.commentBlocklistRepo,
      chatMirror,
      di.recordAbuseSignal,
    ),
    new DeleteChatMessageUseCase(chatRepo, chatMirror, di.pronunciationStorage),
    new ListChatRevisionsUseCase(chatRepo),
  );
  app.route(
    "/api/v1/chat",
    createChatRoutes({
      controller: chatController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
      requireApprovedClient: di.requireDiscussionWriteClient,
      requireLegalConsent: di.requireLegalConsent,
      onUgcRateLimited: di.onUgcRateLimited,
    }),
  );

  // Voice room LiveKit (experimental): mint JWT pendek untuk mobile.
  const voiceRoomEventsRepo = new VoiceRoomEventsRepository(db);
  const voiceController = new VoiceController(
    new MintVoiceTokenUseCase(di.appSettingsRepo, di.userRepo),
    new RecordVoiceRoomEventUseCase(voiceRoomEventsRepo),
  );
  app.route(
    "/api/v1/voice",
    createVoiceRoutes({
      controller: voiceController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requireDiscussionWriteClient,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );

  const pantunRepo = new PantunRepositoryImpl(db);
  const createPantunReply = new CreatePantunReplyUseCase(
    pantunRepo,
    di.auditRepo,
    di.commentBlocklistRepo,
    di.recordAbuseSignal,
    di.activityEvents,
    di.userRepo,
    di.recordInbox,
    di.notifyUser,
    di.pantunReplyPushCooldown,
  );
  const pantunController = new PantunController({
    create: new CreatePantunUseCase(
      pantunRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
    ),
    createWithAudio: new CreatePantunWithAudioUseCase(
      pantunRepo,
      di.pronunciationStorage,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
    ),
    createReply: createPantunReply,
    createReplyWithAudio: new CreatePantunReplyWithAudioUseCase(
      createPantunReply,
      di.pronunciationStorage,
    ),
    listPublished: new ListPublishedPantunsUseCase(pantunRepo, di.voteRepo),
    getDetail: new GetPantunDetailUseCase(pantunRepo, di.voteRepo),
    takedown: new TakedownPantunUseCase(
      pantunRepo,
      di.auditRepo,
      di.pronunciationStorage,
    ),
    takedownReply: new TakedownPantunReplyUseCase(
      pantunRepo,
      di.auditRepo,
      di.pronunciationStorage,
    ),
    deleteReply: new DeletePantunReplyUseCase(
      pantunRepo,
      di.auditRepo,
      di.pronunciationStorage,
    ),
    updateReply: new UpdatePantunReplyUseCase(
      pantunRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
    ),
    getReplyEditHistory: new GetPantunReplyEditHistoryUseCase(pantunRepo),
    deletePantun: new DeletePantunUseCase(
      pantunRepo,
      di.auditRepo,
      di.pronunciationStorage,
    ),
    listAdmin: new ListAdminPantunsUseCase(pantunRepo),
    search: new SearchPantunsUseCase(pantunRepo),
  });
  const pantunReportRepo = new PantunReportRepositoryImpl(db);
  const pantunReportController = new PantunReportController({
    submit: new SubmitPantunReportUseCase(pantunReportRepo, pantunRepo, di.auditRepo),
    list: new ListPantunReportsUseCase(pantunReportRepo),
    resolve: new ResolvePantunReportUseCase(
      pantunReportRepo,
      new TakedownPantunUseCase(pantunRepo, di.auditRepo, di.pronunciationStorage),
      new TakedownPantunReplyUseCase(
        pantunRepo,
        di.auditRepo,
        di.pronunciationStorage,
      ),
      di.auditRepo,
    ),
  });
  // Didaftarkan SEBELUM route pantun: literal /reports harus menang dari /:id.
  app.route(
    "/api/v1/pantuns",
    createPantunReportRoutes({
      controller: pantunReportController,
      authenticate: di.authenticate,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  app.route(
    "/api/v1/pantuns",
    createPantunRoutes({
      controller: pantunController,
      authenticate: di.authenticate,
      requireApprovedClient: di.requirePantunWriteClient,
      requireLegalConsent: di.requireLegalConsent,
      onUgcRateLimited: di.onUgcRateLimited,
    }),
  );
  app.route(
    "/api/v1/admin/pantuns",
    createAdminPantunRoutes({
      controller: pantunController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/pantun-reports",
    createAdminPantunReportRoutes({
      controller: pantunReportController,
      authenticate: di.authenticate,
    }),
  );

  // ------------------------------------------------------------------
  // Jinye: status singkat (teks / foto / voice). Post-moderation.
  const jinyeRepo = new JinyeRepositoryImpl(db);
  const translationController = new TranslationController({
    create: new CreateTranslationUseCase(
      di.translationRepo,
      jinyeRepo,
      di.auditRepo,
      di.wordRepo,
    ),
    list: new ListTranslationsUseCase(di.translationRepo),
    resolve: new ResolveTranslationUseCase(di.translationRepo, di.auditRepo, di.wordRepo),
  });
  app.route(
    "/api/v1/translations",
    createTranslationRoutes({
      controller: translationController,
      authenticate: di.authenticate,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  const takedownJinye = new TakedownJinyeUseCase(jinyeRepo, di.auditRepo);
  const takedownJinyeComment = new TakedownJinyeCommentUseCase(
    jinyeRepo,
    di.auditRepo,
  );
  const jinyeReportRepo = new JinyeReportRepositoryImpl(db);
  const jinyeReportController = new JinyeReportController({
    submit: new SubmitJinyeReportUseCase(jinyeReportRepo, jinyeRepo, di.auditRepo),
    list: new ListJinyeReportsUseCase(jinyeReportRepo),
    resolve: new ResolveJinyeReportUseCase(
      jinyeReportRepo,
      takedownJinye,
      takedownJinyeComment,
      di.auditRepo,
    ),
  });
  // /reports sebelum /:id
  app.route(
    "/api/v1/jinye",
    createJinyeReportRoutes({
      controller: jinyeReportController,
      authenticate: di.authenticate,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  const jinyeController = new JinyeController({
    create: new CreateJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
    ),
    listPublished: new ListPublishedJinyeUseCase(jinyeRepo, di.userRepo),
    getDetail: new GetJinyeDetailUseCase(jinyeRepo),
    deleteJinye: new DeleteJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.wordRepo,
      di.translationRepo,
    ),
    attachAudio: new AttachJinyeAudioUseCase(
      jinyeRepo,
      di.pronunciationStorage,
      di.auditRepo,
    ),
    createComment: new CreateJinyeCommentUseCase(
      jinyeRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
      di.userRepo,
      di.recordInbox,
      di.notifyUser,
      di.stickerRepo,
    ),
    listComments: new ListJinyeCommentsUseCase(jinyeRepo),
    deleteComment: new DeleteJinyeCommentUseCase(jinyeRepo, di.auditRepo),
    updateComment: new UpdateJinyeCommentUseCase(
      jinyeRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
    ),
    commentEditHistory: new GetJinyeCommentEditHistoryUseCase(jinyeRepo),
    archive: new ArchiveJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.wordRepo,
      di.translationRepo,
    ),
    unarchive: new UnarchiveJinyeUseCase(jinyeRepo, di.auditRepo),
    pin: new PinJinyeUseCase(jinyeRepo, di.auditRepo),
    unpin: new UnpinJinyeUseCase(jinyeRepo, di.auditRepo),
    listArchived: new ListArchivedJinyeUseCase(jinyeRepo),
    createLemmaLink: new CreateJinyeLemmaLinkUseCase(
      jinyeRepo,
      di.wordRepo,
      di.auditRepo,
    ),
    listLemmaLinks: new ListJinyeLemmaLinksUseCase(jinyeRepo),
    proposeLemmaCorrection: new ProposeJinyeLemmaCorrectionUseCase(
      jinyeRepo,
      di.wordRepo,
      di.auditRepo,
    ),
    resolveLemmaCorrection: new ResolveJinyeLemmaCorrectionUseCase(
      jinyeRepo,
      di.auditRepo,
    ),
    deleteLemmaLink: new DeleteJinyeLemmaLinkUseCase(jinyeRepo, di.auditRepo),
    promoteExample: new PromoteJinyeExampleUseCase(
      jinyeRepo,
      di.wordRepo,
      di.auditRepo,
    ),
    update: new UpdateJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
    ),
    editHistory: new GetJinyeEditHistoryUseCase(jinyeRepo),
    repost: new RepostJinyeUseCase(jinyeRepo, di.auditRepo, di.activityEvents),
    unrepost: new UnrepostJinyeUseCase(jinyeRepo, di.auditRepo, di.activityEvents),
    quote: new QuoteJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
    ),
    listAdmin: new ListAdminJinyeUseCase(jinyeRepo, di.userRepo),
    takedown: takedownJinye,
    takedownComment: takedownJinyeComment,
    imageController,
  });
  app.route(
    "/api/v1/jinye",
    createJinyeRoutes({
      controller: jinyeController,
      authenticate: di.authenticate,
      optionalAuth: di.optionalAuthenticate,
      requireApprovedClient: di.requirePantunWriteClient,
      requireLegalConsent: di.requireLegalConsent,
      onUgcRateLimited: di.onUgcRateLimited,
    }),
  );
  app.route(
    "/api/v1/admin/jinye",
    createAdminJinyeRoutes({
      controller: jinyeController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/jinye-reports",
    createAdminJinyeReportRoutes({
      controller: jinyeReportController,
      authenticate: di.authenticate,
    }),
  );

  // ------------------------------------------------------------------
  // Ensiklopedia: artikel (markdown), kontribusi user, komentar, laporan.
  const encyclopediaRepo = new EncyclopediaRepositoryImpl(db);
  const encyclopediaController = new EncyclopediaController({
    repo: encyclopediaRepo,
    listArticles: new ListArticlesUseCase(encyclopediaRepo),
    getArticle: new GetArticleBySlugUseCase(encyclopediaRepo),
    searchArticles: new SearchArticlesUseCase(encyclopediaRepo),
    listCategories: new ListEncyclopediaCategoriesUseCase(encyclopediaRepo),
    createArticle: new CreateArticleUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.activityEvents,
    ),
    updateArticle: new UpdateArticleUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.activityEvents,
    ),
    setStatus: new SetArticleStatusUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.activityEvents,
    ),
    listRevisions: new ListArticleRevisionsUseCase(encyclopediaRepo),
    restoreRevision: new RestoreArticleRevisionUseCase(encyclopediaRepo, di.auditRepo),
    mergeTag: new MergeTagUseCase(encyclopediaRepo),
    listComments: new ListArticleCommentsUseCase(encyclopediaRepo),
    createComment: new CreateArticleCommentUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
      di.stickerRepo,
    ),
    createCommentAudio: new CreateArticleCommentAudioUseCase(
      encyclopediaRepo,
      di.pronunciationStorage,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
    ),
    updateComment: new UpdateArticleCommentUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
    ),
    deleteComment: new DeleteArticleCommentUseCase(encyclopediaRepo),
    takedownComment: new TakedownArticleCommentUseCase(encyclopediaRepo, di.auditRepo),
    toggleBookmark: new ToggleArticleBookmarkUseCase(encyclopediaRepo),
    submitContribution: new SubmitArticleContributionUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.explorationGroupNotifier,
    ),
    resubmitContribution: new ResubmitArticleContributionUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.explorationGroupNotifier,
    ),
    listMyContributions: new ListMyArticleContributionsUseCase(encyclopediaRepo),
    listContributions: new ListArticleContributionsUseCase(encyclopediaRepo),
    reviewContribution: new ReviewArticleContributionUseCase(
      encyclopediaRepo,
      di.auditRepo,
      di.activityEvents,
      di.replaceContentLinks,
    ),
    reports: new ArticleReportUseCases(db, encyclopediaRepo, di.auditRepo),
    listRelated: di.listRelatedContent,
    replaceRelated: di.replaceContentLinks,
  });
  const articleViewsRepo = new ArticleViewsRepositoryImpl(db);
  const articleViewsController = new ArticleViewsController(
    new RecordArticleViewBySlugUseCase(articleViewsRepo),
    new ListArticleViewsUseCase(articleViewsRepo),
    new GetArticleViewReportUseCase(articleViewsRepo),
  );
  app.route(
    "/api/v1/encyclopedia",
    createPublicArticleViewsRoutes({
      controller: articleViewsController,
      softAuthenticate: di.softAuthenticate,
    }),
  );
  app.route(
    "/api/v1/admin/encyclopedia",
    createAdminArticleViewsRoutes({
      controller: articleViewsController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/encyclopedia",
    createEncyclopediaRoutes({
      controller: encyclopediaController,
      authenticate: di.authenticate,
      optionalAuthenticate: di.optionalAuthenticate,
      requireApprovedClient: di.requireContributeWriteClient,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  app.route(
    "/api/v1/admin/encyclopedia",
    createAdminEncyclopediaRoutes({
      controller: encyclopediaController,
      authenticate: di.authenticate,
    }),
  );

  app.route(
    "/api/v1/admin/word-reports",
    createAdminWordReportRoutes({
      controller: wordReportController,
      authenticate: di.authenticate,
    }),
  );

  // Statistik dashboard - hanya admin, root (analitik = admin/root saja)
  app.route(
    "/api/v1/admin/dashboard",
    createDashboardRoutes({ controller: di.dashboardController, authenticate: di.authenticate }),
  );

  // Trafik Web (GA4 + Search Console) - hanya admin & root
  app.route(
    "/api/v1/admin/web-analytics",
    createWebAnalyticsRoutes({
      controller: di.webAnalyticsController,
      authenticate: di.authenticate,
    }),
  );

  // Play Store (export CSV GCS) - hanya admin & root
  app.route(
    "/api/v1/admin/play-analytics",
    createPlayAnalyticsRoutes({
      controller: di.playAnalyticsController,
      authenticate: di.authenticate,
    }),
  );

  // Analitik notifikasi (FCM delivery + open rate) - hanya admin & root
  app.route(
    "/api/v1/admin/fcm-analytics",
    createFcmAnalyticsRoutes({
      controller: di.fcmAnalyticsController,
      authenticate: di.authenticate,
    }),
  );
  // Analitik mobile GA4 (event, layar, audiens) - hanya admin & root
  app.route(
    "/api/v1/admin/mobile-analytics",
    createMobileAnalyticsRoutes({
      controller: di.mobileAnalyticsController,
      authenticate: di.authenticate,
    }),
  );

  // ---- Admin users (Package A): list user + ubah role, hanya admin & root ----
  const adminUsersController = new AdminUsersController({
    list: new ListAdminUsersUseCase(di.userRepo),
    updateRole: new UpdateUserRoleUseCase(di.userRepo, di.refreshTokenRepo, di.auditRepo),
    setCanContribute: new SetCanContributeUseCase(
      di.userRepo,
      di.auditRepo,
      di.recordInbox,
    ),
    createUser: new CreateAdminUserUseCase(di.userRepo, di.hasher, di.auditRepo),
    setActive: new SetUserActiveUseCase(di.userRepo, di.refreshTokenRepo, di.auditRepo),
    verifyEmail: new AdminVerifyEmailUseCase(di.userRepo, di.otpRepo, di.auditRepo, di.activityEvents),
    listAbuseEvents: new ListUserAbuseEventsUseCase(di.ugcAbuseEventRepo),
    updateTeam: (id, data) => di.userRepo.updateTeam(id, data),
    setUserSponsor: async (userId, isSponsor) => {
      const row = await di.setUserSponsorUseCase.execute(userId, isSponsor);
      return { isSponsor: row != null, sponsorshipId: row?.id ?? null };
    },
    listActiveSponsorUserIds: (ids) => di.aboutRepo.listActiveSponsorUserIds(ids),
  });
  app.route(
    "/api/v1/admin/users",
    createAdminUserRoutes({ controller: adminUsersController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/admin/contribution-access",
    createContributionAccessRoutes({
      controller: adminUsersController,
      authenticate: di.authenticate,
    }),
  );

  // Monitoring ledger abuse UGC (akun + anon) - hanya admin & root
  const abuseController = new AbuseController({
    abuseRepo: di.ugcAbuseEventRepo,
    anonRepo: di.ugcAnonAbuseRepo,
    lift: new LiftAbuseMuteUseCase(
      di.ugcAbuseEventRepo,
      di.ugcAnonAbuseRepo,
      di.userRepo,
      di.auditRepo,
    ),
  });
  app.route(
    "/api/v1/admin/abuse",
    createAbuseRoutes({ controller: abuseController, authenticate: di.authenticate }),
  );

  const verifierApplicationRepo = new VerifierApplicationRepositoryImpl(db);

  // WA (OpenWA) - notifikasi verifikator + admin console (System > WhatsApp).
  const waTemplateRepo = new WaTemplateRepositoryImpl(db);
  const waLogRepo = new WaMessageLogRepositoryImpl(db);
  const waUsageRepo = new WaUsageRepositoryImpl(db);
  const sendWaMessage = new SendWaMessageUseCase(
    [{ sender: new OpenWaSender() }],
    waUsageRepo,
    waLogRepo,
    waTemplateRepo,
    di.appSettingsRepo,
  );
  di.balehoNotify.sendWa = sendWaMessage;
  const sendVerifierWa = new SendVerifierWaNotificationUseCase(sendWaMessage);
  async function readWaSettings(): Promise<{ enabled: boolean; ctaUrl: string }> {
    return sendWaMessage.readWaSettings();
  }

  const verifierApplicationController = new VerifierApplicationController({
    create: new CreateVerifierApplicationUseCase(
      verifierApplicationRepo,
      di.userRepo,
    ),
    getMine: new GetMyVerifierApplicationUseCase(verifierApplicationRepo),
    resubmit: new ResubmitVerifierApplicationUseCase(
      verifierApplicationRepo,
      di.userRepo,
    ),
    list: new ListVerifierApplicationsUseCase(verifierApplicationRepo),
    getDetail: new GetVerifierApplicationDetailUseCase(verifierApplicationRepo),
    approve: new ApproveVerifierApplicationUseCase(
      verifierApplicationRepo,
      di.refreshTokenRepo,
      di.auditRepo,
      di.notifyUser,
      di.userRepo,
      di.mailer,
      di.recordInbox,
      sendVerifierWa,
      readWaSettings,
    ),
    reject: new RejectVerifierApplicationUseCase(
      verifierApplicationRepo,
      di.auditRepo,
      di.notifyUser,
      di.recordInbox,
      di.userRepo,
      sendVerifierWa,
      readWaSettings,
    ),
    updateScreenshot: new UpdateVerifierApplicationScreenshotUseCase(
      verifierApplicationRepo,
    ),
  });
  const webImportRepo = new WebImportRepositoryImpl(db);
  const webImportController = new WebImportController(
    new SubmitWebImportUseCase(webImportRepo, di.auditRepo),
    new ListWebImportsUseCase(webImportRepo),
    new GetWebImportUseCase(webImportRepo),
    new PreviewWebImportUseCase(webImportRepo),
    new ApproveWebImportUseCase(webImportRepo, di.auditRepo),
    new RejectWebImportUseCase(webImportRepo, di.auditRepo),
  );
  app.route(
    "/api/v1/web-imports",
    createPublicWebImportRoutes({ controller: webImportController }),
  );
  app.route(
    "/api/v1/admin/web-imports",
    createAdminWebImportRoutes({ controller: webImportController, authenticate: di.authenticate }),
  );
  app.route(
    "/api/v1/verifier-applications",
    createVerifierApplicationRoutes({
      controller: verifierApplicationController,
      authenticate: di.authenticate,
      requireLegalConsent: di.requireLegalConsent,
    }),
  );
  app.route(
    "/api/v1/admin/wa",
    createWaAdminRoutes({
      templateRepo: waTemplateRepo,
      usageRepo: waUsageRepo,
      logRepo: waLogRepo,
      sendWa: sendWaMessage,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/email",
    createEmailAdminRoutes({
      quotaRepo: di.emailQuotaRepo,
      logRepo: di.emailLogRepo,
      mailer: di.mailer,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/verifier-applications",
    createAdminVerifierApplicationRoutes({
      controller: verifierApplicationController,
      authenticate: di.authenticate,
    }),
  );

  // ---- Notification campaigns (admin/root): template + broadcast ----
  const notificationCampaignRepo = new NotificationCampaignRepositoryImpl(db);
  const processCampaignDelivery = new ProcessCampaignDeliveryUseCase(
    notificationCampaignRepo,
    di.notificationRepo,
    di.deviceTokenRepo,
    di.pushSender,
  );
  const notificationCampaignController = new NotificationCampaignController({
    createTemplate: new CreateNotificationTemplateUseCase(
      notificationCampaignRepo,
      di.auditRepo,
    ),
    updateTemplate: new UpdateNotificationTemplateUseCase(
      notificationCampaignRepo,
      di.auditRepo,
    ),
    deleteTemplate: new DeleteNotificationTemplateUseCase(
      notificationCampaignRepo,
      di.auditRepo,
    ),
    listTemplates: new ListNotificationTemplatesUseCase(notificationCampaignRepo),
    getTemplate: new GetNotificationTemplateUseCase(notificationCampaignRepo),
    createCampaign: new CreateCampaignDraftUseCase(notificationCampaignRepo),
    listCampaigns: new ListCampaignsUseCase(notificationCampaignRepo),
    getCampaign: new GetCampaignDetailUseCase(notificationCampaignRepo),
    cancelCampaign: new CancelCampaignUseCase(
      notificationCampaignRepo,
      di.auditRepo,
    ),
    sendCampaign: new SendCampaignUseCase(
      notificationCampaignRepo,
      di.auditRepo,
      processCampaignDelivery,
    ),
    retryCampaign: new RetryFailedCampaignRecipientsUseCase(
      notificationCampaignRepo,
      processCampaignDelivery,
    ),
    estimateAudience: new EstimateCampaignAudienceUseCase(
      notificationCampaignRepo,
    ),
  });
  app.route(
    "/api/v1/admin/notification-templates",
    createAdminNotificationTemplateRoutes({
      controller: notificationCampaignController,
      authenticate: di.authenticate,
    }),
  );
  app.route(
    "/api/v1/admin/notification-campaigns",
    createAdminNotificationCampaignRoutes({
      controller: notificationCampaignController,
      authenticate: di.authenticate,
    }),
  );


  // Lookup definisi lemma (KBBI via port) - prefill field definition di form
  // form kontribusi web (anonim). Tidak menulis DB.
  const lemmaDefinitionRegistry = createLemmaDefinitionProviderRegistry();
  const lemmaDefinitionController = new LemmaDefinitionController({
    lookup: new LookupLemmaDefinitionUseCase(
      lemmaDefinitionRegistry,
      env.LEMMA_DEFINITION_CACHE_TTL_SECONDS,
    ),
  });
  app.route(
    "/api/v1/lemma-definitions",
    createLemmaDefinitionRoutes({ controller: lemmaDefinitionController }),
  );

  // Feed lintas aktivitas publik (37-api-activity-feed.md). Beranda mobile.
  // Baca dari activity_events (#86); repo lama masih dipakai card-share.
  const activityRepo = new ActivityRepositoryImpl(db);
  const activityController = new ActivityController({
    list: new ListActivityUseCase(di.activityEventFeedRepo),
    recordCardShare: new RecordCardShareUseCase(activityRepo, di.activityEventRepo),
  });
  app.route(
    "/api/v1/activity",
    createActivityRoutes({ controller: activityController, softAuthenticate: di.softAuthenticate }),
  );
  app.route(
    "/api/v1/words",
    createCardShareRoutes({ controller: activityController, authenticate: di.authenticate }),
  );

  // Latar kartu share - multi-provider multi-provider. Publik.
  const shareBackgroundProviders = createShareBackgroundProviderRegistry();
  const shareController = new ShareController({
    listBackgrounds: new ListShareBackgroundsUseCase(
      shareBackgroundProviders,
      env.SHARE_BACKGROUNDS_CACHE_TTL_SECONDS,
    ),
    listProviders: () =>
      listShareBackgroundProviderInfos(shareBackgroundProviders),
    trackUnsplashDownload: async (id) =>
      (await shareBackgroundProviders.get("unsplash")?.trackDownload?.(id)) ??
      false,
  });
  app.route("/api/v1/share", createShareRoutes({ controller: shareController }));

  // Resolve tautan Google Maps → lat/lng (pin picker; tanpa Places API)
  const geoController = new GeoController({
    resolveMapsUrl: new ResolveMapsUrlUseCase({ fetch }),
  });
  app.route("/api/v1/geo", createGeoRoutes({ controller: geoController }));

  // OpenAPI spec + Scalar docs (api-base-stack.md Section 9)
}
