/** Repositories, use cases, controllers, auth middleware (manual DI). */
import { SuggestMentionUsersUseCase } from "@/modules/user/application/use-cases/suggest-mention-users.use-case";
import { env } from "@/shared/config/env";
import { client, db } from "@/shared/database/drizzle/client";
import { bindCanContributeLookup } from "@/modules/word/application/utils/assert-can-contribute";
import { lookupCanContribute } from "@/modules/word/application/utils/can-contribute-lookup";
import {
  createAuthenticateMiddleware,
  createOptionalAuthenticateMiddleware,
  createSoftAuthenticateMiddleware,
  scheduleAuthenticatedSideEffect,
} from "@/shared/middlewares/authenticate.middleware";
import { createTouchLastSeen } from "@/modules/auth/infrastructure/touch-last-seen";
import { createRequireApprovedClientMiddleware } from "@/shared/middlewares/require-approved-client.middleware";
import { createRequireLegalConsentMiddleware } from "@/shared/middlewares/require-legal-consent.middleware";
import { ApiClientRepositoryImpl } from "@/modules/developer-oauth/infrastructure/api-client.repository.impl";
import { ResolveFirstPartyClientUseCase } from "@/modules/developer-oauth/application/use-cases/resolve-first-party-client.use-case";
import { UserRepositoryImpl } from "@/modules/auth/infrastructure/user.repository.impl";
import { RefreshTokenRepositoryImpl } from "@/modules/auth/infrastructure/refresh-token.repository.impl";
import { PasswordResetTokenRepositoryImpl } from "@/modules/auth/infrastructure/password-reset-token.repository.impl";
import { JwtTokenService } from "@/modules/auth/infrastructure/jwt-token.service";
import { Pbkdf2PasswordService } from "@/modules/auth/infrastructure/pbkdf2-password.service";
import { createMailer } from "@/modules/auth/infrastructure/mailer.factory";
import {
  EmailQuotaRepositoryImpl,
  EmailUsageRepositoryImpl,
  EmailLogRepositoryImpl,
} from "@/modules/email/infrastructure/email.repository.impl";
import { createEmailDomainVerifier } from "@/modules/auth/infrastructure/email-domain-verifier.factory";
import { EmailVerificationOtpRepositoryImpl } from "@/modules/auth/infrastructure/email-verification-otp.repository.impl";
import { RegisterUserUseCase } from "@/modules/auth/application/use-cases/register-user.use-case";
import { AppSettingsRepositoryImpl } from "@/modules/legal/infrastructure/app-settings.repository.impl";
import { LegalDocumentRepositoryImpl } from "@/modules/legal/infrastructure/legal-document.repository.impl";
import { UserConsentRepositoryImpl } from "@/modules/legal/infrastructure/user-consent.repository.impl";
import { LoginUserUseCase } from "@/modules/auth/application/use-cases/login-user.use-case";
import { VerifyEmailUseCase } from "@/modules/auth/application/use-cases/verify-email.use-case";
import { ResendOtpUseCase } from "@/modules/auth/application/use-cases/resend-otp.use-case";
import { RefreshTokenUseCase } from "@/modules/auth/application/use-cases/refresh-token.use-case";
import { LogoutUserUseCase } from "@/modules/auth/application/use-cases/logout-user.use-case";
import { LogoutAllDevicesUseCase } from "@/modules/auth/application/use-cases/logout-all-devices.use-case";
import { ForgotPasswordUseCase } from "@/modules/auth/application/use-cases/forgot-password.use-case";
import { ResetPasswordUseCase } from "@/modules/auth/application/use-cases/reset-password.use-case";
import { ChangePasswordUseCase } from "@/modules/auth/application/use-cases/change-password.use-case";
import { SetPasswordUseCase } from "@/modules/auth/application/use-cases/set-password.use-case";
import { AuthController } from "@/modules/auth/presentation/v1/auth.controller";
import { AuthIdentityRepositoryImpl } from "@/modules/auth/infrastructure/auth-identity.repository.impl";
import { googleTokenVerifier } from "@/modules/auth/infrastructure/google-token-verifier.holder";
import { facebookTokenVerifier } from "@/modules/auth/infrastructure/facebook-token-verifier.holder";
import { githubTokenVerifier } from "@/modules/auth/infrastructure/github-token-verifier.holder";
import { LoginWithGoogleUseCase } from "@/modules/auth/application/use-cases/login-with-google.use-case";
import { SocialConsentService } from "@/modules/auth/application/utils/social-consent";
import { LoginWithFacebookUseCase } from "@/modules/auth/application/use-cases/login-with-facebook.use-case";
import { LoginWithGithubUseCase } from "@/modules/auth/application/use-cases/login-with-github.use-case";
import {
  LinkGoogleAccountUseCase,
  ListAuthProvidersUseCase,
  UnlinkGoogleAccountUseCase,
} from "@/modules/auth/application/use-cases/link-google-account.use-case";
import {
  LinkGithubAccountUseCase,
  UnlinkGithubAccountUseCase,
} from "@/modules/auth/application/use-cases/link-github-account.use-case";
import { GithubOauthCodeExchanger } from "@/modules/auth/infrastructure/github-oauth-code-exchanger";
import { WordRepositoryImpl } from "@/modules/word/infrastructure/word.repository.impl";
import { FtsWordSearchIndex } from "@/modules/word/infrastructure/fts-word-search-index";
import { CreateWordUseCase } from "@/modules/word/application/use-cases/create-word.use-case";
import { UpdateWordUseCase } from "@/modules/word/application/use-cases/update-word.use-case";
import { GetWordByIdUseCase } from "@/modules/word/application/use-cases/get-word-by-id.use-case";
import { GetWordByLemmaUseCase } from "@/modules/word/application/use-cases/get-word-by-lemma.use-case";
import { GetWordOfDayUseCase } from "@/modules/word/application/use-cases/get-word-of-day.use-case";
import { SearchWordsUseCase } from "@/modules/word/application/use-cases/search-words.use-case";
import { ListAdminWordsUseCase } from "@/modules/word/application/use-cases/list-admin-words.use-case";
import { ListWordsUseCase } from "@/modules/word/application/use-cases/list-words.use-case";
import { ListLatestWordsUseCase } from "@/modules/word/application/use-cases/list-latest-words.use-case";
import { ListDuplicateWordsUseCase } from "@/modules/word/application/use-cases/list-duplicate-words.use-case";
import { MergeDuplicateWordsUseCase } from "@/modules/word/application/use-cases/merge-duplicate-words.use-case";
import { ListCommaSplitsUseCase } from "@/modules/word/application/use-cases/list-comma-splits.use-case";
import { ApplyCommaSplitUseCase } from "@/modules/word/application/use-cases/apply-comma-split.use-case";
import { MarkCommaLiteralUseCase } from "@/modules/word/application/use-cases/mark-comma-literal.use-case";
import { VerifyWordUseCase } from "@/modules/word/application/use-cases/verify-word.use-case";
import { VerifyMeaningUseCase } from "@/modules/word/application/use-cases/verify-meaning.use-case";
import { SyncLiveWordContributionsUseCase } from "@/modules/contribution/application/use-cases/sync-live-word-contributions.use-case";
import { PublishWordUseCase } from "@/modules/word/application/use-cases/publish-word.use-case";
import { SoftDeleteWordUseCase } from "@/modules/word/application/use-cases/soft-delete-word.use-case";
import { BulkWordsActionUseCase } from "@/modules/word/application/use-cases/bulk-words-action.use-case";
import { TakedownWordUseCase } from "@/modules/word/application/use-cases/takedown-word.use-case";
import { RestoreWordUseCase } from "@/modules/word/application/use-cases/restore-word.use-case";
import { AddPronunciationUseCase } from "@/modules/word/application/use-cases/add-pronunciation.use-case";
import { AddMeaningUseCase } from "@/modules/word/application/use-cases/add-meaning.use-case";
import { ImportWordsUseCase } from "@/modules/word/application/use-cases/import-words.use-case";
import { BatchContributeWordsUseCase } from "@/modules/word/application/use-cases/batch-contribute-words.use-case";
import { RollbackWordImportSessionUseCase } from "@/modules/word/application/use-cases/rollback-word-import-session.use-case";
import {
  ClaimWordImportSessionUseCase,
  GetWordImportSessionUseCase,
  ListWordImportSessionsUseCase,
  SaveWordImportSessionUseCase,
} from "@/modules/word/application/use-cases/word-import-session.use-cases";
import { WordImportSessionRepositoryImpl } from "@/modules/word/infrastructure/word-import-session.repository.impl";
import { AddWordImageUseCase } from "@/modules/word/application/use-cases/add-word-image.use-case";
import { AddExampleUseCase } from "@/modules/word/application/use-cases/add-example.use-case";
import { UpdateExampleUseCase } from "@/modules/word/application/use-cases/update-example.use-case";
import { UploadPronunciationAudioUseCase } from "@/modules/word/application/use-cases/upload-pronunciation-audio.use-case";
import { DeletePronunciationAudioUseCase } from "@/modules/word/application/use-cases/delete-pronunciation-audio.use-case";
import { SoftDeleteMeaningUseCase } from "@/modules/word/application/use-cases/soft-delete-meaning.use-case";
import { createPronunciationStorage } from "@/modules/word/infrastructure/pronunciation-storage.factory";
import { WordController } from "@/modules/word/presentation/v1/word.controller";
import {
  GetWordViewReportUseCase,
  GetWordViewSeriesUseCase,
  ListWordViewsUseCase,
  RecordWordViewByIdUseCase,
  RecordWordViewByLemmaUseCase,
} from "@/modules/word/application/use-cases/word-views.use-cases";
import { WordViewsRepositoryImpl } from "@/modules/word/infrastructure/word-views.repository.impl";
import { WordViewsController } from "@/modules/word/presentation/v1/word-views.controller";
import { WordSuggestionController } from "@/modules/word-suggestions/presentation/v1/word-suggestions.controller";
import { WordSuggestionRepositoryImpl } from "@/modules/word-suggestions/infrastructure/word-suggestion.repository.impl";
import { ContributionRepositoryImpl } from "@/modules/contribution/infrastructure/contribution.repository.impl";
import { UserSkipRepository } from "@/modules/user-skip/infrastructure/user-skip.repository";
import { ListContributionsUseCase } from "@/modules/contribution/application/use-cases/list-contributions.use-case";
import { GetContributionDetailUseCase } from "@/modules/contribution/application/use-cases/get-contribution-detail.use-case";
import { ReviewContributionUseCase } from "@/modules/contribution/application/use-cases/review-contribution.use-case";
import { CorrectContributionUseCase } from "@/modules/contribution/application/use-cases/correct-contribution.use-case";
import { ReopenContributionUseCase } from "@/modules/contribution/application/use-cases/reopen-contribution.use-case";
import { SkipContributionUseCase } from "@/modules/contribution/application/use-cases/skip-contribution.use-case";
import { ContributionController } from "@/modules/contribution/presentation/v1/contribution.controller";
import { ConfirmDuplicateMeaningUseCase } from "@/modules/contribution/application/use-cases/confirm-duplicate-meaning.use-case";
import { MyContributionController } from "@/modules/contribution/presentation/v1/my-contribution.controller";
import { ListMyContributionsUseCase } from "@/modules/contribution/application/use-cases/list-my-contributions.use-case";
import { GetMyContributionDetailUseCase } from "@/modules/contribution/application/use-cases/get-my-contribution-detail.use-case";
import { SearchMissRepositoryImpl } from "@/modules/search-miss/infrastructure/search-miss.repository.impl";
import { ListSearchMissesUseCase } from "@/modules/search-miss/application/use-cases/list-search-misses.use-case";
import { DismissSearchMissUseCase } from "@/modules/search-miss/application/use-cases/dismiss-search-miss.use-case";
import { BulkDismissSearchMissUseCase } from "@/modules/search-miss/application/use-cases/bulk-dismiss-search-miss.use-case";
import { SkipSearchMissUseCase } from "@/modules/search-miss/application/use-cases/skip-search-miss.use-case";
import { UpdateSearchMissUseCase } from "@/modules/search-miss/application/use-cases/update-search-miss.use-case";
import { ResolveSearchMissUseCase } from "@/modules/search-miss/application/use-cases/resolve-search-miss.use-case";
import { SearchMissController } from "@/modules/search-miss/presentation/v1/search-miss.controller";
import { AnnouncementRepositoryImpl } from "@/modules/announcement/infrastructure/announcement.repository.impl";
import {
  CreateAnnouncementUseCase,
  UpdateAnnouncementUseCase,
  DeleteAnnouncementUseCase,
  ListPinnedAnnouncementsUseCase,
} from "@/modules/announcement/application/use-cases/announcement.use-cases";
import { ListAnnouncementsUseCase } from "@/modules/announcement/application/use-cases/list-announcements.use-case";
import { AnnouncementController } from "@/modules/announcement/presentation/v1/announcement.controller";
import { HotTopicsRepositoryImpl } from "@/modules/hot-topics/infrastructure/hot-topics.repository.impl";
import { ListHotTopicsUseCase } from "@/modules/hot-topics/application/list-hot-topics.use-case";
import { HotTopicsController } from "@/modules/hot-topics/presentation/v1/hot-topics.controller";
import { AboutRepositoryImpl } from "@/modules/about/infrastructure/about.repository.impl";
import {
  CreateSponsorshipUseCase,
  DeleteSponsorshipUseCase,
  ListAdminSponsorshipsUseCase,
  ListContributorsUseCase,
  ListPublicSponsorshipsUseCase,
  ListSplashSponsorshipsUseCase,
  ListTeamUseCase,
  ListVerifiersUseCase,
  SetUserSponsorUseCase,
  UpdateSponsorshipUseCase,
} from "@/modules/about/application/use-cases/about.use-cases";
import { AboutController } from "@/modules/about/presentation/v1/about.controller";
import { AchievementRepositoryImpl } from "@/modules/achievement/infrastructure/achievement.repository.impl";
import {
  CreateAchievementUseCase,
  DeleteAchievementUseCase,
  GrantAchievementUseCase,
  PreviewAchievementUseCase,
  RevokeUserAchievementUseCase,
  SetActiveBorderUseCase,
  UpdateAchievementUseCase,
} from "@/modules/achievement/application/use-cases/achievement-admin.use-cases";
import { ScanAchievementUseCase } from "@/modules/achievement/application/use-cases/scan-achievement.use-case";
import { RunDueAchievementScanUseCase } from "@/modules/achievement/application/use-cases/run-due-achievement-scan.use-case";
import { RunStreakReminderUseCase } from "@/modules/leveling/application/run-streak-reminder.use-case";
import {
  ListActiveAchievementsUseCase,
  ListMyAchievementsUseCase,
  ListUserAchievementsUseCase,
} from "@/modules/achievement/application/use-cases/list-achievements.use-case";
import { AchievementController } from "@/modules/achievement/presentation/v1/achievement.controller";
import { LeaderboardRepositoryImpl } from "@/modules/leaderboard/infrastructure/leaderboard.repository.impl";
import { createLeaderboardStorage } from "@/modules/leaderboard/infrastructure/leaderboard-storage.factory";
import { ComputeLiveLeaderboardUseCase } from "@/modules/leaderboard/application/use-cases/compute-live-leaderboard.use-case";
import { FinalizeLeaderboardWeekUseCase } from "@/modules/leaderboard/application/use-cases/finalize-leaderboard-week.use-case";
import { RunDueLeaderboardJobsUseCase } from "@/modules/leaderboard/application/use-cases/run-due-leaderboard-jobs.use-case";
import { GetLeaderboardUseCase } from "@/modules/leaderboard/application/use-cases/get-leaderboard.use-case";
import { ManageLeaderboardExclusionsUseCase } from "@/modules/leaderboard/application/use-cases/manage-leaderboard-exclusions.use-case";
import { GetPointsHistoryUseCase } from "@/modules/leaderboard/application/use-cases/get-points-history.use-case";
import { UserXpSnapshotAdapter } from "@/modules/leaderboard/infrastructure/user-xp-snapshot.adapter";
import { LeaderboardController } from "@/modules/leaderboard/presentation/v1/leaderboard.controller";
import { PlaceRepositoryImpl } from "@/modules/place/infrastructure/place.repository.impl";
import {
  AppendPlaceImagesUseCase,
  HidePlaceImageUseCase,
  CreatePlaceUseCase,
  DeletePlaceUseCase,
  GetPlaceBySlugUseCase,
  GetPlaceViewReportUseCase,
  ListPlaceImagesUseCase,
  ListPlaceViewsUseCase,
  ListPlacesUseCase,
  RecordPlaceViewUseCase,
  UpdatePlaceUseCase,
} from "@/modules/place/application/use-cases/place.use-cases";
import { PlaceController } from "@/modules/place/presentation/v1/place.controller";
import {
  CreatePlaceCommentUseCase,
  DeletePlaceCommentUseCase,
  ListPlaceCommentsUseCase,
  TakedownPlaceCommentUseCase,
  UpdatePlaceCommentUseCase,
} from "@/modules/place/application/use-cases/place-comment.use-cases";
import { CreatePlaceCommentAudioUseCase } from "@/modules/place/application/use-cases/place-comment-audio.use-case";
import { PlaceContributionRepositoryImpl } from "@/modules/place-contribution/infrastructure/place-contribution.repository.impl";
import { PlaceContributionUseCases } from "@/modules/place-contribution/application/place-contribution.use-cases";
import { PlaceContributionController } from "@/modules/place-contribution/presentation/v1/place-contribution.controller";
import { EventRepositoryImpl } from "@/modules/event/infrastructure/event.repository.impl";
import {
CreateEventUseCase,
DeleteEventUseCase,
GetEventBySlugUseCase,
ListEventCategoriesUseCase,
ListEventImagesUseCase,
AppendEventImagesUseCase,
HideEventImageUseCase,
ListEventsUseCase,
SetEventCancelledUseCase,
UpdateEventUseCase,
} from "@/modules/event/application/use-cases/event.use-cases";
import { EventController } from "@/modules/event/presentation/v1/event.controller";
import {
  CreateEventCommentUseCase,
  DeleteEventCommentUseCase,
  ListEventCommentsUseCase,
  TakedownEventCommentUseCase,
  UpdateEventCommentUseCase,
} from "@/modules/event/application/use-cases/event-comment.use-cases";
import { CreateEventCommentAudioUseCase } from "@/modules/event/application/use-cases/event-comment-audio.use-case";
import { EventContributionRepositoryImpl } from "@/modules/event-contribution/infrastructure/event-contribution.repository.impl";
import { EventContributionUseCases } from "@/modules/event-contribution/application/event-contribution.use-cases";
import { EventContributionController } from "@/modules/event-contribution/presentation/v1/event-contribution.controller";
import { EventGoingRepositoryImpl } from "@/modules/event-going/infrastructure/event-going.repository.impl";
import {
  ListEventGoingsUseCase,
  MarkEventGoingUseCase,
  UnmarkEventGoingUseCase,
} from "@/modules/event-going/application/use-cases/event-going.use-cases";
import { EventGoingController } from "@/modules/event-going/presentation/v1/event-going.controller";
import { PlaceVisitRepositoryImpl } from "@/modules/place-visit/infrastructure/place-visit.repository.impl";
import {
  ListPlaceVisitsUseCase,
  MarkPlaceVisitUseCase,
  UnmarkPlaceVisitUseCase,
} from "@/modules/place-visit/application/use-cases/place-visit.use-cases";
import { PlaceVisitController } from "@/modules/place-visit/presentation/v1/place-visit.controller";
import { UsahaVisitRepositoryImpl } from "@/modules/usaha-visit/infrastructure/usaha-visit.repository.impl";
import {
  ListUsahaVisitsUseCase,
  MarkUsahaVisitUseCase,
  UnmarkUsahaVisitUseCase,
} from "@/modules/usaha-visit/application/use-cases/usaha-visit.use-cases";
import { UsahaVisitController } from "@/modules/usaha-visit/presentation/v1/usaha-visit.controller";
import { UsahaCategoryRepositoryImpl } from "@/modules/usaha-category/infrastructure/usaha-category.repository.impl";
import {
  CreateUsahaCategoryUseCase,
  DeleteUsahaCategoryUseCase,
  GetUsahaCategoryUseCase,
  ListUsahaCategoriesUseCase as ListUsahaCategoryCatalogUseCase,
  UpdateUsahaCategoryUseCase,
} from "@/modules/usaha-category/application/use-cases/usaha-category.use-cases";
import { UsahaCategoryController } from "@/modules/usaha-category/presentation/v1/usaha-category.controller";
import { UsahaRepositoryImpl } from "@/modules/usaha/infrastructure/usaha.repository.impl";
import {
  CreateUsahaUseCase,
  DeleteUsahaUseCase,
  FindUsahaDuplicatesUseCase,
  AppendUsahaImagesUseCase,
  GetUsahaBySlugUseCase,
  HideUsahaImageUseCase,
  ListUsahaImagesUseCase,
  ListUsahaCategoriesUseCase,
  ListUsahasUseCase,
  RestoreUsahaUseCase,
  RestrictUsahaUseCase,
  UniqueUsahaSlugUseCase,
  UpdateUsahaUseCase,
} from "@/modules/usaha/application/use-cases/usaha.use-cases";
import { ListMyUsahaUseCase } from "@/modules/usaha/application/use-cases/list-my-usaha.use-case";
import { UsahaController } from "@/modules/usaha/presentation/v1/usaha.controller";
import {
  GetUsahaViewReportUseCase,
  ListUsahaViewsUseCase,
  RecordUsahaViewBySlugUseCase,
} from "@/modules/usaha/application/use-cases/usaha-views.use-cases";
import { UsahaViewsRepositoryImpl } from "@/modules/usaha/infrastructure/usaha-views.repository.impl";
import { UsahaViewsController } from "@/modules/usaha/presentation/v1/usaha-views.controller";
import {
  CreateUsahaCommentUseCase,
  DeleteUsahaCommentUseCase,
  ListUsahaCommentsUseCase,
  TakedownUsahaCommentUseCase,
  UpdateUsahaCommentUseCase,
} from "@/modules/usaha/application/use-cases/usaha-comment.use-cases";
import { CreateUsahaCommentAudioUseCase } from "@/modules/usaha/application/use-cases/usaha-comment-audio.use-case";
import { UsahaContributionRepositoryImpl } from "@/modules/usaha-contribution/infrastructure/usaha-contribution.repository.impl";
import { UsahaContributionUseCases } from "@/modules/usaha-contribution/application/usaha-contribution.use-cases";
import { UsahaContributionController } from "@/modules/usaha-contribution/presentation/v1/usaha-contribution.controller";
import { LayananRepositoryImpl } from "@/modules/layanan/infrastructure/layanan.repository.impl";
import { LayananUseCases } from "@/modules/layanan/application/layanan.use-cases";
import { LayananController } from "@/modules/layanan/presentation/v1/layanan.controller";
import { KaryaRepositoryImpl } from "@/modules/karya/infrastructure/karya.repository.impl";
import { KaryaUseCases } from "@/modules/karya/application/karya.use-cases";
import { ResolveKaryaRelated } from "@/modules/karya/application/resolve-karya-related";
import { KaryaController } from "@/modules/karya/presentation/v1/karya.controller";
import { CreateKaryaLemmaLinkUseCase } from "@/modules/karya/application/use-cases/create-karya-lemma-link.use-case";
import { DeleteKaryaLemmaLinkUseCase } from "@/modules/karya/application/use-cases/delete-karya-lemma-link.use-case";
import { ListKaryaExcerptLemmaLinksUseCase } from "@/modules/karya/application/use-cases/list-karya-excerpt-lemma-links.use-case";
import { ProposeKaryaLemmaCorrectionUseCase } from "@/modules/karya/application/use-cases/propose-karya-lemma-correction.use-case";
import { ResolveKaryaLemmaCorrectionUseCase } from "@/modules/karya/application/use-cases/resolve-karya-lemma-correction.use-case";
import { KaryaLemmaLinkController } from "@/modules/karya/presentation/v1/karya-lemma-link.controller";
import { KreatorRepositoryImpl } from "@/modules/kreator/infrastructure/kreator.repository.impl";
import { KreatorUseCases } from "@/modules/kreator/application/kreator.use-cases";
import { KreatorController } from "@/modules/kreator/presentation/v1/kreator.controller";
import { BalehoRepositoryImpl } from "@/modules/baleho/infrastructure/baleho.repository.impl";
import { BalehoUseCases } from "@/modules/baleho/application/baleho.use-cases";
import { BalehoController } from "@/modules/baleho/presentation/v1/baleho.controller";
import { UsahaClaimRepositoryImpl } from "@/modules/usaha-claim/infrastructure/usaha-claim.repository.impl";
import { UsahaClaimUseCases } from "@/modules/usaha-claim/application/usaha-claim.use-cases";
import { UsahaClaimController } from "@/modules/usaha-claim/presentation/v1/usaha-claim.controller";
import { UsahaReportRepositoryImpl } from "@/modules/usaha-report/infrastructure/usaha-report.repository.impl";
import { UsahaReportUseCases } from "@/modules/usaha-report/application/usaha-report.use-cases";
import { UsahaReportController } from "@/modules/usaha-report/presentation/v1/usaha-report.controller";
import { CulinaryCategoryRepositoryImpl } from "@/modules/culinary-category/infrastructure/culinary-category.repository.impl";
import {
  CreateCulinaryCategoryUseCase,
  DeleteCulinaryCategoryUseCase,
  GetCulinaryCategoryUseCase,
  ListKulinerCategoriesUseCase as ListCulinaryCategoryCatalogUseCase,
  UpdateCulinaryCategoryUseCase,
} from "@/modules/culinary-category/application/use-cases/culinary-category.use-cases";
import { CulinaryCategoryController } from "@/modules/culinary-category/presentation/v1/culinary-category.controller";
import { CulinaryRepositoryImpl } from "@/modules/culinary/infrastructure/culinary.repository.impl";
import {
  AppendCuisineImagesUseCase,
  DeleteCulinaryUseCase,
  FindCulinaryDuplicatesUseCase,
  GetCuisineBySlugUseCase,
  ListCuisinesUseCase,
  ListCulinaryCategoriesUseCase,
  RestoreCulinaryUseCase,
  RestrictCulinaryUseCase,
  UniqueCulinarySlugUseCase,
} from "@/modules/culinary/application/use-cases/culinary.use-cases";
import { CulinaryController } from "@/modules/culinary/presentation/v1/culinary.controller";
import {
  GetCuisineViewReportUseCase,
  ListCuisineViewsUseCase,
  RecordCuisineViewBySlugUseCase,
} from "@/modules/culinary/application/use-cases/cuisine-views.use-cases";
import { CuisineViewsRepositoryImpl } from "@/modules/culinary/infrastructure/cuisine-views.repository.impl";
import { CuisineViewsController } from "@/modules/culinary/presentation/v1/cuisine-views.controller";
import {
  CreateCuisineCommentUseCase,
  DeleteCuisineCommentUseCase,
  ListCuisineCommentsUseCase,
  TakedownCuisineCommentUseCase,
  UpdateCuisineCommentUseCase,
} from "@/modules/culinary/application/use-cases/cuisine-comment.use-cases";
import { CreateCuisineCommentAudioUseCase } from "@/modules/culinary/application/use-cases/cuisine-comment-audio.use-case";
import { CulinaryContributionRepositoryImpl } from "@/modules/culinary-contribution/infrastructure/culinary-contribution.repository.impl";
import { CulinaryContributionUseCases } from "@/modules/culinary-contribution/application/culinary-contribution.use-cases";
import { CulinaryContributionController } from "@/modules/culinary-contribution/presentation/v1/culinary-contribution.controller";
import { PlaceCategoryRepositoryImpl } from "@/modules/place-category/infrastructure/place-category.repository.impl";
import {
  CreatePlaceCategoryUseCase,
  DeletePlaceCategoryUseCase,
  GetPlaceCategoryUseCase,
  ListPlaceCategoriesUseCase,
  UpdatePlaceCategoryUseCase,
} from "@/modules/place-category/application/use-cases/place-category.use-cases";
import { PlaceCategoryController } from "@/modules/place-category/presentation/v1/place-category.controller";
import { RegionRepositoryImpl } from "@/modules/region/infrastructure/region.repository.impl";
// PRD relasi-lemma: kelompok makna (word_groups) - kelola + tampil publik.
import { WordGroupRepositoryImpl } from "@/modules/word-group/infrastructure/word-group.repository.impl";
import {
  AddWordGroupMemberUseCase,
  CreateWordGroupUseCase,
  DeleteWordGroupUseCase,
  GetWordGroupUseCase,
  ListWordGroupsUseCase,
  RemoveWordGroupMemberUseCase,
  UpdateWordGroupUseCase,
} from "@/modules/word-group/application/use-cases/word-group.use-cases";
import { WordGroupController } from "@/modules/word-group/presentation/v1/word-group.controller";
import {
  CreateRegionUseCase,
  DeleteRegionUseCase,
  GetRegionByIdUseCase,
  ListRegionsUseCase,
  UpdateRegionUseCase,
} from "@/modules/region/application/use-cases/region.use-cases";
import { RegionController } from "@/modules/region/presentation/v1/region.controller";
import { LanguageRepositoryImpl } from "@/modules/language/infrastructure/language.repository.impl";
import { ListLanguagesUseCase } from "@/modules/language/application/use-cases/list-languages.use-case";
import { ListDialectsUseCase } from "@/modules/language/application/use-cases/list-dialects.use-case";
import { LanguageController } from "@/modules/language/presentation/v1/language.controller";
import { CategoryRepositoryImpl } from "@/modules/category/infrastructure/category.repository.impl";
import { ListCategoriesUseCase } from "@/modules/category/application/use-cases/list-categories.use-case";
import {
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from "@/modules/category/application/use-cases/category.use-cases";
import { CategoryController } from "@/modules/category/presentation/v1/category.controller";
import { AuditLogRepositoryImpl } from "@/modules/audit/infrastructure/audit-log.repository.impl";
import { createImageStorage } from "@/modules/image/infrastructure/image-storage.factory";
import { CreateUploadCredentialsUseCase } from "@/modules/image/application/use-cases/create-upload-credentials.use-case";
import { WordReportRepositoryImpl } from "@/modules/word-report/infrastructure/word-report.repository.impl";
import { StickerRepositoryImpl } from "@/modules/sticker/infrastructure/sticker.repository.impl";
import {
  CreateStickerUseCase,
  DeleteStickerUseCase,
  GetActiveStickerUseCase,
  ListActiveStickersUseCase,
  ListAdminStickersUseCase,
  UpdateStickerUseCase,
} from "@/modules/sticker/application/use-cases/sticker.use-cases";
import { StickerController } from "@/modules/sticker/presentation/v1/sticker.controller";
import { ContentLinkRepositoryImpl } from "@/modules/content-link/infrastructure/content-link.repository.impl";
import { ResolveContentLinks } from "@/modules/content-link/application/resolve-content-links";
import {
  ListRelatedContentUseCase,
  ReplaceContentLinksUseCase,
} from "@/modules/content-link/application/content-link.use-cases";
import { TranslationRepositoryImpl } from "@/modules/translation/infrastructure/translation.repository.impl";
import { AutoPromoteLemmaExampleTranslationUseCase } from "@/modules/translation/application/use-cases/auto-promote-lemma-example-translation.use-case";
import { DashboardController } from "@/modules/dashboard/presentation/v1/dashboard.controller";
import { GetDashboardStatsUseCase } from "@/modules/dashboard/application/use-cases/get-dashboard-stats.use-case";
import { DashboardRepositoryImpl } from "@/modules/dashboard/infrastructure/dashboard.repository.impl";
import { WebAnalyticsController } from "@/modules/web-analytics/presentation/v1/web-analytics.controller";
import { GetWebAnalyticsUseCase } from "@/modules/web-analytics/application/use-cases/get-web-analytics.use-case";
import { PlayAnalyticsController } from "@/modules/play-analytics/presentation/v1/play-analytics.controller";
import { GetPlayAnalyticsUseCase } from "@/modules/play-analytics/application/use-cases/get-play-analytics.use-case";
import { FcmAnalyticsController } from "@/modules/fcm-analytics/presentation/v1/fcm-analytics.controller";
import { GetFcmAnalyticsUseCase } from "@/modules/fcm-analytics/application/use-cases/get-fcm-analytics.use-case";
import { MobileAnalyticsController } from "@/modules/mobile-analytics/presentation/v1/mobile-analytics.controller";
import { GetMobileAnalyticsUseCase } from "@/modules/mobile-analytics/application/use-cases/get-mobile-analytics.use-case";
import { createMobileAnalyticsProvider } from "@/modules/mobile-analytics/infrastructure/mobile-analytics-providers.factory";
import { VoteRepositoryImpl } from "@/modules/vote/infrastructure/vote.repository.impl";
import { ToggleVoteUseCase } from "@/modules/vote/application/use-cases/toggle-vote.use-case";
import { ApplyMeaningVoteTrustUseCase } from "@/modules/vote/application/use-cases/apply-meaning-vote-trust.use-case";
import { GetVoteCountsUseCase } from "@/modules/vote/application/use-cases/get-vote-counts.use-case";
import { GetMyVotesUseCase } from "@/modules/vote/application/use-cases/get-my-votes.use-case";
import { ListMyVoteHistoryUseCase } from "@/modules/vote/application/use-cases/list-my-vote-history.use-case";
import { GetVoteDeckUseCase } from "@/modules/vote/application/use-cases/get-vote-deck.use-case";
import { GetVoteCheckDeckUseCase } from "@/modules/vote/application/use-cases/get-vote-check-deck.use-case";
import { SkipVoteDeckWordUseCase } from "@/modules/vote/application/use-cases/skip-vote-deck-word.use-case";
import { VoteController } from "@/modules/vote/presentation/v1/vote.controller";
import { AdminVotesController } from "@/modules/vote/presentation/v1/admin-vote.controller";
import { WordVotersController } from "@/modules/vote/presentation/v1/word-voters.controller";
import { ListAdminVotesUseCase } from "@/modules/vote/application/use-cases/list-admin-votes.use-case";
import { ListWordVotersUseCase } from "@/modules/vote/application/use-cases/list-word-voters.use-case";
import { DeleteAdminVoteUseCase } from "@/modules/vote/application/use-cases/delete-admin-vote.use-case";
import { ResetTargetVotesUseCase } from "@/modules/vote/application/use-cases/reset-target-votes.use-case";
import { ResetVotesByClientUseCase } from "@/modules/vote/application/use-cases/reset-votes-by-client.use-case";
import { GetTopTargetVotesUseCase } from "@/modules/vote/application/use-cases/get-top-target-votes.use-case";
import { CommentRepositoryImpl } from "@/modules/comment/infrastructure/comment.repository.impl";
import { CreateCommentUseCase } from "@/modules/comment/application/use-cases/create-comment.use-case";
import { CreateCommentAudioUseCase } from "@/modules/comment/application/use-cases/create-comment-audio.use-case";
import { AttachCommentImageUseCase } from "@/modules/comment/application/use-cases/attach-comment-image.use-case";
import { ApproveCommentImageUseCase } from "@/modules/comment/application/use-cases/approve-comment-image.use-case";
import { RejectCommentImageUseCase } from "@/modules/comment/application/use-cases/reject-comment-image.use-case";
import { ListWordCommentsUseCase } from "@/modules/comment/application/use-cases/list-word-comments.use-case";
import { DeleteCommentUseCase } from "@/modules/comment/application/use-cases/delete-comment.use-case";
import { UpdateCommentUseCase } from "@/modules/comment/application/use-cases/update-comment.use-case";
import { GetCommentEditHistoryUseCase } from "@/modules/comment/application/use-cases/get-comment-edit-history.use-case";
import { ListAdminCommentsUseCase } from "@/modules/comment/application/use-cases/list-admin-comments.use-case";
import { ListMyCommentsUseCase } from "@/modules/comment/application/use-cases/list-my-comments.use-case";
import { TakedownCommentUseCase } from "@/modules/comment/application/use-cases/takedown-comment.use-case";
import { UncensorCommentUseCase } from "@/modules/comment/application/use-cases/uncensor-comment.use-case";
import { CommentController } from "@/modules/comment/presentation/v1/comment.controller";
import { CommentBlocklistRepositoryImpl } from "@/modules/comment-blocklist/infrastructure/comment-blocklist.repository.impl";
import { CreateBlocklistWordUseCase } from "@/modules/comment-blocklist/application/use-cases/create-blocklist-word.use-case";
import { BulkCreateBlocklistWordsUseCase } from "@/modules/comment-blocklist/application/use-cases/bulk-create-blocklist-words.use-case";
import { ListBlocklistWordsUseCase } from "@/modules/comment-blocklist/application/use-cases/list-blocklist-words.use-case";
import { DeleteBlocklistWordUseCase } from "@/modules/comment-blocklist/application/use-cases/delete-blocklist-word.use-case";
import { CommentBlocklistController } from "@/modules/comment-blocklist/presentation/v1/comment-blocklist.controller";
import { BookmarkRepositoryImpl } from "@/modules/bookmark/infrastructure/bookmark.repository.impl";
import { ToggleBookmarkUseCase } from "@/modules/bookmark/application/use-cases/toggle-bookmark.use-case";
import { GetMyBookmarksUseCase } from "@/modules/bookmark/application/use-cases/get-my-bookmarks.use-case";
import { BookmarkController } from "@/modules/bookmark/presentation/v1/bookmark.controller";
import { PublicUserRepositoryImpl } from "@/modules/user/infrastructure/public-user.repository.impl";
import { UsernameChangeRepositoryImpl } from "@/modules/user/infrastructure/username-change.repository.impl";
import { GetPublicProfileUseCase } from "@/modules/user/application/use-cases/get-public-profile.use-case";
import { GetPublicActivityUseCase } from "@/modules/user/application/use-cases/get-public-activity.use-case";
import { UploadAvatarUseCase } from "@/modules/user/application/use-cases/upload-avatar.use-case";
import { DeleteAvatarUseCase } from "@/modules/user/application/use-cases/delete-avatar.use-case";
import { UserController } from "@/modules/user/presentation/v1/user.controller";
import {
  GetMyProfileUseCase,
  UpdateMyProfileUseCase,
} from "@/modules/user/application/use-cases/update-my-profile.use-case";
import { createPublicImageStorage } from "@/modules/public-image/infrastructure/public-image-storage.factory";
import { DeviceTokenRepositoryImpl } from "@/modules/device/infrastructure/device-token.repository.impl";
import { RegisterDeviceTokenUseCase } from "@/modules/device/application/use-cases/register-device-token.use-case";
import { RevokeDeviceTokenUseCase } from "@/modules/device/application/use-cases/revoke-device-token.use-case";
import { NotifyUserUseCase } from "@/modules/device/application/use-cases/notify-user.use-case";
import { createPushSender } from "@/modules/device/infrastructure/push-sender.factory";
import { DeviceController } from "@/modules/device/presentation/v1/device.controller";
import { NotificationRepositoryImpl } from "@/modules/notification/infrastructure/notification.repository.impl";
import { NotificationPushCooldownRepositoryImpl } from "@/modules/notification/infrastructure/notification-push-cooldown.repository.impl";
import { RecordInboxNotificationUseCase } from "@/modules/notification/application/use-cases/record-inbox-notification.use-case";
import { ReviewPushCooldownGate } from "@/modules/notification/application/use-cases/review-push-cooldown-gate";
import { WordCommentPushCooldownGate } from "@/modules/notification/application/use-cases/word-comment-push-cooldown-gate";
import { DiscussionReplyPushCooldownGate, ReplyPushCooldownGate } from "@/modules/notification/application/use-cases/discussion-reply-push-cooldown-gate";
import { WordVotePushCooldownGate } from "@/modules/notification/application/use-cases/word-vote-push-cooldown-gate";
import { WordMediaPushCooldownGate } from "@/modules/notification/application/use-cases/word-media-push-cooldown-gate";
import { NotifyWordOwnerMediaUseCase } from "@/modules/notification/application/use-cases/notify-word-owner-media.use-case";
import { ActivityEventRepositoryImpl } from "@/modules/activity/infrastructure/activity-event.repository.impl";
import { ActivityEventFeedRepositoryImpl } from "@/modules/activity/infrastructure/activity-event-feed.repository.impl";
import { RecordActivityEventUseCase } from "@/modules/activity/application/use-cases/record-activity-event.use-case";
import { WaMessageLogRepositoryImpl } from "@/modules/wa/infrastructure/wa-message.repository.impl";
import { OpenWaExplorationGroupNotifier } from "@/modules/wa/infrastructure/openwa-exploration-group.notifier";
import { UgcAbuseEventRepositoryImpl } from "@/shared/moderation/ugc-abuse-event.repository";
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from "@/shared/moderation/record-abuse-signal.use-case";
import { UgcAnonAbuseRepositoryImpl } from "@/shared/moderation/ugc-anon-abuse.repository";
import {
  RecordAnonAbuseSignalUseCase,
  assertAnonWriteAllowed,
  safeRecordAnonAbuseSignal,
} from "@/shared/moderation/record-anon-abuse-signal.use-case";

import { createWebAnalyticsProviders } from "@/modules/web-analytics/infrastructure/web-analytics-providers.factory";
import { createPlayAnalyticsProviders } from "@/modules/play-analytics/infrastructure/play-analytics-providers.factory";
import { createFcmAnalyticsProviders } from "@/modules/fcm-analytics/infrastructure/fcm-analytics-providers.factory";
// ---- Composition root: rakit semua dependency (manual DI, api-base-stack.md Section 2) ----
bindCanContributeLookup(lookupCanContribute);
export const userRepo = new UserRepositoryImpl(db);
export const refreshTokenRepo = new RefreshTokenRepositoryImpl(db);
export const otpRepo = new EmailVerificationOtpRepositoryImpl(db);
export const resetTokenRepo = new PasswordResetTokenRepositoryImpl(db);
export const deviceTokenRepo = new DeviceTokenRepositoryImpl(db);
export const pushSender = createPushSender();
export const notifyUser = new NotifyUserUseCase(deviceTokenRepo, pushSender);
export const notificationRepo = new NotificationRepositoryImpl(db);
export const recordInbox = new RecordInboxNotificationUseCase(notificationRepo);
export const notificationPushCooldownRepo = new NotificationPushCooldownRepositoryImpl(
  db,
);
export const tokenService = new JwtTokenService({
  privateKeyPem: env.JWT_PRIVATE_KEY,
  publicKeyPem: env.JWT_PUBLIC_KEY,
  accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL,
});
export const hasher = new Pbkdf2PasswordService();
// Email: Resend (HTTP) kalau RESEND_API_KEY ter-set - jalur Cloudflare
// Workers; selain itu SMTP (Node). Keduanya implements MailerPort.
export const mailer = createMailer({
  quotaRepo: new EmailQuotaRepositoryImpl(db),
  usageRepo: new EmailUsageRepositoryImpl(db),
  logRepo: new EmailLogRepositoryImpl(db),
});
export const emailQuotaRepo = new EmailQuotaRepositoryImpl(db);
export const emailLogRepo = new EmailLogRepositoryImpl(db);
export const emailDomainVerifier = createEmailDomainVerifier();
export const identityRepo = new AuthIdentityRepositoryImpl(db);

// ---- Modul audit (Section 21) - direkspos ke use case modul lain ----
export const auditRepo = new AuditLogRepositoryImpl(db);
// Event log feed publik (write-through, #86) - dipakai lintas modul.
export const activityEventRepo = new ActivityEventRepositoryImpl(db);
export const activityEvents = new RecordActivityEventUseCase(activityEventRepo);
export const activityEventFeedRepo = new ActivityEventFeedRepositoryImpl(db);
export const appSettingsRepo = new AppSettingsRepositoryImpl(db);
export const legalDocumentRepo = new LegalDocumentRepositoryImpl(db);
export const userConsentRepo = new UserConsentRepositoryImpl(db);
export const apiClientRepo = new ApiClientRepositoryImpl(db);
export const resolveFirstPartyClient = new ResolveFirstPartyClientUseCase(
  apiClientRepo,
);

export const authController = new AuthController({
  register: new RegisterUserUseCase(
    userRepo,
    hasher,
    auditRepo,
    otpRepo,
    mailer,
    appSettingsRepo,
    userConsentRepo,
    emailDomainVerifier,
  ),
  login: new LoginUserUseCase(
    userRepo,
    hasher,
    tokenService,
    refreshTokenRepo,
    env.JWT_ACCESS_TOKEN_TTL,
    env.JWT_REFRESH_TOKEN_TTL,
  ),
  verifyEmail: new VerifyEmailUseCase(
    userRepo,
    otpRepo,
    tokenService,
    refreshTokenRepo,
    env.JWT_ACCESS_TOKEN_TTL,
    env.JWT_REFRESH_TOKEN_TTL,
    activityEvents,
  ),
  resendOtp: new ResendOtpUseCase(userRepo, otpRepo, mailer),
  refresh: new RefreshTokenUseCase(
    refreshTokenRepo,
    userRepo,
    tokenService,
    env.JWT_ACCESS_TOKEN_TTL,
    env.JWT_REFRESH_TOKEN_TTL,
    apiClientRepo,
  ),
  logout: new LogoutUserUseCase(refreshTokenRepo),
  logoutAll: new LogoutAllDevicesUseCase(refreshTokenRepo, deviceTokenRepo),
  forgot: new ForgotPasswordUseCase(
    userRepo,
    resetTokenRepo,
    mailer,
    `${env.webAppUrl}/reset-password`,
    identityRepo,
  ),
  reset: new ResetPasswordUseCase(
    resetTokenRepo,
    userRepo,
    hasher,
    auditRepo,
    refreshTokenRepo,
  ),
  changePassword: new ChangePasswordUseCase(
    userRepo,
    hasher,
    auditRepo,
    refreshTokenRepo,
  ),
  setPassword: new SetPasswordUseCase(
    userRepo,
    identityRepo,
    hasher,
    auditRepo,
    refreshTokenRepo,
    googleTokenVerifier,
    facebookTokenVerifier,
    githubTokenVerifier,
  ),
  google: new LoginWithGoogleUseCase(
    userRepo,
    identityRepo,
    googleTokenVerifier,
    tokenService,
    refreshTokenRepo,
    auditRepo,
    new SocialConsentService(appSettingsRepo, userConsentRepo),
    env.JWT_ACCESS_TOKEN_TTL,
    env.JWT_REFRESH_TOKEN_TTL,
    activityEvents,
  ),
  facebook: new LoginWithFacebookUseCase(
    userRepo,
    identityRepo,
    facebookTokenVerifier,
    tokenService,
    refreshTokenRepo,
    auditRepo,
    new SocialConsentService(appSettingsRepo, userConsentRepo),
    env.JWT_ACCESS_TOKEN_TTL,
    env.JWT_REFRESH_TOKEN_TTL,
    activityEvents,
  ),
  github: new LoginWithGithubUseCase(
    userRepo,
    identityRepo,
    githubTokenVerifier,
    tokenService,
    refreshTokenRepo,
    auditRepo,
    new SocialConsentService(appSettingsRepo, userConsentRepo),
    env.JWT_ACCESS_TOKEN_TTL,
    env.JWT_REFRESH_TOKEN_TTL,
    activityEvents,
  ),
  listProviders: new ListAuthProvidersUseCase(identityRepo, userRepo),
  linkGoogle: new LinkGoogleAccountUseCase(
    userRepo,
    identityRepo,
    googleTokenVerifier,
  ),
  unlinkGoogle: new UnlinkGoogleAccountUseCase(userRepo, identityRepo),
  linkGithub: new LinkGithubAccountUseCase(
    userRepo,
    identityRepo,
    githubTokenVerifier,
  ),
  unlinkGithub: new UnlinkGithubAccountUseCase(userRepo, identityRepo),
  githubCodeExchanger: new GithubOauthCodeExchanger(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
  ),
  resolveFirstPartyClient,
});

export const touchLastSeen = createTouchLastSeen(db);
export const onAuthenticated = (
  userId: string,
  c: Parameters<typeof scheduleAuthenticatedSideEffect>[0],
) => {
  scheduleAuthenticatedSideEffect(c, () => touchLastSeen(userId));
};
export const authenticate = createAuthenticateMiddleware(
  (token) => tokenService.verifyAccessToken(token),
  onAuthenticated,
);
export const optionalAuthenticate = createOptionalAuthenticateMiddleware(
  (token) => tokenService.verifyAccessToken(token),
  onAuthenticated,
);
/**
 * Gerbang consent legal untuk aksi tulis kontributor (403 CONSENT_REQUIRED).
 * Read path tidak digerbang. Lihat docs/api/44-api-consent-oauth.md.
 */
export const requireLegalConsent = createRequireLegalConsentMiddleware(
  appSettingsRepo,
  userConsentRepo,
);
/**
 * Feed beranda: token sah → bisa sembunyikan karya sendiri; token apa pun
 * selain itu tetap dapat feed publik. Tidak 401, dan tanpa presence touch.
 */
export const softAuthenticate = createSoftAuthenticateMiddleware((token) =>
  tokenService.verifyAccessToken(token),
);
export const requireVoteWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "vote.write",
  },
);
export const requireCommentWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "comment.write",
  },
);
export const requireContributeWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "contribute.write",
  },
);
/** Kontribusi kata publik: anon tanpa token lolos; Bearer wajib azp/scope. */
export const requireContributeWriteIfAuthed = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "contribute.write",
    allowMissingUser: true,
  },
);
export const requireDiscussionWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "discussion.write",
  },
);
export const requirePantunWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "discussion.write",
  },
);
export const requireBookmarkWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "bookmark.write",
  },
);
export const requireDeviceWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "device.write",
  },
);
export const requireProfileWriteClient = createRequireApprovedClientMiddleware(
  apiClientRepo,
  {
    scope: "profile.read",
  },
);

