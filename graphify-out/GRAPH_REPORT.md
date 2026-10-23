# Graph Report - api  (2026-10-22)

## Corpus Check
- 1148 files · ~586,029 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .mdc 4, (none) 3, .example 2)

## Summary
- 7232 nodes · 23884 edges · 215 communities (191 shown, 24 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 1020 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `805b54db`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vitest
- app-error.ts
- word.repository.impl.ts
- UserRepository
- app.ts
- NotFoundError
- createOpenApiApp
- register-user.use-case.ts
- test-utils.ts
- verifier-application.controller.ts
- drizzle-orm
- comment.controller.ts
- create-word.use-case.ts
- login-with-facebook.use-case.ts
- fcm-analytics.provider.ts
- wa-message.repository.impl.ts
- mobile-analytics.entity.ts
- region.repository.impl.ts
- ResolvedRange
- client.ts
- UnauthorizedError
- WordRepository
- isUniqueViolation
- CursorPage
- bug-report.repository.impl.ts
- app-setting.entity.ts
- user.controller.ts
- AppVariables
- get-web-analytics.use-case.ts
- notification-campaign.repository.impl.ts
- play-stats.provider.ts
- list-share-backgrounds.use-case.ts
- WordRepositoryImpl
- announcement.controller.ts
- place-category.repository.impl.ts
- dashboard.repository.impl.ts
- campaign.validator.ts
- word-group.controller.ts
- contribution.validator.ts
- activity-event-feed.repository.impl.ts
- User
- lemma-definition.mapper.ts
- notification.repository.impl.ts
- NotificationCampaignRepository
- suggestion.validator.ts
- legal-document.repository.impl.ts
- add-word-image.use-case.ts
- WordImportSession
- ugc-abuse-event.repository.ts
- quota-aware-mailer.ts
- email.repository.impl.ts
- types.ts
- admin-verifier-application.routes.ts
- WordSuggestionRepositoryImpl
- ga4.provider.ts
- word-suggestion.entity.ts
- import-words.use-case.ts
- get-play-analytics.use-case.ts
- place.repository.impl.ts
- zod
- dns-email-domain-verifier.ts
- service-account-token.ts
- WordController
- discussion.validator.ts
- create-word.validator.ts
- ActivityItem
- UgcAbuseEventRepositoryImpl
- SearchMissRepository
- bookmark.repository.ts
- admin-vote.controller.ts
- UgcAnonAbuseRepository
- RefreshTokenRepository
- logger.ts
- CategoryRepository
- contribution.entity.ts
- vote.repository.ts
- create-admin-user.use-case.ts
- ilikeCompat
- place.controller.ts
- list-my-vote-history.use-case.ts
- ActivityEventFeedRepositoryImpl
- trigger-sqlite-backup.use-case.ts
- web-import.repository.impl.ts
- admin-api-client.use-cases.ts
- DiscussionController
- AppSettingsRepository
- PlaceRepository
- logger
- system-supabase.controller.ts
- mobile-analytics-provider.ts
- comment.routes.ts
- bulk-words-action.use-case.ts
- AchievementRepository
- legal.routes.ts
- place-contribution.controller.ts
- word.entity.ts
- comment-blocklist.validator.ts
- activity-event.entity.ts
- LanguageRepository
- notification.routes.ts
- PublicImageStoragePort
- user.routes.ts
- VoteRepositoryImpl
- word-import-session.use-cases.ts
- ServiceUnavailableError
- NotificationRepository
- admin-api-client.routes.ts
- PushSenderPort
- campaign.use-cases.ts
- merge-activity.ts
- legal.controller.ts
- notification-campaign.controller.ts
- scripts
- PlaceRepositoryImpl
- bookmark.routes.ts
- BadRequestError
- .findById
- wa-admin.routes.ts
- package.json
- createMailer
- propose-category-suggestion.use-case.ts
- CategorySuggestionRepository
- DeviceTokenRepository
- admin-vote.routes.ts
- vote.routes.ts
- compilerOptions
- activity.routes.ts
- ContributionController
- search-miss.routes.ts
- AchievementRepositoryImpl
- approve-verifier-application.use-case.ts
- jwt-token.service.ts
- category-suggestion.controller.ts
- verifier-application.repository.impl.ts
- achievement.controller.ts
- word-report.validator.ts
- update-word.validator.ts
- CommentBlocklistRepositoryImpl
- device.routes.ts
- openapi-app.ts
- SambasKu-API
- AchievementCriteria
- review-push-cooldown-gate.ts
- search-miss.controller.ts
- VerifierApplication
- fts-word-search-index.ts
- CommentController
- announcement.routes.ts
- UserSkipRepository
- toOwnerItem
- QuotaAwareMailer
- LegalDocument
- UserController
- CommentRepositoryImpl
- SearchMissRepositoryImpl
- VerifierApplicationController
- .toDetailData
- WordReportController
- list-audit-logs.use-case.ts
- audit.routes.ts
- Achievement
- RecordInboxNotificationUseCase
- ForbiddenError
- get-vote-counts.use-case.test.ts
- create-word.validator.test.ts
- Gambar publik (GitHub asset repo)
- bulk-dismiss-search-miss.use-case.ts
- PublicUserRepositoryImpl
- get-legal.use-cases.ts
- list-admin-votes.use-case.ts
- AuditLogRepository
- import-session.validator.ts
- scan-achievement.use-case.ts
- CategorySuggestionRepositoryImpl
- scan-achievement.test.ts
- bulk-words.validator.ts
- github-token-verifier.ts
- CategoryRepositoryImpl
- hono
- refresh-token.repository.impl.ts
- dismiss-search-miss.use-case.ts
- achievement-registry.ts
- worker.ts
- createDiscussionRoutes
- word-comment-push-cooldown-gate.ts
- map-word-image-url.ts
- UgcAnonAbuseRepositoryImpl
- EmailVerificationOtpRepositoryImpl
- query-boolean.ts
- deno.json
- ERROR_CODES.md
- ports/README.md
- pronunciation-audio-path.ts
- comment.repository.impl.test.ts
- approve-verifier-application.use-case.test.ts
- .listAdmin
- AccountDeletionTokenRepositoryImpl
- update-search-miss.use-case.ts
- batch-contribute-words.use-case.ts
- category-suggestion.dtos.ts
- Place
- verifier-application.use-case.test.ts
- import-words.validator.ts
- error-handler.middleware.ts
- GetAppSettingsUseCase
- meaning-source.validator.test.ts
- publish-or-merge-meanings.test.ts
- ListLatestWordsQueryBody
- record-supabase-health.ts

## God Nodes (most connected - your core abstractions)
1. `NotFoundError` - 256 edges
2. `AuditLogRepository` - 224 edges
3. `vitest` - 212 edges
4. `AppVariables` - 204 edges
5. `drizzle-orm` - 191 edges
6. `generateId()` - 159 edges
7. `WordRepository` - 155 edges
8. `ConflictError` - 142 edges
9. `createOpenApiApp()` - 142 edges
10. `UnauthorizedError` - 139 edges

## Surprising Connections (you probably didn't know these)
- `Architecture / pendekatan` --references--> `SmtpMailerService`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/smtp-mailer.service.ts
- `1. Verifikasi file sudah benar (RED evidence dulu)` --references--> `createMailer()`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/mailer.factory.ts
- `Tests / validation` --references--> `createMailer()`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/mailer.factory.ts
- `Current context / asumsi` --references--> `SmtpMailerService`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/smtp-mailer.service.ts
- `Current context / asumsi` --references--> `createMailer()`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/mailer.factory.ts

## Import Cycles
- None detected.

## Communities (215 total, 24 thin omitted)

### Community 0 - "vitest"
Cohesion: 0.02
Nodes (137): dotenv, @libsql/client, vitest, { parsed }, { parsed }, { parsed }, { parsed }, { parsed } (+129 more)

### Community 1 - "app-error.ts"
Cohesion: 0.03
Nodes (67): NewAuditLog, ApproveDiscussionCommand, ApproveDiscussionUseCase, fetchImageBytes(), normalizeApproveImageContentWarnings(), AttachDiscussionAudioCommand, AttachDiscussionAudioUseCase, CreateDiscussionReplyAudioUseCase (+59 more)

### Community 2 - "word.repository.impl.ts"
Cohesion: 0.03
Nodes (105): CONTRIB_BODY, isFulfilledLemmaSql, matchesExcludedLemmaSql, WORD_BOUND_VOTE_TYPES, contributionColumns, Tx, KONTRIBUTOR, NOMINA (+97 more)

### Community 3 - "UserRepository"
Cohesion: 0.06
Nodes (41): SetPasswordDto, SetPasswordProvider, FacebookTokenVerifierPort, GithubTokenVerifierPort, GoogleTokenVerifierPort, LinkGithubAccountUseCase, UnlinkGithubAccountUseCase, AuthProvidersView (+33 more)

### Community 4 - "app.ts"
Cohesion: 0.01
Nodes (162): abuseController, accountDeletion, achievementRepo, activityController, activityEventFeedRepo, activityEventRepo, activityEvents, activityRepo (+154 more)

### Community 5 - "NotFoundError"
Cohesion: 0.06
Nodes (44): onUgcRateLimited(), CreateCommentAudioCommand, CreateCommentAudioUseCase, truncateSnippet(), wordCommentBody(), CreateCommentCommand, CreateCommentUseCase, truncateSnippet() (+36 more)

### Community 6 - "createOpenApiApp"
Cohesion: 0.05
Nodes (94): createAdminAchievementRoutes(), createMyAchievementRoutes(), createMyProfileBorderRoutes(), createPublicAchievementRoutes(), json(), createAdminUserRoutes(), createContributionAccessRoutes(), json() (+86 more)

### Community 7 - "register-user.use-case.ts"
Cohesion: 0.04
Nodes (45): RegisterDto, ForgotPasswordDto, ResetPasswordDto, MailerPort, PasswordHasherPort, AccountDeletionUseCase, ForgotPasswordUseCase, OAUTH_PROVIDER_LABEL (+37 more)

### Community 8 - "test-utils.ts"
Cohesion: 0.04
Nodes (39): AuditLogRepositoryImpl, { parsed }, USER_A, USER_B, WORD_1, BM_BARU, BM_DEP, BM_LAMA (+31 more)

### Community 9 - "verifier-application.controller.ts"
Cohesion: 0.14
Nodes (6): CreateVerifierApplicationUseCase, GetMyVerifierApplicationUseCase, GetVerifierApplicationDetailUseCase, ListVerifierApplicationsUseCase, ResubmitVerifierApplicationUseCase, VerifierApplicationRepository

### Community 10 - "drizzle-orm"
Cohesion: 0.08
Nodes (37): drizzle-orm, ContributionStatus, ACHIEVEMENT_GRANTED_VIA, achievementCriteriaSql, achievements, userAchievements, announcements, apiClients (+29 more)

### Community 11 - "comment.controller.ts"
Cohesion: 0.10
Nodes (20): DeleteCommentCommand, DeleteCommentUseCase, ListAdminCommentsUseCase, ListMyCommentsUseCase, CommentWithVotes, ListWordCommentsResult, ListWordCommentsUseCase, TakedownCommentCommand (+12 more)

### Community 12 - "create-word.use-case.ts"
Cohesion: 0.05
Nodes (49): CreateWordDto, UpdateWordDto, UpdateWordRelatedDto, AddMeaningDto, AddPronunciationDto, Actor, collectInlineLanguageIds(), collectInlineRefPaths() (+41 more)

### Community 13 - "login-with-facebook.use-case.ts"
Cohesion: 0.13
Nodes (19): LoginDto, LoginMeta, TokenServicePort, LoginUserUseCase, invalidFacebookToken(), LoginWithFacebookUseCase, invalidGithubToken(), LoginWithGithubUseCase (+11 more)

### Community 14 - "fcm-analytics.provider.ts"
Cohesion: 0.05
Nodes (53): AnalyticsProviderError, AnalyticsProviderErrorKind, FcmAnalyticsProvider, CacheEntry, ERROR_SUFFIX, errorMessage(), FCM_DATA_LAG_DAYS, GetFcmAnalyticsInput (+45 more)

### Community 15 - "wa-message.repository.impl.ts"
Cohesion: 0.06
Nodes (35): WaSendCommand, WaSenderPort, isValidWaPhone(), renderWaBody(), SendWaMessageUseCase, toPositionalParams(), WaSenderPortWithConfigured, WaSendGatewayEntry (+27 more)

### Community 16 - "mobile-analytics.entity.ts"
Cohesion: 0.05
Nodes (54): MobileAnalyticsProvider, MobileAnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), GetMobileAnalyticsUseCase, isEmpty(), AppVersionRow (+46 more)

### Community 17 - "region.repository.impl.ts"
Cohesion: 0.06
Nodes (34): assertSlug(), CreateRegionUseCase, DeleteRegionUseCase, GetRegionByIdUseCase, ListRegionsUseCase, UpdateRegionUseCase, Region, RegionStatus (+26 more)

### Community 18 - "ResolvedRange"
Cohesion: 0.07
Nodes (44): SearchAnalyticsProvider, VisitorAnalyticsProvider, EventRow, Ga4Behavior, Ga4Overview, Ga4Sources, Ga4Totals, Ga4TrendPoint (+36 more)

### Community 19 - "client.ts"
Cohesion: 0.05
Nodes (44): AchievementRow, newAchievementId, derive(), encoder, fromB64(), Pbkdf2PasswordService, randomBytes(), timingSafeEqual() (+36 more)

### Community 20 - "UnauthorizedError"
Cohesion: 0.03
Nodes (66): GithubOauthCodeExchangerPort, GithubOauthCodeExchanger, messageForGithubOauthError(), AuthController, getAllCookieValues(), browserSignalHeaders(), isBrowserClient(), clearRefreshCookieVariants() (+58 more)

### Community 21 - "WordRepository"
Cohesion: 0.02
Nodes (85): RelationType, AddMeaningUseCase, AddPronunciationUseCase, ApplyCommaSplitCommand, ApplyCommaSplitUseCase, DeletePronunciationAudioUseCase, GetWordByIdUseCase, GetWordByLemmaUseCase (+77 more)

### Community 22 - "isUniqueViolation"
Cohesion: 0.14
Nodes (13): WordToSave, childStatusOf(), contributionStatusOf(), mapMediaViolation(), toExample(), toPronunciation(), toWord(), verificationCols() (+5 more)

### Community 23 - "CursorPage"
Cohesion: 0.04
Nodes (40): CorrectContributionCommand, CorrectContributionInput, CorrectContributionUseCase, ContributionDetail, GetContributionDetailUseCase, ListContributionsUseCase, ReopenContributionCommand, ReopenContributionOutcome (+32 more)

### Community 24 - "bug-report.repository.impl.ts"
Cohesion: 0.11
Nodes (24): CreateBugReportCommand, CreateBugReportUseCase, ListBugReportsUseCase, ResolveBugReportCommand, ResolveBugReportUseCase, BugReport, BugReportImage, BugReportListFilter (+16 more)

### Community 25 - "app-setting.entity.ts"
Cohesion: 0.10
Nodes (17): ALLOWED, UpdateAppSettingsUseCase, APP_SETTING_KEYS, AppSetting, AppSettingKey, AppSettingType, DEFAULT_OAUTH_CONSENT_ENFORCEMENT, DEFAULT_WORD_VOTE_PUSH_COOLDOWN_MINUTES (+9 more)

### Community 26 - "user.controller.ts"
Cohesion: 0.10
Nodes (17): GetPublicActivityUseCase, PublicActivityPageResult, GetPublicProfileUseCase, PublicActivityQueryInput, MENTION_SUGGEST_LIMIT, SuggestMentionUsersUseCase, UpdateMyProfileUseCase, MentionUserRow (+9 more)

### Community 27 - "AppVariables"
Cohesion: 0.05
Nodes (47): AchievementController, serializeAchievement(), AchievementRoutesDeps, idParam, achievementAdminListResponseSchema, achievementBorderResponseSchema, achievementCodeSchema, achievementCriteriaSchema (+39 more)

### Community 28 - "get-web-analytics.use-case.ts"
Cohesion: 0.14
Nodes (23): AnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), GetWebAnalyticsInput, isGa4Empty(), isSearchEmpty(), PROVIDER_COPY (+15 more)

### Community 29 - "notification-campaign.repository.impl.ts"
Cohesion: 0.08
Nodes (19): CampaignAudienceType, CampaignBodyType, CampaignRecipient, CampaignRecipientStatus, CampaignStatus, DeepLinkKind, NotificationTemplate, CampaignListOptions (+11 more)

### Community 30 - "play-stats.provider.ts"
Cohesion: 0.09
Nodes (36): AnalyticsProviderError, PlayStatsProvider, PlayGrowth, PlayOverview, PlayRatings, findCol(), isOverviewCsv(), isRelevantPlayCsv() (+28 more)

### Community 31 - "list-share-backgrounds.use-case.ts"
Cohesion: 0.06
Nodes (55): SHARE_BACKGROUND_PROVIDER_IDS, SHARE_MEDIA_KINDS, SHARE_ORIENTATIONS, SHARE_PROVIDER_MEDIA, ShareBackgroundItem, ShareBackgroundProviderId, ShareBackgroundProviderInfo, ShareBackgroundProviderPort (+47 more)