// ---- Modul word (+ language & category sebagai data referensi form admin) ----
// Index FTS5 untuk ranking pencarian (port WordSearchIndex - swap ke
// Elasticsearch nanti cukup ganti adapter di sini, tanpa ubah use case).
export const wordRepo = new WordRepositoryImpl(db, new FtsWordSearchIndex(client));
export const translationRepo = new TranslationRepositoryImpl(db);
export const autoPromoteLemmaExampleTranslation =
  new AutoPromoteLemmaExampleTranslationUseCase(translationRepo);
export const wordViewsRepo = new WordViewsRepositoryImpl(db);
export const wordViewsController = new WordViewsController(
  new RecordWordViewByIdUseCase(wordViewsRepo),
  new RecordWordViewByLemmaUseCase(wordViewsRepo),
  new ListWordViewsUseCase(wordViewsRepo),
  new GetWordViewReportUseCase(wordViewsRepo),
  new GetWordViewSeriesUseCase(wordViewsRepo),
);
export const karyaRepo = new KaryaRepositoryImpl(db);
// #133: notif pemilik kata saat contoh kalimat / audio pelafalan tayang.
export const wordMediaPushCooldown = new WordMediaPushCooldownGate(
  appSettingsRepo,
  notificationPushCooldownRepo,
);
export const notifyWordOwnerMedia = new NotifyWordOwnerMediaUseCase(
  wordRepo,
  recordInbox,
  notifyUser,
  userRepo,
  wordMediaPushCooldown,
);
export const wordImportSessionRepo = new WordImportSessionRepositoryImpl(db);
export const wordReportRepo = new WordReportRepositoryImpl(db);
export const softDeleteMeaning = new SoftDeleteMeaningUseCase(
  wordRepo,
  auditRepo,
  async ({ meaningId, actorId }) => {
    await wordReportRepo.closeOpenForMeaning(meaningId, actorId, null);
  },
);
export const takedownWord = new TakedownWordUseCase(
  wordRepo,
  auditRepo,
  wordReportRepo,
  recordInbox,
);
export const restoreWord = new RestoreWordUseCase(wordRepo, auditRepo);
// Provider gambar dipilih via env IMAGE_PROVIDER (default imagekit) -
// pola factory yang sama dengan createMailer (Section 8)
export const imageStorage = createImageStorage();
export const pronunciationStorage = createPronunciationStorage();
export const publicImageStorage = createPublicImageStorage();
// Search miss: pencarian kosong → peluang kontribusi (03 doc) - direcord
// dari SearchWordsUseCase lewat interface modul search-miss (Section 4)
export const searchMissRepo = new SearchMissRepositoryImpl(db);
export const languageRepo = new LanguageRepositoryImpl(db);
export const ugcAbuseEventRepo = new UgcAbuseEventRepositoryImpl(db);
export const recordAbuseSignal = new RecordAbuseSignalUseCase(
  ugcAbuseEventRepo,
  userRepo,
  refreshTokenRepo,
  auditRepo,
  recordInbox,
);
export const ugcAnonAbuseRepo = new UgcAnonAbuseRepositoryImpl(db);
export const recordAnonAbuseSignal = new RecordAnonAbuseSignalUseCase(
  ugcAnonAbuseRepo,
);
export const onUgcRateLimited = async (userId: string) => {
  await safeRecordAbuseSignal(recordAbuseSignal, {
    userId,
    signal: "rate_lockout",
  });
};
export const onAnonRateLimited = async (ctx: {
  clientIp: string;
  deviceId: string | null;
}) => {
  await safeRecordAnonAbuseSignal(recordAnonAbuseSignal, {
    clientIp: ctx.clientIp,
    deviceId: ctx.deviceId,
    signal: "rate_lockout",
  });
};
export const contributionRepo = new ContributionRepositoryImpl(db);
export const syncLiveWordContributions = new SyncLiveWordContributionsUseCase(
  contributionRepo,
  recordInbox,
);
export const publishWord = new PublishWordUseCase(wordRepo, auditRepo, syncLiveWordContributions);
export const softDeleteWord = new SoftDeleteWordUseCase(wordRepo, auditRepo);
export const commentBlocklistRepo = new CommentBlocklistRepositoryImpl(db);
export const stickerRepo = new StickerRepositoryImpl(db);
export const contentLinkRepo = new ContentLinkRepositoryImpl(db);
export const resolveContentLinks = new ResolveContentLinks(db);
export const listRelatedContent = new ListRelatedContentUseCase(
  contentLinkRepo,
  resolveContentLinks,
);
export const replaceContentLinks = new ReplaceContentLinksUseCase(
  contentLinkRepo,
  resolveContentLinks,
);
export const wordController = new WordController({
  listRelated: listRelatedContent,
  create: new CreateWordUseCase(
    wordRepo,
    auditRepo,
    searchMissRepo,
    recordAbuseSignal,
    recordAnonAbuseSignal,
    activityEventRepo,
    syncLiveWordContributions,
  ),
  update: new UpdateWordUseCase(wordRepo, auditRepo, syncLiveWordContributions),
  getById: new GetWordByIdUseCase(wordRepo, karyaRepo),
  getByLemma: new GetWordByLemmaUseCase(wordRepo, karyaRepo),
  wordOfDay: new GetWordOfDayUseCase(wordRepo, appSettingsRepo),
  search: new SearchWordsUseCase(
    wordRepo,
    searchMissRepo,
    commentBlocklistRepo,
    activityEvents,
  ),
  listAdmin: new ListAdminWordsUseCase(wordRepo),
  list: new ListWordsUseCase(wordRepo),
  listLatest: new ListLatestWordsUseCase(wordRepo),
  listDuplicates: new ListDuplicateWordsUseCase(wordRepo),
  mergeDuplicates: new MergeDuplicateWordsUseCase(wordRepo, auditRepo),
  listCommaSplits: new ListCommaSplitsUseCase(wordRepo),
  applyCommaSplit: new ApplyCommaSplitUseCase(wordRepo, auditRepo),
  markCommaLiteral: new MarkCommaLiteralUseCase(wordRepo, auditRepo),
  verify: new VerifyWordUseCase(wordRepo, auditRepo, syncLiveWordContributions),
  verifyMeaning: new VerifyMeaningUseCase(wordRepo, auditRepo),
  publish: publishWord,
  deleteWord: softDeleteWord,
  bulkWords: new BulkWordsActionUseCase(softDeleteWord, publishWord),
  takedownWord,
  restoreWord,
  addPronunciation: new AddPronunciationUseCase(wordRepo, auditRepo),
  addWordImage: new AddWordImageUseCase(
    wordRepo,
    auditRepo,
    publicImageStorage.providerName,
  ),
  addExample: new AddExampleUseCase(
    wordRepo,
    auditRepo,
    commentBlocklistRepo,
    notifyWordOwnerMedia,
    autoPromoteLemmaExampleTranslation,
  ),
  updateExample: new UpdateExampleUseCase(wordRepo, auditRepo, commentBlocklistRepo),
  addMeaning: new AddMeaningUseCase(wordRepo, auditRepo),
  importWords: new ImportWordsUseCase(wordRepo, languageRepo, userRepo, activityEventRepo),
  batchContributeWords: new BatchContributeWordsUseCase(
    wordRepo,
    languageRepo,
    wordImportSessionRepo,
    recordAnonAbuseSignal,
  ),
  saveImportSession: new SaveWordImportSessionUseCase(
    wordImportSessionRepo,
    userRepo,
  ),
  listImportSessions: new ListWordImportSessionsUseCase(wordImportSessionRepo),
  getImportSession: new GetWordImportSessionUseCase(wordImportSessionRepo),
  claimImportSession: new ClaimWordImportSessionUseCase(
    wordImportSessionRepo,
    userRepo,
  ),
  rollbackImportSession: new RollbackWordImportSessionUseCase(
    wordImportSessionRepo,
    wordRepo,
    auditRepo,
  ),
  uploadPronunciationAudio: new UploadPronunciationAudioUseCase(
    wordRepo,
    pronunciationStorage,
    auditRepo,
    notifyWordOwnerMedia,
  ),
  deletePronunciationAudio: new DeletePronunciationAudioUseCase(
    wordRepo,
    pronunciationStorage,
    auditRepo,
  ),
  softDeleteMeaning,
  listWordClasses: () => wordRepo.listWordClasses(),
  // Stempel provider gambar kata = GitHub publik (bukan ImageKit)
  imageProviderName: publicImageStorage.providerName,
  assertAnonWriteAllowed: (ctx) =>
    assertAnonWriteAllowed(ugcAnonAbuseRepo, ctx),
});