### Community 32 - "WordRepositoryImpl"
Cohesion: 0.06
Nodes (6): encodeLatestCursor(), ListLatestParams, feedSafeUsageLabelsSql(), toWordAudio(), toWordImage(), WordRepositoryImpl

### Community 33 - "announcement.controller.ts"
Cohesion: 0.08
Nodes (22): announcementController, CreateAnnouncementCommand, CreateAnnouncementUseCase, DeleteAnnouncementUseCase, ListPinnedAnnouncementsUseCase, UpdateAnnouncementCommand, UpdateAnnouncementUseCase, ListAnnouncementsUseCase (+14 more)

### Community 34 - "place-category.repository.impl.ts"
Cohesion: 0.08
Nodes (25): CreatePlaceCategoryUseCase, DeletePlaceCategoryUseCase, GetPlaceCategoryUseCase, ListPlaceCategoriesUseCase, UpdatePlaceCategoryUseCase, PlaceCategoryRecord, PlaceCategoryStatus, CreatePlaceCategoryInput (+17 more)

### Community 35 - "dashboard.repository.impl.ts"
Cohesion: 0.09
Nodes (34): LAST_SEEN_TOUCH_THROTTLE_MS, ONLINE_RECENTLY_WINDOW_MS, onlineRecentlySince(), GetDashboardStatsUseCase, ActivityDailyPoint, AppRoleKey, ContributionStatusKey, DashboardStats (+26 more)

### Community 36 - "campaign.validator.ts"
Cohesion: 0.08
Nodes (25): ALLOWED_DEEP_LINK_HOSTS, audienceTypeSchema, bodySchema, campaignBodyTypeSchema, campaignDetailResponseSchema, campaignIdParamsSchema, campaignItemSchema, campaignResponseSchema (+17 more)

### Community 37 - "word-group.controller.ts"
Cohesion: 0.09
Nodes (18): AddWordGroupMemberUseCase, assertName(), CreateWordGroupUseCase, DeleteWordGroupUseCase, GetWordGroupUseCase, ListWordGroupsUseCase, RemoveWordGroupMemberUseCase, UpdateWordGroupUseCase (+10 more)

### Community 38 - "contribution.validator.ts"
Cohesion: 0.05
Nodes (61): authErrors, createAbuseRoutes(), json(), anonAbuseEventListResponseSchema, anonMuteListResponseSchema, liftAnonMuteBodySchema, liftAnonMuteResponseSchema, liftUserMuteResponseSchema (+53 more)

### Community 39 - "activity-event-feed.repository.impl.ts"
Cohesion: 0.07
Nodes (27): FeedRow, KIND_BODY, KIND_TO_WIRE, MERGED_PROFILE_KINDS, PROFILE_KIND_SETS, ProfileCategory, PUBLIC_STATUSES, asImages() (+19 more)

### Community 40 - "User"
Cohesion: 0.12
Nodes (7): ListAdminUsersCommand, ListAdminUsersResult, User, insertRoles(), loadRolesByUserIds(), toEntity(), UserRepositoryImpl

### Community 41 - "lemma-definition.mapper.ts"
Cohesion: 0.07
Nodes (34): LemmaDefinitionEntryDto, LemmaDefinitionLookupResultDto, LemmaDefinitionSenseDto, LemmaDefinitionSuggestionDto, KBBI_PROVIDER_IDS, KbbiProviderId, buildNotes(), expandExamplePlaceholders() (+26 more)

### Community 42 - "notification.repository.impl.ts"
Cohesion: 0.18
Nodes (12): RecordInboxNotificationCommand, InboxNotification, InboxNotificationType, NotificationActionKind, NotificationTargetKind, CreateInboxNotificationInput, NotificationListOptions, NotificationListResult (+4 more)

### Community 43 - "NotificationCampaignRepository"
Cohesion: 0.07
Nodes (12): assertDeepLink(), CreateCampaignDraftUseCase, EstimateCampaignAudienceUseCase, GetCampaignDetailUseCase, ListCampaignsUseCase, assertDeepLink(), CreateNotificationTemplateUseCase, DeleteNotificationTemplateUseCase (+4 more)

### Community 44 - "suggestion.validator.ts"
Cohesion: 0.06
Nodes (38): ALLOWED, checkSuggestionCategoryShape(), isRevertibleForApplyPending(), Part, presentParts(), composeReasonDisplay(), isSuggestionCategory(), SUGGESTION_REASON_CODES (+30 more)

### Community 45 - "legal-document.repository.impl.ts"
Cohesion: 0.12
Nodes (11): ArchiveLegalDocumentUseCase, CreateLegalDocumentDraftUseCase, ListAdminLegalDocumentsUseCase, PublishLegalDocumentUseCase, UpdateLegalDocumentDraftUseCase, LegalDocumentStatus, NewLegalDocumentDraft, UpdateLegalDocumentDraft (+3 more)

### Community 46 - "add-word-image.use-case.ts"
Cohesion: 0.06
Nodes (44): CreateWordExampleDto, CreateWordImageDto, CreateWordMeaningDto, CreateWordRelatedDto, CreateWordTranslationDto, CreateWordVariantDto, InlineWordDto, MeaningOverrideDto (+36 more)

### Community 47 - "WordImportSession"
Cohesion: 0.15
Nodes (8): ClaimWordImportSessionInput, NewWordImportSession, WordImportSession, WordImportSessionRepository, lemmaInList(), sanitizeLike(), uniqueLowerLemmas(), WordImportSessionRepositoryImpl

### Community 48 - "ugc-abuse-event.repository.ts"
Cohesion: 0.09
Nodes (13): LiftAbuseMuteUseCase, AbuseController, AdminCtx, LiftAnonMuteBody, ListAnonAbuseEventsQuery, ListUserAbuseEventsQuery, ListUserAbuseEventsUseCase, RecordUgcAbuseEventInput (+5 more)

### Community 49 - "quota-aware-mailer.ts"
Cohesion: 0.13
Nodes (27): accountDeletionEmailHtml(), accountDeletionEmailText(), brandedCodeEmailHtml(), brandedMessageEmailHtml(), documentShell(), emailActionHref(), escapeEmailHtml(), eyebrowRow() (+19 more)

### Community 50 - "email.repository.impl.ts"
Cohesion: 0.09
Nodes (21): EMAIL_PROVIDERS, EmailCategory, EmailLog, EmailLogStatus, EmailProvider, EmailQuotaWithUsage, EmailLogEntry, EmailLogListQuery (+13 more)

### Community 51 - "types.ts"
Cohesion: 0.06
Nodes (45): AdminBugReportRoutesDeps, createAdminBugReportRoutes(), json(), BugReportController, toAdminItem(), BugReportRoutesDeps, createBugReportRoutes(), json() (+37 more)

### Community 52 - "admin-verifier-application.routes.ts"
Cohesion: 0.10
Nodes (25): AdminVerifierApplicationRoutesDeps, createAdminVerifierApplicationRoutes(), json(), adminListVerifierApplicationsResponseSchema, adminVerifierApplicationDetailResponseSchema, approveVerifierApplicationResponseSchema, listVerifierApplicationsQuerySchema, myVerifierApplicationResponseSchema (+17 more)

### Community 53 - "WordSuggestionRepositoryImpl"
Cohesion: 0.08
Nodes (22): deleteStagingWordImage(), CensoredSuggestion, ShapeIssue, CensoredSuggestionFile, deleteProposedStagingImages(), prepareProposedImagesForApprove(), SuggestionImageDecision, ValidationError (+14 more)

### Community 54 - "ga4.provider.ts"
Cohesion: 0.11
Nodes (31): BreakdownRow, ChannelRow, PageRow, TrafficChannel, byMetricDesc(), CHANNEL_ORDER, channelBucket(), dr() (+23 more)

### Community 55 - "word-suggestion.entity.ts"
Cohesion: 0.07
Nodes (28): CATEGORY_SET, ChangeAction, CurrentMeaningSnapshot, CurrentWordSnapshot, DiffField, DiffMeaning, DiffResult, GroupAction (+20 more)

### Community 56 - "import-words.use-case.ts"
Cohesion: 0.19
Nodes (14): canVerifyImport(), decideImportPublication(), ImportMeaningInput, ImportOutcome, ImportWordInput, ImportWordResult, meaningFingerprint(), normalizeLemma() (+6 more)

### Community 57 - "get-play-analytics.use-case.ts"
Cohesion: 0.08
Nodes (27): AnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), GetPlayAnalyticsUseCase, isEmpty(), PLAY_STATS_LAG_DAYS, PLAY_ANALYTICS_SECTIONS (+19 more)