// ---- Modul contribution - antrean review (Section 22 approval gate,
// 03-api-kontribusi-verifikasi.md). Baca entity word lewat interface
// WordRepository (batas modul Section 4). ----
export const userSkipRepo = new UserSkipRepository(db);
export const contributionController = new ContributionController({
  list: new ListContributionsUseCase(contributionRepo),
  getDetail: new GetContributionDetailUseCase(contributionRepo, wordRepo),
  review: new ReviewContributionUseCase(
    contributionRepo,
    auditRepo,
    wordRepo,
    publicImageStorage,
    imageStorage,
    notifyUser,
    recordInbox,
    new ReviewPushCooldownGate(appSettingsRepo, notificationPushCooldownRepo),
    recordAbuseSignal,
    activityEvents,
    notifyWordOwnerMedia,
    syncLiveWordContributions,
    autoPromoteLemmaExampleTranslation,
  ),
  correct: new CorrectContributionUseCase(
    contributionRepo,
    wordRepo,
    auditRepo,
    recordInbox,
    syncLiveWordContributions,
  ),
  reopen: new ReopenContributionUseCase(contributionRepo, auditRepo),
  skip: new SkipContributionUseCase(contributionRepo, userSkipRepo),
  imageProviderName: publicImageStorage.providerName,
});