### Community 58 - "place.repository.impl.ts"
Cohesion: 0.27
Nodes (17): PlaceCategory, PlaceImage, PlaceImageAttribution, PlaceRelatedCard, PlaceRelation, PlaceRelationKind, PlaceSource, PlaceStatus (+9 more)

### Community 59 - "zod"
Cohesion: 0.07
Nodes (35): zod, AdminUserRoutesDeps, adminUserMutationResponseSchema, adminUsersListResponseSchema, adminUserWireSchema, ALL_ROLES, ASSIGNABLE_ADMIN_ROLES, listAdminUsersQuerySchema (+27 more)

### Community 60 - "dns-email-domain-verifier.ts"
Cohesion: 0.19
Nodes (9): EmailDomainVerifierPort, DnsEmailDomainVerifier, DohResponse, DohStatus, DohType, RR, unreachable(), AllowAllEmailDomainVerifier (+1 more)

### Community 61 - "service-account-token.ts"
Cohesion: 0.15
Nodes (18): MobileAnalyticsProviderError, kindForStatus(), postGoogleJson(), toError(), MobileAnalyticsConfig, AnalyticsProviderError, Ga4Config, kindForStatus() (+10 more)

### Community 62 - "WordController"
Cohesion: 0.08
Nodes (10): ApplyCommaSplitBody, MarkCommaLiteralBody, MergeDuplicateWordsBody, AddExampleBody, AddMeaningBody, AddPronunciationBody, AddWordImageBody, strField() (+2 more)

### Community 63 - "discussion.validator.ts"
Cohesion: 0.08
Nodes (32): tokenIpLimit, tokenUserLimit, adminImageWireSchema, attachDiscussionAudioResponseSchema, createDiscussionBodySchema, createDiscussionReplyBodySchema, createDiscussionReplyResponseSchema, createDiscussionResponseSchema (+24 more)

### Community 64 - "create-word.validator.ts"
Cohesion: 0.09
Nodes (33): adminListWordsQuerySchema, applyCommaSplitBodySchema, applyCommaSplitResponseSchema, applyLemmaSplitBodySchema, commaSplitCandidatesResponseSchema, createWordResponseSchema, duplicateWordGroupsResponseSchema, duplicateWordItemSchema (+25 more)

### Community 65 - "ActivityItem"
Cohesion: 0.15
Nodes (16): ActivityItem, ActivityCursor, ActivityRepository, ActivityRepositoryImpl, feedSafeUsageLabelsSql(), feedVisibleWordSql(), keysetBefore(), notMyWordVoteSql() (+8 more)

### Community 66 - "UgcAbuseEventRepositoryImpl"
Cohesion: 0.27
Nodes (3): parseMeta(), toEntity(), UgcAbuseEventRepositoryImpl

### Community 67 - "SearchMissRepository"
Cohesion: 0.18
Nodes (10): ListSearchMissesUseCase, ResolveSearchMissResult, SkipSearchMissCommand, SkipSearchMissUseCase, SearchMiss, SearchMissDirection, SearchMissListFilter, SearchMissRepository (+2 more)

### Community 68 - "bookmark.repository.ts"
Cohesion: 0.13
Nodes (13): GetMyBookmarksUseCase, ToggleBookmarkCommand, ToggleBookmarkUseCase, BookmarkItem, BookmarkListOptions, BookmarkListResult, BookmarkRepository, BookmarkWordSummary (+5 more)

### Community 69 - "admin-vote.controller.ts"
Cohesion: 0.14
Nodes (11): DeleteAdminVoteCommand, DeleteAdminVoteResult, DeleteAdminVoteUseCase, GetTopTargetVotesCommand, GetTopTargetVotesUseCase, ResetTargetVotesResult, ResetTargetVotesUseCase, ToggleVoteCommand (+3 more)

### Community 70 - "UgcAnonAbuseRepository"
Cohesion: 0.18
Nodes (5): wordController, assertAnonWriteAllowed(), subjectsFrom(), AnonAbuseSubject, UgcAnonAbuseRepository

### Community 71 - "RefreshTokenRepository"
Cohesion: 0.05
Nodes (29): CreateAdminUserCommand, ListAdminUsersUseCase, LogoutAllDevicesUseCase, LogoutUserUseCase, REFRESH_ROTATION_GRACE_MS, RefreshResult, RefreshTokenUseCase, withinRotationGrace() (+21 more)

### Community 72 - "logger.ts"
Cohesion: 0.09
Nodes (21): @hono/node-server, app, server, shutdown(), ImageStoragePort, UploadCredentials, CreateUploadCredentialsUseCase, createImageStorage() (+13 more)

### Community 73 - "CategoryRepository"
Cohesion: 0.17
Nodes (8): CreateCategoryCommand, CreateCategoryUseCase, DeleteCategoryUseCase, UpdateCategoryCommand, UpdateCategoryUseCase, ListCategoriesUseCase, Category, CategoryRepository

### Community 74 - "contribution.entity.ts"
Cohesion: 0.13
Nodes (11): GetMyContributionDetailUseCase, ListMyContributionsQuery, ListMyContributionsUseCase, ContributionStatus, MySubmission, MySubmissionKind, MyContributionController, serializeMine() (+3 more)

### Community 75 - "vote.repository.ts"
Cohesion: 0.16
Nodes (12): GetVoteDeckQuery, GetVoteDeckUseCase, AdminVoteListItem, decodeVoteDeckCursor(), encodeVoteDeckCursor(), Vote, VoteDeckCursor, VoteDeckListOptions (+4 more)

### Community 76 - "create-admin-user.use-case.ts"
Cohesion: 0.12
Nodes (21): ASSIGNABLE_ADMIN_ROLES, AssignableAdminRole, CreateAdminUserUseCase, isReservedHandle(), RESERVED_HANDLES, fitCandidate(), isSyntheticOauthEmail(), randomUsernameToken() (+13 more)

### Community 77 - "ilikeCompat"
Cohesion: 0.32
Nodes (7): ListAtoZParams, SearchParams, browseSafeUsageLabelsSql(), escapeLike(), searchTerms(), toUsageLabels(), ilikeCompat()

### Community 78 - "place.controller.ts"
Cohesion: 0.11
Nodes (21): ListPlacesUseCase, mapImages(), mapSources(), PlaceController, serialize(), serializeImage(), attributionSchema, createPlaceBodySchema (+13 more)

### Community 79 - "list-my-vote-history.use-case.ts"
Cohesion: 0.36
Nodes (3): ListMyVoteHistoryUseCase, VoteHistoryListOptions, VoteHistoryListResult

### Community 80 - "ActivityEventFeedRepositoryImpl"
Cohesion: 0.14
Nodes (10): ActivityEventKind, ActivityEventFeedRepositoryImpl, cursorFromEventId(), profileCategoryOf(), quoted(), CONTRIBUTION_KIND, insertAll(), main() (+2 more)

### Community 81 - "trigger-sqlite-backup.use-case.ts"
Cohesion: 0.08
Nodes (22): GithubActionsDispatchPort, WorkflowDispatchInput, ListDatabaseBackupLogsUseCase, BACKUP_STALE_MESSAGE, BACKUP_STALE_MS, resolveGithubToken(), TriggerSqliteBackupInput, TriggerSqliteBackupResult (+14 more)

### Community 82 - "web-import.repository.impl.ts"
Cohesion: 0.05
Nodes (50): ApproveWebImportUseCase, GetWebImportUseCase, ListWebImportsUseCase, normalizeType(), PreviewWebImportUseCase, RejectWebImportUseCase, SubmitWebImportInput, SubmitWebImportResult (+42 more)

### Community 83 - "admin-api-client.use-cases.ts"
Cohesion: 0.07
Nodes (36): ALLOWED_SCOPES, assertChannels(), assertScopes(), assertStatus(), CHANNELS, CreateAdminApiClientUseCase, GetAdminApiClientUseCase, ListAdminApiClientsUseCase (+28 more)

### Community 84 - "DiscussionController"
Cohesion: 0.16
Nodes (12): DiscussionController, redactReplyAudio(), redactReplyBody(), toAdminItem(), toAdminReply(), toPublicReply(), DiscussionRoutesDeps, CreateDiscussionBody (+4 more)

### Community 85 - "AppSettingsRepository"
Cohesion: 0.06
Nodes (31): FacebookLoginDto, GithubLoginDto, GoogleLoginDto, RegisterUserUseCase, SocialConsentOutcome, activeConsents, makeDeps(), AcceptLegalUseCase (+23 more)

### Community 86 - "PlaceRepository"
Cohesion: 0.07
Nodes (10): AppendPlaceImagesUseCase, CreatePlaceUseCase, DeletePlaceUseCase, GetPlaceBySlugUseCase, GetPlaceViewReportUseCase, ListPlaceImagesUseCase, ListPlaceViewsUseCase, RecordPlaceViewUseCase (+2 more)