export const searchMissController = new SearchMissController({
  list: new ListSearchMissesUseCase(searchMissRepo),
  dismiss: new DismissSearchMissUseCase(searchMissRepo, auditRepo),
  bulkDismiss: new BulkDismissSearchMissUseCase(searchMissRepo, auditRepo),
  update: new UpdateSearchMissUseCase(
    searchMissRepo,
    auditRepo,
    activityEvents,
  ),
  skip: new SkipSearchMissUseCase(searchMissRepo, userSkipRepo),
  resolve: new ResolveSearchMissUseCase(
    searchMissRepo,
    wordRepo,
    languageRepo,
    auditRepo,
  ),
});

export const hotTopicsRepo = new HotTopicsRepositoryImpl(db);
export const hotTopicsController = new HotTopicsController({
  list: new ListHotTopicsUseCase(hotTopicsRepo, commentBlocklistRepo),
});

export const languageController = new LanguageController({
  listLanguages: new ListLanguagesUseCase(languageRepo),
  listDialects: new ListDialectsUseCase(languageRepo),
});

// ---- Modul about: Tim Kami + sponsorships (pengganti CDN). ----
export const aboutRepo = new AboutRepositoryImpl(db);
export const setUserSponsorUseCase = new SetUserSponsorUseCase(aboutRepo);
export const aboutController = new AboutController({
  listTeam: new ListTeamUseCase(aboutRepo),
  listPublicSponsorships: new ListPublicSponsorshipsUseCase(aboutRepo),
  listSplashSponsorships: new ListSplashSponsorshipsUseCase(aboutRepo),
  listAdminSponsorships: new ListAdminSponsorshipsUseCase(aboutRepo),
  createSponsorship: new CreateSponsorshipUseCase(aboutRepo),
  updateSponsorship: new UpdateSponsorshipUseCase(aboutRepo),
  deleteSponsorship: new DeleteSponsorshipUseCase(aboutRepo),
  setUserSponsor: setUserSponsorUseCase,
  listContributors: new ListContributorsUseCase(aboutRepo),
  listVerifiers: new ListVerifiersUseCase(aboutRepo),
});

// ---- Modul announcement (#102) - pengumuman admin tayang di feed publik.
// Write-through activity_events (payload beku) + soft delete hide event. ----
export const announcementRepo = new AnnouncementRepositoryImpl(db);
export const announcementController = new AnnouncementController(
  new CreateAnnouncementUseCase(announcementRepo, activityEvents, auditRepo),
  new ListAnnouncementsUseCase(announcementRepo),
  new ListPinnedAnnouncementsUseCase(announcementRepo),
  (cmd) =>
    new UpdateAnnouncementUseCase(
      announcementRepo,
      activityEvents,
      auditRepo,
    ).execute(cmd),
  new DeleteAnnouncementUseCase(announcementRepo, activityEvents, auditRepo),
  announcementRepo,
);

export const placeRepo = new PlaceRepositoryImpl(db);
export const placeVisitRepo = new PlaceVisitRepositoryImpl(db);
export const placeVisitController = new PlaceVisitController({
  mark: new MarkPlaceVisitUseCase(placeVisitRepo, activityEvents),
  unmark: new UnmarkPlaceVisitUseCase(placeVisitRepo, activityEvents),
  list: new ListPlaceVisitsUseCase(placeVisitRepo),
});
export const placeCategoryRepo = new PlaceCategoryRepositoryImpl(db);
export const placeController = new PlaceController(
  new CreatePlaceUseCase(placeRepo, placeCategoryRepo, activityEvents),
  new UpdatePlaceUseCase(placeRepo, placeCategoryRepo, activityEvents),
  new DeletePlaceUseCase(placeRepo),
  new ListPlacesUseCase(placeRepo),
  new GetPlaceBySlugUseCase(placeRepo),
  new ListPlaceImagesUseCase(placeRepo),
  new AppendPlaceImagesUseCase(placeRepo, userRepo, activityEvents),
  new RecordPlaceViewUseCase(placeRepo),
  new ListPlaceViewsUseCase(placeRepo),
  new GetPlaceViewReportUseCase(placeRepo),
  new HidePlaceImageUseCase(placeRepo, activityEvents),
  listRelatedContent,
  replaceContentLinks,
  placeVisitRepo,
  {
    listComments: new ListPlaceCommentsUseCase(placeRepo),
    createComment: new CreatePlaceCommentUseCase(
      placeRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
      stickerRepo,
    ),
    createCommentAudio: new CreatePlaceCommentAudioUseCase(
      placeRepo,
      pronunciationStorage,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
    ),
    updateComment: new UpdatePlaceCommentUseCase(
      placeRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
    ),
    deleteComment: new DeletePlaceCommentUseCase(placeRepo),
    takedownComment: new TakedownPlaceCommentUseCase(placeRepo, auditRepo),
  },
);
export const placeCategoryController = new PlaceCategoryController(
  new CreatePlaceCategoryUseCase(placeCategoryRepo),
  new UpdatePlaceCategoryUseCase(placeCategoryRepo),
  new DeletePlaceCategoryUseCase(placeCategoryRepo),
  new ListPlaceCategoriesUseCase(placeCategoryRepo),
  new GetPlaceCategoryUseCase(placeCategoryRepo),
);