### Community 87 - "logger"
Cohesion: 0.16
Nodes (8): GitHubPublicImageStorageService, createPublicImageStorage(), buildJsDelivrPublicUrl(), bytesToBase64(), parseGithubRepoUrl(), GitHubPronunciationStorageService, createPronunciationStorage(), logger

### Community 88 - "system-supabase.controller.ts"
Cohesion: 0.12
Nodes (14): ListSupabaseHealthChecksUseCase, projectRefFromUrl(), TriggerSupabaseHealthCheckUseCase, SupabaseHealthCheck, SupabaseHealthCheckFilter, SupabaseHealthCheckPage, SupabaseHealthCheckRepository, SupabaseHealthEnv (+6 more)

### Community 89 - "mobile-analytics-provider.ts"
Cohesion: 0.19
Nodes (15): ga4DateToYmd(), Ga4ReportRequest, Ga4ReportResponse, MobileAnalyticsProviderImpl, MobileRecord, num(), parseAppVersions(), parseCountries() (+7 more)

### Community 90 - "comment.routes.ts"
Cohesion: 0.12
Nodes (24): AdminCommentRoutesDeps, createAdminCommentRoutes(), json(), CommentRoutesDeps, createCommentRoutes(), createWordCommentRoutes(), json(), ulid26 (+16 more)

### Community 91 - "bulk-words-action.use-case.ts"
Cohesion: 0.10
Nodes (16): BulkWordsAction, BulkWordsActionResult, BulkWordsActionUseCase, BulkWordsItemFailure, BulkWordsItemResult, BulkWordsItemSuccess, PUBLISH_ROLES, WORDS_BULK_MAX (+8 more)

### Community 93 - "legal.routes.ts"
Cohesion: 0.16
Nodes (19): acceptLegalBodySchema, acceptLegalResponseSchema, appSettingItemSchema, appSettingsListResponseSchema, createLegalDraftBodySchema, currentLegalResponseSchema, legalDocumentAdminResponseSchema, legalDocumentAdminSchema (+11 more)

### Community 94 - "place-contribution.controller.ts"
Cohesion: 0.09
Nodes (15): decisionCopy(), PlaceContributionUseCases, composePlaceRejectDisplay(), PLACE_REJECT_REASON_CODES, PLACE_REJECT_REASON_LABELS, PlaceRejectReasonCode, ContributionPayload, mapRow() (+7 more)

### Community 95 - "word.entity.ts"
Cohesion: 0.07
Nodes (34): SetWordImageContentWarningsUseCase, CloseOpenWordReports, TakedownWordCommand, TakedownWordUseCase, RelatedWordRef, TAKEDOWN_REASON_CODES, TakedownReasonCode, WORD_REPORT_REASON_CODES (+26 more)

### Community 96 - "comment-blocklist.validator.ts"
Cohesion: 0.12
Nodes (15): BLOCKLIST_BULK_MAX, BLOCKLIST_WORD_MAX_LENGTH, normalizeBlocklistWords(), NormalizedBlocklistBatch, CommentBlocklistController, BulkCreateBlocklistBody, bulkCreateBlocklistBodySchema, bulkCreateBlocklistResponseSchema (+7 more)

### Community 97 - "activity-event.entity.ts"
Cohesion: 0.12
Nodes (10): RecordActivityEventCommand, RecordCardShareUseCase, ACTIVITY_EVENT_KINDS, ActivityEventRow, AppendActivityEventInput, ActivityEventCursor, ActivityEventRepository, AppendResult (+2 more)

### Community 98 - "LanguageRepository"
Cohesion: 0.15
Nodes (7): ListDialectsUseCase, ListLanguagesUseCase, Dialect, Language, LanguageRepository, LanguageRepositoryImpl, LanguageController

### Community 99 - "notification.routes.ts"
Cohesion: 0.15
Nodes (15): NotificationController, createNotificationRoutes(), json(), NotificationRoutesDeps, inboxNotificationTypeSchema, ListNotificationsQuery, listNotificationsQuerySchema, listNotificationsResponseSchema (+7 more)

### Community 100 - "PublicImageStoragePort"
Cohesion: 0.09
Nodes (27): fetchImageBytes(), PromotedWordImage, promoteWordImageFromStaging(), PromoteWordImageOptions, StagingWordImage, PublicImageStoragePort, PublicImagePurpose, UploadPublicImageResult (+19 more)

### Community 101 - "user.routes.ts"
Cohesion: 0.19
Nodes (16): createMeAvatarRoutes(), createMeProfileRoutes(), createPublicUserRoutes(), getCachedSuggest(), json(), setCachedSuggest(), suggestCache, SuggestCacheEntry (+8 more)

### Community 102 - "VoteRepositoryImpl"
Cohesion: 0.17
Nodes (7): MyVoteItem, VoteCountItem, ResetTargetVotesCommand, ToggleVoteResult, VoteCounts, VoteTarget, VoteRepositoryImpl

### Community 103 - "word-import-session.use-cases.ts"
Cohesion: 0.15
Nodes (12): actor(), UserLookupPort, ClaimWordImportSessionUseCase, emptyToNull(), resolveImportAttributedTo(), WordImportSessionItem, WordImportSessionStatus, WordImportSupportType (+4 more)

### Community 104 - "ServiceUnavailableError"
Cohesion: 0.09
Nodes (21): FacebookAccessTokenClaims, GoogleIdTokenClaims, FACEBOOK_GRAPH_VERSION, FacebookFetch, FacebookTokenVerifier, facebookTokenVerifier, facebookTokenVerifierHolder, invalidToken() (+13 more)

### Community 105 - "NotificationRepository"
Cohesion: 0.12
Nodes (6): GetUnreadNotificationCountUseCase, ListMyNotificationsUseCase, MarkAllNotificationsReadUseCase, MarkNotificationReadUseCase, NotificationRepository, repo()

### Community 106 - "admin-api-client.routes.ts"
Cohesion: 0.14
Nodes (18): AdminApiClientController, AdminCtx, AdminApiClientRoutesDeps, createAdminApiClientRoutes(), json(), apiClientAdminListResponseSchema, apiClientAdminResponseSchema, apiClientAdminSchema (+10 more)

### Community 107 - "PushSenderPort"
Cohesion: 0.20
Nodes (11): PushMessage, PushSenderPort, PushSendResult, FcmPushSender, getFcmAccessToken(), NoopPushSender, pushOne(), pushTopic() (+3 more)

### Community 108 - "campaign.use-cases.ts"
Cohesion: 0.14
Nodes (11): CancelCampaignUseCase, ProcessCampaignDeliveryUseCase, ProcessDueCampaignsUseCase, RetryFailedCampaignRecipientsUseCase, SendCampaignUseCase, buildCampaignPushData(), CAMPAIGN_CHUNK_SIZE, CAMPAIGN_FCM_TOPIC (+3 more)

### Community 109 - "merge-activity.ts"
Cohesion: 0.10
Nodes (20): ListActivityInput, ListActivityPage, ListActivityUseCase, ActivityActor, ActivityKind, ActivityTarget, ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT (+12 more)

### Community 110 - "legal.controller.ts"
Cohesion: 0.17
Nodes (10): AdminCtx, LegalController, LegalRoutesDeps, mapLegalDocumentAdmin(), mapLegalDocumentPublic(), AcceptLegalBody, CreateLegalDraftBody, ListAdminLegalQuery (+2 more)

### Community 111 - "notification-campaign.controller.ts"
Cohesion: 0.16
Nodes (10): mapCampaign(), mapTemplate(), AdminCtx, NotificationCampaignController, CreateCampaignBody, CreateTemplateBody, EstimateAudienceBody, ListCampaignsQuery (+2 more)

### Community 112 - "scripts"
Cohesion: 0.09
Nodes (23): scripts, cleanup-tokens, dataset:export, db:backfill-activity, db:backfill-consents, db:migrate, deploy, deploy:staging (+15 more)

### Community 113 - "PlaceRepositoryImpl"
Cohesion: 0.12
Nodes (10): dayOffset(), loadImagesForPlaces(), mapImage(), mapPlace(), normalizeImages(), parseAttribution(), parseRelated(), parseSources() (+2 more)

### Community 114 - "bookmark.routes.ts"
Cohesion: 0.18
Nodes (13): MAX_BOOKMARK_WORD_IDS, BookmarkController, BookmarkRoutesDeps, createBookmarkRoutes(), json(), bookmarkDataSchema, cursorMetaSchema, MyBookmarksQuery (+5 more)

### Community 115 - "BadRequestError"
Cohesion: 0.11
Nodes (23): onAnonRateLimited(), assertOurPlaceImage(), ALLOWED_AUDIO_MIMES, looksLikeM4a(), looksLikeMp3(), looksLikeOgg(), looksLikeWav(), looksLikeWebm() (+15 more)

### Community 116 - ".findById"
Cohesion: 0.14
Nodes (5): ChangePasswordDto, ChangePasswordUseCase, Password, dto, makeDeps()

### Community 117 - "wa-admin.routes.ts"
Cohesion: 0.12
Nodes (19): createWaAdminRoutes(), createWaTemplateBodySchema, json(), listWaLogsQuerySchema, requireUser(), serializeTemplate(), serializeUsage(), testSendBodySchema (+11 more)

### Community 118 - "package.json"
Cohesion: 0.05
Nodes (38): dependencies, dotenv, drizzle-orm, hono, @hono/node-server, @hono/zod-openapi, jose, @libsql/client (+30 more)

### Community 119 - "createMailer"
Cohesion: 0.18
Nodes (12): 1. Verifikasi file sudah benar (RED evidence dulu), 2. Verifikasi GREEN lokal, 3. Commit TERBATAS satu file (butuh go-ahead Tuan dulu), 4. Push staging + pantau CI (butuh go-ahead Tuan dulu), Architecture / pendekatan, Current context / asumsi, Fix: 29 suite e2e CI gagal — Cannot find module './smtp-mailer.service', Goal (+4 more)

### Community 120 - "propose-category-suggestion.use-case.ts"
Cohesion: 0.23
Nodes (5): ProposeCategorySuggestionCommand, CategorySuggestion, CategorySuggestionStatus, normalizeCategoryName(), CreateCategorySuggestionInput

### Community 122 - "DeviceTokenRepository"
Cohesion: 0.11
Nodes (6): RegisterDeviceTokenUseCase, RevokeDeviceTokenUseCase, DeviceTokenRecord, DeviceTokenRepository, DeviceTokenRepositoryImpl, toRecord()

### Community 123 - "admin-vote.routes.ts"
Cohesion: 0.11
Nodes (22): AdminVotesController, AdminVoteRoutesDeps, json(), adminTopTargetWireSchema, AdminVoteTargetType, adminVoteWireSchema, DeleteAdminVoteParams, deleteAdminVoteParamsSchema (+14 more)

### Community 124 - "vote.routes.ts"
Cohesion: 0.11
Nodes (23): MAX_VOTE_TARGETS, myVotesResponseSchema, SkipVoteDeckBody, skipVoteDeckParamsSchema, skipVoteDeckResponseSchema, skipVoteDeckSchema, targetsQuerySchema, ToggleVoteBody (+15 more)

### Community 125 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 126 - "activity.routes.ts"
Cohesion: 0.27
Nodes (9): createActivityRoutes(), createCardShareRoutes(), json(), activityActorSchema, activityItemSchema, activityTargetSchema, listActivityQuerySchema, listActivityResponseSchema (+1 more)

### Community 127 - "ContributionController"
Cohesion: 0.24
Nodes (5): ContributionController, decisionResponse(), serializeEntity(), CorrectContributionBody, ListContributionsQueryBody

### Community 128 - "search-miss.routes.ts"
Cohesion: 0.18
Nodes (16): createAdminSearchMissRoutes(), createSearchMissRoutes(), json(), SearchMissRoutesDeps, adminSearchMissQuerySchema, bulkDismissItemFailureSchema, bulkDismissItemSuccessSchema, bulkDismissSearchMissBodySchema (+8 more)

### Community 129 - "AchievementRepositoryImpl"
Cohesion: 0.13
Nodes (5): ListAchievementsFilter, AchievementRepositoryImpl, parseCriteria(), toDomain(), toOwnership()

### Community 130 - "approve-verifier-application.use-case.ts"
Cohesion: 0.13
Nodes (12): DEFAULT_WA_GROUP_CTA_URL, APPROVE_BENEFITS, ApproveVerifierApplicationCommand, ApproveVerifierApplicationResult, rejectBody(), RejectVerifierApplicationCommand, RejectVerifierApplicationResult, RejectVerifierApplicationUseCase (+4 more)

### Community 131 - "jwt-token.service.ts"
Cohesion: 0.14
Nodes (11): jose, ulid, authenticate, optionalAuthenticate, softAuthenticate, AccessTokenPayload, JwtTokenService, JwtTokenServiceOptions (+3 more)

### Community 132 - "category-suggestion.controller.ts"
Cohesion: 0.23
Nodes (13): ListCategorySuggestionsUseCase, ProposeCategorySuggestionUseCase, ApproveCategorySuggestionUseCase, RejectCategorySuggestionCommand, RejectCategorySuggestionUseCase, ReviewCategorySuggestionCommand, createCategorySuggestionModule(), CategorySuggestionController (+5 more)

### Community 133 - "verifier-application.repository.impl.ts"
Cohesion: 0.22
Nodes (12): CreateVerifierApplicationCommand, ResubmitVerifierApplicationCommand, NewVerifierApplication, SocialLink, SocialPlatform, VerifierApplicationListItem, VerifierApplicationStatus, VerifierApplicationListFilter (+4 more)

### Community 134 - "achievement.controller.ts"
Cohesion: 0.26
Nodes (12): CreateAchievementUseCase, DeleteAchievementUseCase, GrantAchievementUseCase, PreviewAchievementUseCase, RevokeUserAchievementUseCase, SetActiveBorderUseCase, UpdateAchievementUseCase, ListActiveAchievementsUseCase (+4 more)

### Community 135 - "word-report.validator.ts"
Cohesion: 0.12
Nodes (21): AdminWordReportRoutesDeps, createAdminWordReportRoutes(), json(), CreateWordReportBody, createWordReportBodySchema, createWordReportResponseSchema, ListWordReportsQuery, listWordReportsQuerySchema (+13 more)

### Community 136 - "update-word.validator.ts"
Cohesion: 0.14
Nodes (14): createWordBodySchema, createWordSchema, refineMeaningPadanan(), relationTypeSchema, ulid, variantRootRefine(), wordStatusSchema, wordTypeSchema (+6 more)

### Community 138 - "device.routes.ts"
Cohesion: 0.24
Nodes (9): DeviceController, createDeviceRoutes(), DeviceRoutesDeps, json(), deviceTokenMutationResponseSchema, RegisterDeviceTokenBody, registerDeviceTokenSchema, RevokeDeviceTokenBody (+1 more)

### Community 139 - "openapi-app.ts"
Cohesion: 0.08
Nodes (30): @hono/zod-openapi, createDuplicateConfirmRoutes(), DuplicateConfirmBody, duplicateConfirmBodySchema, duplicateConfirmResponseSchema, DuplicateConfirmRoutesDeps, json(), AdminCtx (+22 more)

### Community 140 - "SambasKu-API"
Cohesion: 0.13
Nodes (14): Akses Database, Alur record (DB + asset), Audio pelafalan (GitHub asset repo), Cloudflare Workers (deploy), Command Sehari-hari, Database (tanpa Docker), Database test (integration & e2e), Deploy otomatis dari GitHub (CI/CD) (+6 more)

### Community 141 - "AchievementCriteria"
Cohesion: 0.18
Nodes (3): findAchievementSource(), AchievementCandidate, AchievementCriteria

### Community 142 - "review-push-cooldown-gate.ts"
Cohesion: 0.21
Nodes (8): makePushCooldownGate(), DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES, REVIEW_APPROVE_PUSH_COOLDOWN_MINUTES_KEY, REVIEW_REJECT_PUSH_COOLDOWN_MINUTES_KEY, log(), parseCooldownMinutes(), ReviewPushCooldownGate, ReviewPushCooldownChannel

### Community 143 - "search-miss.controller.ts"
Cohesion: 0.22
Nodes (7): SearchMissController, toApi(), AdminSearchMissQueryBody, BulkDismissSearchMissBody, PublicSearchMissQueryBody, ResolveSearchMissBody, UpdateSearchMissBody

### Community 144 - "VerifierApplication"
Cohesion: 0.25
Nodes (5): VerifierApplication, asLinks(), throwMappedUnique(), toEntity(), VerifierApplicationRepositoryImpl

### Community 145 - "fts-word-search-index.ts"
Cohesion: 0.36
Nodes (3): SearchIndexHit, WordSearchIndex, FtsWordSearchIndex

### Community 146 - "CommentController"
Cohesion: 0.23
Nodes (6): CommentController, redactPublicAudio(), redactPublicBody(), toPublicCommentFields(), ListAdminCommentsQueryBody, ListCommentsQueryBody