export const regionRepo = new RegionRepositoryImpl(db);
export const explorationGroupNotifier = new OpenWaExplorationGroupNotifier(
  userRepo,
  new WaMessageLogRepositoryImpl(db),
);
export const placeContributionController = new PlaceContributionController(
  new PlaceContributionUseCases(
    new PlaceContributionRepositoryImpl(db),
    placeRepo,
    placeCategoryRepo,
    regionRepo,
    userRepo,
    new CreatePlaceUseCase(placeRepo, placeCategoryRepo, activityEvents),
    new UpdatePlaceUseCase(placeRepo, placeCategoryRepo, activityEvents),
    recordInbox,
    notifyUser,
    explorationGroupNotifier,
  ),
);
export const regionController = new RegionController(
  new CreateRegionUseCase(regionRepo),
  new UpdateRegionUseCase(regionRepo),
  new DeleteRegionUseCase(regionRepo),
  new ListRegionsUseCase(regionRepo),
  new GetRegionByIdUseCase(regionRepo),
);

// ---- Modul event/acara (PRD event) ----
export const eventRepo = new EventRepositoryImpl(db);
export const eventGoingRepo = new EventGoingRepositoryImpl(db);
export const eventGoingController = new EventGoingController({
  mark: new MarkEventGoingUseCase(eventGoingRepo, activityEvents),
  unmark: new UnmarkEventGoingUseCase(eventGoingRepo, activityEvents),
  list: new ListEventGoingsUseCase(eventGoingRepo),
});
export const eventController = new EventController(
  new CreateEventUseCase(eventRepo, regionRepo, activityEvents),
  new UpdateEventUseCase(eventRepo, regionRepo, activityEvents),
  new DeleteEventUseCase(eventRepo),
  new ListEventsUseCase(eventRepo),
  new GetEventBySlugUseCase(eventRepo),
  new SetEventCancelledUseCase(eventRepo),
  new ListEventCategoriesUseCase(eventRepo),
  {
    listComments: new ListEventCommentsUseCase(eventRepo),
    createComment: new CreateEventCommentUseCase(
      eventRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
      stickerRepo,
    ),
    createCommentAudio: new CreateEventCommentAudioUseCase(
      eventRepo,
      pronunciationStorage,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
    ),
    updateComment: new UpdateEventCommentUseCase(
      eventRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
    ),
    deleteComment: new DeleteEventCommentUseCase(eventRepo),
    takedownComment: new TakedownEventCommentUseCase(eventRepo, auditRepo),
  },
  {
    listImages: new ListEventImagesUseCase(eventRepo),
    appendImages: new AppendEventImagesUseCase(eventRepo, userRepo, activityEvents),
    hideImage: new HideEventImageUseCase(eventRepo, activityEvents),
  },
  eventGoingRepo,
  listRelatedContent,
);
export const eventContributionController = new EventContributionController(
  new EventContributionUseCases(
    new EventContributionRepositoryImpl(db),
    eventRepo,
    regionRepo,
    new CreateEventUseCase(eventRepo, regionRepo, activityEvents),
    recordInbox,
    notifyUser,
    explorationGroupNotifier,
  ),
);