### Community 147 - "announcement.routes.ts"
Cohesion: 0.22
Nodes (11): AnnouncementRoutesDeps, createAdminAnnouncementRoutes(), createPublicAnnouncementRoutes(), json(), announcementItemResponseSchema, announcementItemSchema, announcementListResponseSchema, bodyTypeSchema (+3 more)

### Community 148 - "UserSkipRepository"
Cohesion: 0.23
Nodes (3): UserSkipRepository, SkipVoteDeckWordUseCase, makeDeps()

### Community 149 - "toOwnerItem"
Cohesion: 0.16
Nodes (9): isVerifierRole(), redactDiscussionAudio(), toAdminImages(), toOwnerImages(), toOwnerItem(), toPublicImages(), toPublicItem(), ListDiscussionsQuery (+1 more)

### Community 150 - "QuotaAwareMailer"
Cohesion: 0.11
Nodes (10): EmailSenderPort, EmailSendPayload, EmailSendResult, EmailLogRepository, EmailUsageRepository, EmailRoutingEntry, QuotaAwareMailer, ResendEmailSender (+2 more)

### Community 151 - "LegalDocument"
Cohesion: 0.33
Nodes (4): LegalDocument, LegalDocumentListResult, LegalDocumentRepositoryImpl, toEntity()

### Community 152 - "UserController"
Cohesion: 0.13
Nodes (5): UserController, PublicActivityQuery, myProfileResponseSchema, UpdateMyProfileBody, updateMyProfileSchema

### Community 154 - "SearchMissRepositoryImpl"
Cohesion: 0.27
Nodes (3): SearchMissUpdatePatch, normalizeTerm, SearchMissRepositoryImpl

### Community 155 - "VerifierApplicationController"
Cohesion: 0.26
Nodes (4): ListVerifierApplicationsQuery, SubmitVerifierApplicationBody, toMine(), VerifierApplicationController

### Community 156 - ".toDetailData"
Cohesion: 0.18
Nodes (5): AdminListWordsQueryBody, ListWordsQueryBody, SearchWordsQueryBody, setPublicWordReadCache(), toListItem()

### Community 157 - "WordReportController"
Cohesion: 0.38
Nodes (3): ResolveWordReportBody, toWordReportItem(), WordReportController

### Community 158 - "list-audit-logs.use-case.ts"
Cohesion: 0.27
Nodes (6): ListAuditLogsResult, ListAuditLogsUseCase, AuditLog, AuditLogFilter, AuditLogPage, toEntity()

### Community 159 - "audit.routes.ts"
Cohesion: 0.27
Nodes (7): AuditController, createAuditRoutes(), json(), auditLogItemSchema, auditLogListResponseSchema, ListAuditLogsQuery, listAuditLogsQuerySchema

### Community 160 - "Achievement"
Cohesion: 0.28
Nodes (6): Achievement, CreateAchievementInput, UpdateAchievementInput, UserAchievement, AchievementCategory, RewardType

### Community 161 - "RecordInboxNotificationUseCase"
Cohesion: 0.07
Nodes (19): RecordActivityEventUseCase, ConfirmDuplicateMeaningDto, ConfirmDuplicateMeaningResult, ConfirmDuplicateMeaningUseCase, ImageReviewDecision, ReviewContributionCommand, makeDeps(), log() (+11 more)

### Community 162 - "ForbiddenError"
Cohesion: 0.23
Nodes (6): UpdateVerifierApplicationScreenshotUseCase, UpdateVerifierScreenshotCommand, SocialScreenshot, makeUseCase(), screenshot, ForbiddenError

### Community 163 - "get-vote-counts.use-case.test.ts"
Cohesion: 0.17
Nodes (6): GetMyVotesUseCase, GetVoteCountsUseCase, makeDeps(), MEANING, PRON, WORD

### Community 164 - "create-word.validator.test.ts"
Cohesion: 0.50
Nodes (4): build(), FORM_A, FORM_B, ULID()

### Community 165 - "Gambar publik (GitHub asset repo)"
Cohesion: 0.50
Nodes (4): Alur record (DB + asset), Endpoint ringkas, Env (lokal / Workers), Gambar publik (GitHub asset repo)

### Community 166 - "bulk-dismiss-search-miss.use-case.ts"
Cohesion: 0.19
Nodes (8): BulkDismissSearchMissCommand, BulkDismissSearchMissItemFailure, BulkDismissSearchMissItemResult, BulkDismissSearchMissItemSuccess, BulkDismissSearchMissResult, BulkDismissSearchMissUseCase, SEARCH_MISS_BULK_DISMISS_MAX, makeUseCase()

### Community 167 - "PublicUserRepositoryImpl"
Cohesion: 0.24
Nodes (3): achievementController, PublicUserRepositoryImpl, toPage()

### Community 168 - "get-legal.use-cases.ts"
Cohesion: 0.26
Nodes (5): CurrentLegalSummary, GetCurrentLegalUseCase, GetLegalDocumentUseCase, publicPath(), LegalDocumentType

### Community 169 - "list-admin-votes.use-case.ts"
Cohesion: 0.26
Nodes (7): ListAdminVotesCommand, ListAdminVotesUseCase, AdminVoteListFilter, AdminVoteListResult, decodeAdminCursor(), encodeAdminCursor(), makeDeps()

### Community 170 - "AuditLogRepository"
Cohesion: 0.06
Nodes (20): AuditLogRepository, BulkCreateBlocklistResult, BulkCreateBlocklistWordsUseCase, CreateBlocklistWordUseCase, DeleteBlocklistWordUseCase, ListBlocklistWordsUseCase, CommentBlocklistWord, CursorPage (+12 more)

### Community 171 - "import-session.validator.ts"
Cohesion: 0.18
Nodes (10): ClaimImportSessionBody, claimImportSessionBodySchema, importSessionItemSchema, importSessionResponseSchema, ListImportSessionsQuery, listImportSessionsQuerySchema, rollbackImportSessionResponseSchema, SaveImportSessionBody (+2 more)

### Community 172 - "scan-achievement.use-case.ts"
Cohesion: 0.22
Nodes (7): ACHIEVEMENT_SCAN_BATCH_LIMIT, ACHIEVEMENT_SCAN_INTERVAL_MS, ACHIEVEMENTS_LAST_SCAN_KEY, RunDueAchievementScanResult, RunDueAchievementScanUseCase, ScanAchievementResult, ScanAchievementUseCase

### Community 174 - "scan-achievement.test.ts"
Cohesion: 0.27
Nodes (3): AwardTarget, achievement, FakeRepo

### Community 175 - "bulk-words.validator.ts"
Cohesion: 0.25
Nodes (6): bulkItemFailureSchema, bulkItemSuccessSchema, bulkWordsActionSchema, BulkWordsBody, bulkWordsBodySchema, bulkWordsResponseSchema

### Community 176 - "github-token-verifier.ts"
Cohesion: 0.24
Nodes (7): GithubUserClaims, GhEmail, GhUser, GithubTokenVerifier, githubTokenVerifier, githubTokenVerifierHolder, INVALID()

### Community 178 - "hono"
Cohesion: 0.15
Nodes (18): hono, GetWebAnalyticsUseCase, WEB_ANALYTICS_SECTIONS, dateRangeSchema, providerResultSchema, webAnalyticsParamsSchema, WebAnalyticsQuery, webAnalyticsQuerySchema (+10 more)

### Community 179 - "refresh-token.repository.impl.ts"
Cohesion: 0.27
Nodes (4): NewRefreshToken, RefreshTokenRecord, mapRow(), RefreshTokenRepositoryImpl

### Community 181 - "achievement-registry.ts"
Cohesion: 0.20
Nodes (7): ACHIEVEMENT_SELECTABLE_SOURCES, ACHIEVEMENT_SOURCE_REGISTRY, AchievementFilterField, AchievementSourceDefinition, isAchievementSourceKnown(), manualSource, registrationSource

### Community 182 - "worker.ts"
Cohesion: 0.43
Nodes (6): AppModule, bootstrap(), Env, fetch(), loadApp(), scheduled()

### Community 183 - "createDiscussionRoutes"
Cohesion: 0.47
Nodes (6): createDiscussionRoutes(), json(), replyAudioUserLimit(), replyUserLimit(), submitUserLimit(), ugcRateLimitedHook()

### Community 184 - "word-comment-push-cooldown-gate.ts"
Cohesion: 0.09
Nodes (16): DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES, WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY, CHANNEL, log(), parseCooldownMinutes(), CHANNEL, log(), parseCooldownMinutes() (+8 more)

### Community 185 - "map-word-image-url.ts"
Cohesion: 0.60
Nodes (3): mapPublicWordImageUrl(), WordImageUrlFields, PENDING_WORD_IMAGE_PLACEHOLDER_URL

### Community 187 - "EmailVerificationOtpRepositoryImpl"
Cohesion: 0.25
Nodes (3): NewEmailVerificationOtp, EmailVerificationOtpRepositoryImpl, toEntity()

### Community 193 - "pronunciation-audio-path.ts"
Cohesion: 0.39
Nodes (6): buildCommentAudioPath(), buildDiscussionReplyAudioPath(), buildPronunciationAudioPath(), extensionForMime(), MIME_TO_EXT, slugifyLemma()

### Community 194 - "comment.repository.impl.test.ts"
Cohesion: 0.22
Nodes (7): ADMIN, AUTHOR, OTHER, { parsed }, SMB, WORD, WORD2

### Community 195 - "approve-verifier-application.use-case.test.ts"
Cohesion: 0.31
Nodes (3): ApproveVerifierApplicationUseCase, cmd, makeUseCase()

### Community 196 - ".listAdmin"
Cohesion: 0.31
Nodes (4): AdminVoteCursor, VoteHistoryWord, clipPreview(), voteTargetKey()

### Community 197 - "AccountDeletionTokenRepositoryImpl"
Cohesion: 0.29
Nodes (3): AccountDeletionTokenRecord, NewAccountDeletionToken, AccountDeletionTokenRepositoryImpl

### Community 198 - "update-search-miss.use-case.ts"
Cohesion: 0.32
Nodes (3): UpdateSearchMissCommand, UpdateSearchMissUseCase, normalizeSearchMissTerm()

### Community 199 - "batch-contribute-words.use-case.ts"
Cohesion: 0.36
Nodes (5): BATCH_CONTRIBUTE_MAX_ROWS, BATCH_CONTRIBUTE_SOURCE_LABEL, BatchContributeResult, BatchContributeRow, BatchContributeWordsUseCase

### Community 200 - "category-suggestion.dtos.ts"
Cohesion: 0.29
Nodes (6): ListCategorySuggestionsQueryDTO, ListCategorySuggestionsQuerySchema, ProposeCategorySuggestionDTO, ProposeCategorySuggestionSchema, ReviewCategorySuggestionDTO, ReviewCategorySuggestionSchema

### Community 202 - "verifier-application.use-case.test.ts"
Cohesion: 0.33
Nodes (4): links, makeApp(), makeAppRepo(), submit

### Community 203 - "import-words.validator.ts"
Cohesion: 0.33
Nodes (4): importMeaningSchema, ImportWordsBody, importWordsBodySchema, importWordsResponseSchema

### Community 206 - "meaning-source.validator.test.ts"
Cohesion: 1.00
Nodes (3): build(), buildMeaning(), ULID()

## Knowledge Gaps
- **1123 isolated node(s):** `imports`, `name`, `version`, `description`, `license` (+1118 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1506 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `app-error.ts`, `word.repository.impl.ts`, `UserRepository`, `NotFoundError`, `createOpenApiApp`, `register-user.use-case.ts`, `test-utils.ts`, `comment.controller.ts`, `create-word.use-case.ts`, `login-with-facebook.use-case.ts`, `fcm-analytics.provider.ts`, `wa-message.repository.impl.ts`, `mobile-analytics.entity.ts`, `ResolvedRange`, `client.ts`, `UnauthorizedError`, `WordRepository`, `CursorPage`, `bug-report.repository.impl.ts`, `app-setting.entity.ts`, `user.controller.ts`, `AppVariables`, `get-web-analytics.use-case.ts`, `play-stats.provider.ts`, `list-share-backgrounds.use-case.ts`, `dashboard.repository.impl.ts`, `campaign.validator.ts`, `contribution.validator.ts`, `lemma-definition.mapper.ts`, `suggestion.validator.ts`, `legal-document.repository.impl.ts`, `add-word-image.use-case.ts`, `ugc-abuse-event.repository.ts`, `quota-aware-mailer.ts`, `types.ts`, `admin-verifier-application.routes.ts`, `WordSuggestionRepositoryImpl`, `ga4.provider.ts`, `import-words.use-case.ts`, `get-play-analytics.use-case.ts`, `SearchMissRepository`, `bookmark.repository.ts`, `RefreshTokenRepository`, `logger.ts`, `vote.repository.ts`, `create-admin-user.use-case.ts`, `trigger-sqlite-backup.use-case.ts`, `web-import.repository.impl.ts`, `admin-api-client.use-cases.ts`, `AppSettingsRepository`, `logger`, `bulk-words-action.use-case.ts`, `word.entity.ts`, `comment-blocklist.validator.ts`, `word-import-session.use-cases.ts`, `ServiceUnavailableError`, `NotificationRepository`, `campaign.use-cases.ts`, `merge-activity.ts`, `BadRequestError`, `.findById`, `package.json`, `DeviceTokenRepository`, `jwt-token.service.ts`, `update-word.validator.ts`, `UserSkipRepository`, `QuotaAwareMailer`, `UserController`, `RecordInboxNotificationUseCase`, `ForbiddenError`, `get-vote-counts.use-case.test.ts`, `create-word.validator.test.ts`, `bulk-dismiss-search-miss.use-case.ts`, `list-admin-votes.use-case.ts`, `AuditLogRepository`, `scan-achievement.test.ts`, `hono`, `word-comment-push-cooldown-gate.ts`, `map-word-image-url.ts`, `query-boolean.ts`, `comment.repository.impl.test.ts`, `approve-verifier-application.use-case.test.ts`, `batch-contribute-words.use-case.ts`, `verifier-application.use-case.test.ts`, `error-handler.middleware.ts`, `meaning-source.validator.test.ts`, `publish-or-merge-meanings.test.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `drizzle-orm` connect `drizzle-orm` to `vitest`, `word.repository.impl.ts`, `UserRepository`, `app.ts`, `verifier-application.repository.impl.ts`, `test-utils.ts`, `wa-message.repository.impl.ts`, `region.repository.impl.ts`, `client.ts`, `bug-report.repository.impl.ts`, `app-setting.entity.ts`, `notification-campaign.repository.impl.ts`, `announcement.controller.ts`, `place-category.repository.impl.ts`, `dashboard.repository.impl.ts`, `word-group.controller.ts`, `activity-event-feed.repository.impl.ts`, `notification.repository.impl.ts`, `AuditLogRepository`, `legal-document.repository.impl.ts`, `ugc-abuse-event.repository.ts`, `email.repository.impl.ts`, `refresh-token.repository.impl.ts`, `achievement-registry.ts`, `place.repository.impl.ts`, `comment.repository.impl.test.ts`, `create-admin-user.use-case.ts`, `ActivityEventFeedRepositoryImpl`, `trigger-sqlite-backup.use-case.ts`, `web-import.repository.impl.ts`, `admin-api-client.use-cases.ts`, `word.entity.ts`, `package.json`, `propose-category-suggestion.use-case.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `zod` connect `zod` to `search-miss.routes.ts`, `app.ts`, `achievement.controller.ts`, `createOpenApiApp`, `update-word.validator.ts`, `word-report.validator.ts`, `device.routes.ts`, `openapi-app.ts`, `fcm-analytics.provider.ts`, `mobile-analytics.entity.ts`, `region.repository.impl.ts`, `announcement.routes.ts`, `UnauthorizedError`, `UserController`, `AppVariables`, `audit.routes.ts`, `list-share-backgrounds.use-case.ts`, `place-category.repository.impl.ts`, `campaign.validator.ts`, `word-group.controller.ts`, `contribution.validator.ts`, `lemma-definition.mapper.ts`, `import-session.validator.ts`, `suggestion.validator.ts`, `add-word-image.use-case.ts`, `bulk-words.validator.ts`, `hono`, `types.ts`, `admin-verifier-application.routes.ts`, `get-play-analytics.use-case.ts`, `query-boolean.ts`, `discussion.validator.ts`, `create-word.validator.ts`, `category-suggestion.dtos.ts`, `logger.ts`, `import-words.validator.ts`, `error-handler.middleware.ts`, `place.controller.ts`, `web-import.repository.impl.ts`, `comment.routes.ts`, `legal.routes.ts`, `place-contribution.controller.ts`, `comment-blocklist.validator.ts`, `notification.routes.ts`, `user.routes.ts`, `admin-api-client.routes.ts`, `bookmark.routes.ts`, `wa-admin.routes.ts`, `package.json`, `admin-vote.routes.ts`, `vote.routes.ts`, `activity.routes.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `imports`, `name`, `version` to the rest of the system?**
  _1123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `vitest` be split into smaller, more focused modules?**
  _Cohesion score 0.021207750185177964 - nodes in this community are weakly interconnected._
- **Should `app-error.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03472035794183445 - nodes in this community are weakly interconnected._
- **Should `word.repository.impl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03426604818195421 - nodes in this community are weakly interconnected._