// ---- Fitur Usaha (PRD usaha) - direktori usaha & jasa lokal ----
export const usahaRepo = new UsahaRepositoryImpl(db);
export const usahaVisitRepo = new UsahaVisitRepositoryImpl(db);
export const usahaVisitController = new UsahaVisitController({
  mark: new MarkUsahaVisitUseCase(usahaVisitRepo, activityEvents),
  unmark: new UnmarkUsahaVisitUseCase(usahaVisitRepo, activityEvents),
  list: new ListUsahaVisitsUseCase(usahaVisitRepo),
});
export const usahaCategoryRepo = new UsahaCategoryRepositoryImpl(db);
export const usahaCategoryController = new UsahaCategoryController(
  new CreateUsahaCategoryUseCase(usahaCategoryRepo),
  new UpdateUsahaCategoryUseCase(usahaCategoryRepo),
  new DeleteUsahaCategoryUseCase(usahaCategoryRepo),
  new ListUsahaCategoryCatalogUseCase(usahaCategoryRepo),
  new GetUsahaCategoryUseCase(usahaCategoryRepo),
);
export const createUsahaUc = new CreateUsahaUseCase(usahaRepo, regionRepo);
export const usahaController = new UsahaController(
  createUsahaUc,
  new UpdateUsahaUseCase(usahaRepo, regionRepo),
  new DeleteUsahaUseCase(usahaRepo),
  new ListUsahasUseCase(usahaRepo),
  new GetUsahaBySlugUseCase(usahaRepo),
  new RestrictUsahaUseCase(usahaRepo),
  new RestoreUsahaUseCase(usahaRepo),
  new ListUsahaCategoriesUseCase(usahaRepo),
  new FindUsahaDuplicatesUseCase(usahaRepo),
  new ListUsahaImagesUseCase(usahaRepo),
  new AppendUsahaImagesUseCase(usahaRepo, userRepo, activityEvents),
  new HideUsahaImageUseCase(usahaRepo),
  listRelatedContent,
  usahaVisitRepo,
  {
    listComments: new ListUsahaCommentsUseCase(usahaRepo),
    createComment: new CreateUsahaCommentUseCase(
      usahaRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
      stickerRepo,
    ),
    createCommentAudio: new CreateUsahaCommentAudioUseCase(
      usahaRepo,
      pronunciationStorage,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
    ),
    updateComment: new UpdateUsahaCommentUseCase(
      usahaRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
    ),
    deleteComment: new DeleteUsahaCommentUseCase(usahaRepo),
    takedownComment: new TakedownUsahaCommentUseCase(usahaRepo, auditRepo),
  },
);
export const usahaViewsRepo = new UsahaViewsRepositoryImpl(db);
export const usahaViewsController = new UsahaViewsController(
  new RecordUsahaViewBySlugUseCase(usahaViewsRepo),
  new ListUsahaViewsUseCase(usahaViewsRepo),
  new GetUsahaViewReportUseCase(usahaViewsRepo),
);
export const usahaContributionRepo = new UsahaContributionRepositoryImpl(db);
export const usahaClaimRepo = new UsahaClaimRepositoryImpl(db);
export const usahaContributionUseCases = new UsahaContributionUseCases(
  usahaContributionRepo,
  usahaRepo,
  regionRepo,
  createUsahaUc,
  new UniqueUsahaSlugUseCase(usahaRepo),
  auditRepo,
  recordInbox,
  notifyUser,
  activityEventRepo,
  explorationGroupNotifier,
);
export const usahaContributionController = new UsahaContributionController(
  usahaContributionUseCases,
);
export const layananController = new LayananController(
  new LayananUseCases(
    new LayananRepositoryImpl(db),
    regionRepo,
    activityEvents,
    explorationGroupNotifier,
  ),
  listRelatedContent,
);
export const karyaLemmaLinkController = new KaryaLemmaLinkController({
  listByExcerpt: new ListKaryaExcerptLemmaLinksUseCase(karyaRepo),
  create: new CreateKaryaLemmaLinkUseCase(karyaRepo, wordRepo, auditRepo),
  proposeCorrection: new ProposeKaryaLemmaCorrectionUseCase(
    karyaRepo,
    wordRepo,
    auditRepo,
  ),
  resolveCorrection: new ResolveKaryaLemmaCorrectionUseCase(karyaRepo, auditRepo),
  deleteLink: new DeleteKaryaLemmaLinkUseCase(karyaRepo, auditRepo),
});
export const karyaController = new KaryaController(
  new KaryaUseCases(
    karyaRepo,
    activityEvents,
    new ResolveKaryaRelated(db),
    explorationGroupNotifier,
  ),
  listRelatedContent,
  replaceContentLinks,
);
export const kreatorController = new KreatorController(
  new KreatorUseCases(new KreatorRepositoryImpl(db), activityEvents),
);
/** Diisi `sendWa` setelah OpenWA di-wire (lihat bawah). */
export const balehoNotify: {
  mailer: typeof mailer;
  userRepo: typeof userRepo;
  recordInbox: typeof recordInbox;
  notifyUser: typeof notifyUser;
  sendWa?: import('@/modules/wa/application/use-cases/send-wa-message.use-case').SendWaMessageUseCase;
} = { mailer, userRepo, recordInbox, notifyUser };
export const balehoUseCases = new BalehoUseCases(
  new BalehoRepositoryImpl(db),
  balehoNotify,
  appSettingsRepo,
);
export const balehoController = new BalehoController(balehoUseCases, imageStorage);
export const usahaClaimUseCases = new UsahaClaimUseCases(
  usahaClaimRepo,
  usahaRepo,
  auditRepo,
  recordInbox,
  notifyUser,
  activityEventRepo,
);
export const usahaClaimController = new UsahaClaimController(usahaClaimUseCases);
export const usahaReportController = new UsahaReportController(
  new UsahaReportUseCases(new UsahaReportRepositoryImpl(db), usahaRepo, auditRepo),
);
export const listMyUsahaUc = new ListMyUsahaUseCase(
  usahaRepo,
  usahaContributionRepo,
  usahaClaimRepo,
);

// ---- Fitur Kuliner (PRD kuliner) - jelajah kuliner & tempat makan ----
export const culinaryRepo = new CulinaryRepositoryImpl(db);
export const culinaryCategoryRepo = new CulinaryCategoryRepositoryImpl(db);
export const culinaryCategoryController = new CulinaryCategoryController(
  new CreateCulinaryCategoryUseCase(culinaryCategoryRepo),
  new UpdateCulinaryCategoryUseCase(culinaryCategoryRepo),
  new DeleteCulinaryCategoryUseCase(culinaryCategoryRepo),
  new ListCulinaryCategoryCatalogUseCase(culinaryCategoryRepo),
  new GetCulinaryCategoryUseCase(culinaryCategoryRepo),
);
export const culinaryController = new CulinaryController(
  culinaryRepo,
  new ListCuisinesUseCase(culinaryRepo),
  new GetCuisineBySlugUseCase(culinaryRepo),
  new ListCulinaryCategoriesUseCase(culinaryRepo),
  new FindCulinaryDuplicatesUseCase(culinaryRepo),
  new RestrictCulinaryUseCase(culinaryRepo),
  new RestoreCulinaryUseCase(culinaryRepo),
  new DeleteCulinaryUseCase(culinaryRepo),
  new AppendCuisineImagesUseCase(culinaryRepo, userRepo, activityEvents),
  listRelatedContent,
  {
    listComments: new ListCuisineCommentsUseCase(culinaryRepo),
    createComment: new CreateCuisineCommentUseCase(
      culinaryRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
      stickerRepo,
    ),
    createCommentAudio: new CreateCuisineCommentAudioUseCase(
      culinaryRepo,
      pronunciationStorage,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
      activityEvents,
    ),
    updateComment: new UpdateCuisineCommentUseCase(
      culinaryRepo,
      auditRepo,
      commentBlocklistRepo,
      recordAbuseSignal,
    ),
    deleteComment: new DeleteCuisineCommentUseCase(culinaryRepo),
    takedownComment: new TakedownCuisineCommentUseCase(culinaryRepo, auditRepo),
  },
);
export const cuisineViewsRepo = new CuisineViewsRepositoryImpl(db);
export const cuisineViewsController = new CuisineViewsController(
  new RecordCuisineViewBySlugUseCase(cuisineViewsRepo),
  new ListCuisineViewsUseCase(cuisineViewsRepo),
  new GetCuisineViewReportUseCase(cuisineViewsRepo),
);
export const culinaryContributionRepo = new CulinaryContributionRepositoryImpl(db);
export const culinaryContributionUseCases = new CulinaryContributionUseCases(
  culinaryContributionRepo,
  culinaryRepo,
  usahaRepo,
  new UniqueCulinarySlugUseCase(culinaryRepo),
  auditRepo,
  recordInbox,
  notifyUser,
  activityEventRepo,
  explorationGroupNotifier,
);
export const culinaryContributionController = new CulinaryContributionController(
  culinaryContributionUseCases,
);

export const categoryRepo = new CategoryRepositoryImpl(db);
export const categoryController = new CategoryController({
  listCategories: new ListCategoriesUseCase(categoryRepo),
  createCategory: new CreateCategoryUseCase(categoryRepo, auditRepo),
  updateCategory: new UpdateCategoryUseCase(categoryRepo, auditRepo),
  deleteCategory: new DeleteCategoryUseCase(categoryRepo, auditRepo),
});

// ---- Modul word-group (PRD relasi-lemma): kelompok makna. ----
export const wordGroupRepo = new WordGroupRepositoryImpl(db);
export const wordGroupController = new WordGroupController({
  create: new CreateWordGroupUseCase(wordGroupRepo),
  update: new UpdateWordGroupUseCase(wordGroupRepo),
  remove: new DeleteWordGroupUseCase(wordGroupRepo, auditRepo),
  list: new ListWordGroupsUseCase(wordGroupRepo),
  getById: new GetWordGroupUseCase(wordGroupRepo),
  addMember: new AddWordGroupMemberUseCase(wordGroupRepo),
  removeMember: new RemoveWordGroupMemberUseCase(wordGroupRepo),
});

// ---- Modul vote (08-api-upvote-downvote.md) - upvote/downvote polymorphic
// pada word & children-nya. TANPA audit per vote (volume tinggi, bukan
// aksi admin - lihat KEPUTUSAN PRODUK di doc). ----
export const voteRepo = new VoteRepositoryImpl(db);
export const wordVotePushCooldown = new WordVotePushCooldownGate(
  appSettingsRepo,
  notificationPushCooldownRepo,
);
export const applyMeaningVoteTrust = new ApplyMeaningVoteTrustUseCase(
  wordRepo,
  appSettingsRepo,
  auditRepo,
  activityEvents,
  recordInbox,
  notifyUser,
);
export const toggleVoteUseCase = new ToggleVoteUseCase(
  voteRepo,
  userRepo,
  recordInbox,
  notifyUser,
  wordVotePushCooldown,
  activityEvents,
  applyMeaningVoteTrust,
);
export const voteController = new VoteController({
  toggle: toggleVoteUseCase,
  counts: new GetVoteCountsUseCase(voteRepo),
  myVotes: new GetMyVotesUseCase(voteRepo),
  history: new ListMyVoteHistoryUseCase(voteRepo),
  deck: new GetVoteDeckUseCase(voteRepo),
  checkDeck: new GetVoteCheckDeckUseCase(voteRepo),
  skipDeck: new SkipVoteDeckWordUseCase(voteRepo, userSkipRepo),
});

// Panel moderasi vote (hapus vote spam + reset massal anti-brigading) -
// role root/admin/reviewer, audit trail best-effort di use case.
export const adminVotesController = new AdminVotesController({
  list: new ListAdminVotesUseCase(voteRepo),
  deleteById: new DeleteAdminVoteUseCase(voteRepo, auditRepo),
  resetTarget: new ResetTargetVotesUseCase(voteRepo, auditRepo),
  resetByClient: new ResetVotesByClientUseCase(voteRepo, auditRepo),
  topTargets: new GetTopTargetVotesUseCase(voteRepo),
});

export const wordVotersController = new WordVotersController({
  list: new ListWordVotersUseCase(voteRepo),
});

// ---- Modul dashboard - statistik agregat halaman admin (kata, kontribusi,
// user, aktivitas). Repository membaca beberapa tabel sekaligus - dipisah
// dari modul lain supaya agregasi ringan tidak membebani repositori domain. ----
export const dashboardController = new DashboardController({
  getStats: new GetDashboardStatsUseCase(new DashboardRepositoryImpl(db)),
});

// ---- Modul web-analytics - Trafik Web console (GA4 + Search Console via
// service account). Provider terpisah dari dashboard internal. ----
export const webAnalyticsController = new WebAnalyticsController({
  getReport: new GetWebAnalyticsUseCase({
    ...createWebAnalyticsProviders(env),
    ga4CacheTtlSeconds: env.GA4_CACHE_TTL_SECONDS,
    searchConsoleCacheTtlSeconds: env.SEARCH_CONSOLE_CACHE_TTL_SECONDS,
  }),
});

// ---- Modul play-analytics - statistik Play Store console (export CSV GCS
// via service account yang sama dengan GA4). ----
export const playAnalyticsController = new PlayAnalyticsController({
  getReport: new GetPlayAnalyticsUseCase({
    ...createPlayAnalyticsProviders(env),
    cacheTtlSeconds: env.PLAY_CACHE_TTL_SECONDS,
  }),
});

// ---- Modul fcm-analytics - analitik notifikasi push (delivery dari FCM Data
// API via service account Firebase + open rate dari event notification_open
// di GA4 property mobile). ----
export const fcmAnalyticsController = new FcmAnalyticsController({
  getReport: new GetFcmAnalyticsUseCase({
    ...createFcmAnalyticsProviders(env),
    cacheTtlSeconds: env.FCM_CACHE_TTL_SECONDS,
  }),
});

// ---- Modul mobile-analytics - GA4 property mobile (event, layar, audiens)
// via service account GA4 yang sama dengan web-analytics. ----
export const mobileAnalyticsController = new MobileAnalyticsController({
  getReport: new GetMobileAnalyticsUseCase({
    mobile: createMobileAnalyticsProvider(env),
    // ponytail: reuse TTL FCM (1 jam); pisah env kalau butuh beda.
    cacheTtlSeconds: env.FCM_CACHE_TTL_SECONDS,
  }),
});

// Katalog stiker (chat + komentar) - repo di atas (CreateComment + komentar entitas).
export const stickerController = new StickerController({
  listActive: new ListActiveStickersUseCase(stickerRepo),
  getActive: new GetActiveStickerUseCase(stickerRepo),
  listAdmin: new ListAdminStickersUseCase(stickerRepo),
  create: new CreateStickerUseCase(stickerRepo, auditRepo),
  update: new UpdateStickerUseCase(stickerRepo, auditRepo),
  remove: new DeleteStickerUseCase(stickerRepo, auditRepo),
});

// ---- Modul comment (09-api-comment.md) - post-moderation + blocklist. ----
export const commentRepo = new CommentRepositoryImpl(db);
export const wordCommentPushCooldown = new WordCommentPushCooldownGate(
  appSettingsRepo,
  notificationPushCooldownRepo,
);
export const discussionReplyPushCooldown = new DiscussionReplyPushCooldownGate(
  appSettingsRepo,
  notificationPushCooldownRepo,
);
export const pantunReplyPushCooldown = new ReplyPushCooldownGate(
  appSettingsRepo,
  notificationPushCooldownRepo,
  'pantun_reply',
);
export const commentUploadCredentials = new CreateUploadCredentialsUseCase({
  imageStorage,
  defaultFolder: "/comments",
});
export const commentController = new CommentController({
  create: new CreateCommentUseCase(
    commentRepo,
    wordRepo,
    auditRepo,
    commentBlocklistRepo,
    userRepo,
    recordInbox,
    notifyUser,
    wordCommentPushCooldown,
    recordAbuseSignal,
    activityEvents,
    stickerRepo,
  ),
  createAudio: new CreateCommentAudioUseCase(
    commentRepo,
    wordRepo,
    pronunciationStorage,
    auditRepo,
    commentBlocklistRepo,
    userRepo,
    recordInbox,
    notifyUser,
    wordCommentPushCooldown,
    recordAbuseSignal,
  ),
  attachImage: new AttachCommentImageUseCase(
    commentRepo,
    auditRepo,
    userRepo,
    recordInbox,
    notifyUser,
  ),
  approveImage: new ApproveCommentImageUseCase(
    commentRepo,
    publicImageStorage,
    imageStorage,
    auditRepo,
    recordInbox,
  ),
  rejectImage: new RejectCommentImageUseCase(
    commentRepo,
    imageStorage,
    auditRepo,
    recordInbox,
    recordAbuseSignal,
  ),
  listByWord: new ListWordCommentsUseCase(commentRepo, voteRepo),
  delete: new DeleteCommentUseCase(commentRepo, auditRepo),
  update: new UpdateCommentUseCase(
    commentRepo,
    wordRepo,
    auditRepo,
    commentBlocklistRepo,
    recordAbuseSignal,
  ),
  editHistory: new GetCommentEditHistoryUseCase(commentRepo),
  listAdmin: new ListAdminCommentsUseCase(commentRepo),
  listMine: new ListMyCommentsUseCase(commentRepo),
  takedown: new TakedownCommentUseCase(
    commentRepo,
    auditRepo,
    recordAbuseSignal,
  ),
  uncensor: new UncensorCommentUseCase(commentRepo, auditRepo),
  createUploadCredentials: commentUploadCredentials,
});
export const commentBlocklistController = new CommentBlocklistController({
  create: new CreateBlocklistWordUseCase(commentBlocklistRepo, auditRepo),
  bulkCreate: new BulkCreateBlocklistWordsUseCase(
    commentBlocklistRepo,
    auditRepo,
  ),
  list: new ListBlocklistWordsUseCase(commentBlocklistRepo),
  delete: new DeleteBlocklistWordUseCase(commentBlocklistRepo, auditRepo),
});

// ---- Modul bookmark (16-api-bookmark.md) - kata tersimpan per user,
// toggle idempotent. TANPA audit (preseden vote: baris user-state). ----
export const bookmarkRepo = new BookmarkRepositoryImpl(db);
export const bookmarkController = new BookmarkController({
  toggle: new ToggleBookmarkUseCase(bookmarkRepo),
  my: new GetMyBookmarksUseCase(bookmarkRepo),
});

export const publicUserRepo = new PublicUserRepositoryImpl(db);
export const userController = new UserController({
  getPublicProfile: new GetPublicProfileUseCase(publicUserRepo),
  getPublicActivity: new GetPublicActivityUseCase(
    publicUserRepo,
    activityEventFeedRepo,
  ),
  suggestMention: new SuggestMentionUsersUseCase(publicUserRepo),
  uploadAvatar: new UploadAvatarUseCase(userRepo, publicImageStorage),
  deleteAvatar: new DeleteAvatarUseCase(userRepo, publicImageStorage),
  getMyProfile: new GetMyProfileUseCase(
    userRepo,
    appSettingsRepo,
    userConsentRepo,
    publicUserRepo,
    recordInbox,
    notifyUser,
  ),
  updateMyProfile: new UpdateMyProfileUseCase(
    userRepo,
    regionRepo,
    publicUserRepo,
    new UsernameChangeRepositoryImpl(db),
  ),
});

// ---- Modul achievement: katalog reward (border/badge/stiker) + evaluasi
// cron + border profil. Registry source di domain/achievement-registry. ----
export const achievementRepo = new AchievementRepositoryImpl(db);
export const scanAchievement = new ScanAchievementUseCase(
  achievementRepo,
  recordInbox,
  auditRepo,
);
export const achievementController = new AchievementController({
  create: new CreateAchievementUseCase(achievementRepo, auditRepo),
  update: new UpdateAchievementUseCase(achievementRepo, auditRepo),
  remove: new DeleteAchievementUseCase(achievementRepo, auditRepo),
  grant: new GrantAchievementUseCase(achievementRepo, recordInbox, auditRepo),
  revoke: new RevokeUserAchievementUseCase(achievementRepo, auditRepo),
  preview: new PreviewAchievementUseCase(achievementRepo),
  scan: scanAchievement,
  setBorder: new SetActiveBorderUseCase(achievementRepo, auditRepo),
  listActive: new ListActiveAchievementsUseCase(achievementRepo),
  listMine: new ListMyAchievementsUseCase(achievementRepo),
  listByUsername: new ListUserAchievementsUseCase(
    achievementRepo,
    async (username) => {
      const row = await publicUserRepo.findPublicByUsername(username);
      return row?.id ?? null;
    },
  ),
  repo: achievementRepo,
});
export const runDueAchievementScanUseCase = new RunDueAchievementScanUseCase(
  achievementRepo,
  scanAchievement,
  appSettingsRepo,
  auditRepo,
);

export const leaderboardRepo = new LeaderboardRepositoryImpl(db);
export const leaderboardStorage = createLeaderboardStorage();
export const userXpSnapshotAdapter = new UserXpSnapshotAdapter(publicUserRepo);
export const computeLiveLeaderboardUseCase = new ComputeLiveLeaderboardUseCase(
  leaderboardRepo,
  leaderboardStorage,
);
export const finalizeLeaderboardWeekUseCase = new FinalizeLeaderboardWeekUseCase(
  leaderboardRepo,
  leaderboardStorage,
  computeLiveLeaderboardUseCase,
  auditRepo,
  async () => {
    // Award lencana leaderboard_top dari snapshot yang baru dibekukan.
    await runDueAchievementScanUseCase.execute(new Date(), { force: true });
  },
  userXpSnapshotAdapter,
);
export const runDueLeaderboardJobsUseCase = new RunDueLeaderboardJobsUseCase(
  leaderboardRepo,
  finalizeLeaderboardWeekUseCase,
  computeLiveLeaderboardUseCase,
);
export const getLeaderboardUseCase = new GetLeaderboardUseCase(
  leaderboardRepo,
  leaderboardStorage,
  computeLiveLeaderboardUseCase,
);
export const manageLeaderboardExclusionsUseCase = new ManageLeaderboardExclusionsUseCase(
  leaderboardRepo,
  computeLiveLeaderboardUseCase,
  auditRepo,
);

export const getPointsHistoryUseCase = new GetPointsHistoryUseCase(
  leaderboardRepo,
  publicUserRepo,
);
export const leaderboardController = new LeaderboardController({
  getLeaderboard: getLeaderboardUseCase,
  computeLive: computeLiveLeaderboardUseCase,
  finalizeWeek: finalizeLeaderboardWeekUseCase,
  manageExclusions: manageLeaderboardExclusionsUseCase,
  getPointsHistory: getPointsHistoryUseCase,
});

export const runStreakReminderUseCase = new RunStreakReminderUseCase(
  db,
  appSettingsRepo,
  recordInbox,
  notifyUser,
);

// ---- Modul device (FCM token register/revoke, multi-device) ----
export const deviceController = new DeviceController({
  register: new RegisterDeviceTokenUseCase(deviceTokenRepo),
  revoke: new RevokeDeviceTokenUseCase(deviceTokenRepo),
});

// ---- Modul word-suggestions (usul perubahan kata) ----
export const suggestionRepo = new WordSuggestionRepositoryImpl(
  publicImageStorage,
  imageStorage,
);
export const suggestionController = new WordSuggestionController({
  repository: suggestionRepo,
  inbox: recordInbox,
  blocklist: commentBlocklistRepo,
});
export const myContributionController = new MyContributionController({
  listMine: new ListMyContributionsUseCase(contributionRepo, suggestionRepo),
  getMine: new GetMyContributionDetailUseCase(contributionRepo, suggestionRepo),
});

export const confirmDuplicateMeaning = new ConfirmDuplicateMeaningUseCase(
  wordRepo,
  toggleVoteUseCase,
  auditRepo,
);

