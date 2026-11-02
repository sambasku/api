# Graph Report - api  (2026-10-21)

## Corpus Check
- 1110 files · ~558,584 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .mdc 4, (none) 3, .example 2)

## Summary
- 6934 nodes · 22834 edges · 193 communities (179 shown, 14 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 960 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a69e3983`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vitest
- app-error.ts
- word.repository.impl.ts
- UnauthorizedError
- app.ts
- create-comment-audio.use-case.ts
- createOpenApiApp
- UserRepository
- test-utils.ts
- ConflictError
- drizzle-orm
- comment.controller.ts
- create-word.use-case.ts
- BadRequestError
- fcm-analytics.provider.ts
- wa-message.repository.impl.ts
- ResolvedRange
- region.repository.impl.ts
- fake-web-analytics.provider.ts
- seed-reference.ts
- zod
- WordRepository
- word.repository.ts
- contribution.use-case.test.ts
- CursorPage
- AppSettingsRepository
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
- types.ts
- vote.repository.impl.ts
- user.repository.impl.ts
- lemma-definition.mapper.ts
- NotificationRepository
- NotificationCampaignRepository
- suggestion.validator.ts
- legal.controller.ts
- word.controller.ts
- .constructor
- id.ts
- quota-aware-mailer.ts
- email.repository.impl.ts
- rate-limit.middleware.ts
- admin-verifier-application.routes.ts
- WordSuggestionRepositoryImpl
- web-analytics.entity.ts
- word-suggestion.entity.ts
- batch-contribute-words.use-case.ts
- get-play-analytics.use-case.ts
- place.repository.impl.ts
- admin-user.routes.ts
- ValidationError
- service-account-token.ts
- WordController
- discussion.validator.ts
- create-word.validator.ts
- publicAccountDisplayName
- src_shared_database_drizzle_schema_index_users
- SearchMissRepository
- bookmark.repository.impl.ts
- admin-vote.controller.ts
- record-anon-abuse-signal.use-case.ts
- update-word.use-case.ts
- logger.ts
- CategoryRepository
- ContributionRepositoryImpl
- vote.repository.ts
- WordDetail
- WordSummary
- place.use-cases.ts
- VoteRepository
- ActivityEventFeedRepositoryImpl
- trigger-sqlite-backup.use-case.ts
- web-import.use-cases.ts
- admin-api-client.use-cases.ts
- DiscussionController
- user-consent.repository.impl.ts
- PlaceRepository
- BadGatewayError
- supabase-health-check.repository.impl.ts
- web-import.repository.impl.ts
- web-import.controller.ts
- bulk-words-action.use-case.ts
- word-report.controller.ts
- legal.routes.ts
- PlaceContributionUseCases
- resolve-word-report.use-case.ts
- comment-blocklist.validator.ts
- activity-event.entity.ts
- LanguageRepository
- notification.routes.ts
- validate-image-file.ts
- user.routes.ts
- VoteRepositoryImpl
- vote.controller.ts
- facebook-token-verifier.ts
- ServiceUnavailableError
- api-client.validator.ts
- PushSenderPort
- .processSelectedAudience
- merge-activity.ts
- LegalController
- pixabay-background.provider.ts
- scripts
- AuthController
- bookmark.routes.ts
- validate-audio-file.ts
- api-client.repository.impl.ts
- wa-admin.routes.ts
- package.json
- SmtpMailerService
- review-category-suggestion.use-case.ts
- CategorySuggestionRepository
- DeviceTokenRepository
- admin-vote.routes.ts
- vote.routes.ts
- compilerOptions
- activity.routes.ts
- contribution.controller.ts
- search-miss.routes.ts
- database-backup-log.repository.impl.ts
- word-media.routes.ts
- jwt-token.service.ts
- category-suggestion.controller.ts
- ApiClientRepository
- DiscussionRepositoryImpl
- word-report.validator.ts
- update-word.validator.ts
- CommentBlocklistWord
- device.routes.ts
- system-supabase.routes.ts
- SambasKu-API
- ActivityItem
- ReviewPushCooldownGate
- search-miss.controller.ts
- dependencies
- @libsql/client
- .execute
- announcement.routes.ts
- UserSkipRepository
- toOwnerItem
- .send
- LegalDocument
- place.validator.ts
- mailer.factory.ts
- SearchMissRepositoryImpl
- word-report.use-case.test.ts
- .toDetailData
- WordReportController
- list-audit-logs.use-case.ts
- audit.routes.ts
- .loginJson
- ToggleVoteUseCase
- place-category.routes.ts
- get-vote-counts.use-case.ts
- createWordSchema
- .github
- bulk-dismiss-search-miss.use-case.ts
- WebImport
- refresh-cookie.ts
- language.routes.ts
- resolve-search-miss.use-case.ts
- import-session.validator.ts
- WordReportRepositoryImpl
- CategorySuggestionRepositoryImpl
- lookup-lemma-definition.validator.ts
- bulk-words.validator.ts
- github-token-verifier.ts
- CategoryRepositoryImpl
- web-analytics.validator.ts
- devDependencies
- dismiss-search-miss.use-case.ts
- require-approved-client.middleware.ts
- worker.ts
- createDiscussionRoutes
- NotificationPushCooldownRepositoryImpl
- map-word-image-url.ts
- .assertNotBrowserBodyChannel
- share-query-denylist.ts
- query-boolean.ts
- deno.json
- ERROR_CODES.md
- ports/README.md

## God Nodes (most connected - your core abstractions)
1. `NotFoundError` - 250 edges
2. `AuditLogRepository` - 211 edges
3. `vitest` - 200 edges
4. `AppVariables` - 182 edges
5. `drizzle-orm` - 181 edges
6. `WordRepository` - 154 edges
7. `generateId()` - 153 edges
8. `UnauthorizedError` - 139 edges
9. `ConflictError` - 138 edges
10. `createOpenApiApp()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `1. Verifikasi file sudah benar (RED evidence dulu)` --references--> `createMailer()`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/mailer.factory.ts
- `Tests / validation` --references--> `createMailer()`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/mailer.factory.ts
- `Architecture / pendekatan` --references--> `SmtpMailerService`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/smtp-mailer.service.ts
- `Current context / asumsi` --references--> `createMailer()`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/mailer.factory.ts
- `Current context / asumsi` --references--> `SmtpMailerService`  [INFERRED]
  .hermes/plans/2026-10-06_105500-smtp-mailer-module-not-found.md → src/modules/auth/infrastructure/smtp-mailer.service.ts

## Import Cycles
- None detected.

## Communities (193 total, 14 thin omitted)

### Community 0 - "vitest"
Cohesion: 0.02
Nodes (132): dotenv, vitest, { parsed }, { parsed }, { parsed }, { parsed }, { parsed }, IDN (+124 more)

### Community 1 - "app-error.ts"
Cohesion: 0.03
Nodes (77): AuditLogRepository, SetUserActiveUseCase, makeDeps(), DeleteCommentCommand, BulkCreateBlocklistResult, BulkCreateBlocklistWordsUseCase, CreateBlocklistWordUseCase, DeleteBlocklistWordUseCase (+69 more)

### Community 2 - "word.repository.impl.ts"
Cohesion: 0.03
Nodes (112): CONTRIB_BODY, isFulfilledLemmaSql, matchesExcludedLemmaSql, WORD_BOUND_VOTE_TYPES, BM_BARU, BM_DEP, BM_LAMA, { parsed } (+104 more)

### Community 3 - "UnauthorizedError"
Cohesion: 0.04
Nodes (70): GithubLoginDto, LoginDto, SetPasswordDto, SetPasswordProvider, FacebookTokenVerifierPort, GithubTokenVerifierPort, GoogleTokenVerifierPort, TokenServicePort (+62 more)

### Community 4 - "app.ts"
Cohesion: 0.01
Nodes (158): abuseController, accountDeletion, activityController, activityEventFeedRepo, activityEventRepo, activityEvents, activityRepo, adminApiClientController (+150 more)

### Community 5 - "create-comment-audio.use-case.ts"
Cohesion: 0.04
Nodes (59): LiftAbuseMuteUseCase, RecordActivityEventUseCase, CreateCommentAudioCommand, CreateCommentAudioUseCase, truncateSnippet(), wordCommentBody(), CreateCommentCommand, CreateCommentUseCase (+51 more)

### Community 6 - "createOpenApiApp"
Cohesion: 0.05
Nodes (102): hono, @hono/zod-openapi, categoryItemResponseSchema, categoryItemSchema, categoryListResponseSchema, createCategoryBodySchema, createCategoryRoutes(), idParam (+94 more)

### Community 7 - "UserRepository"
Cohesion: 0.04
Nodes (49): RegisterDto, ForgotPasswordDto, ResetPasswordDto, EmailDomainVerifierPort, MailerPort, PasswordHasherPort, AccountDeletionUseCase, ASSIGNABLE_ADMIN_ROLES (+41 more)

### Community 8 - "test-utils.ts"
Cohesion: 0.03
Nodes (41): AccountDeletionTokenRecord, NewAccountDeletionToken, AccountErasureArtifacts, NewEmailVerificationOtp, NewPasswordResetToken, PasswordResetTokenRecord, NewRefreshToken, RefreshTokenRecord (+33 more)

### Community 9 - "ConflictError"
Cohesion: 0.05
Nodes (45): APPROVE_BENEFITS, ApproveVerifierApplicationCommand, ApproveVerifierApplicationResult, ApproveVerifierApplicationUseCase, CreateVerifierApplicationCommand, CreateVerifierApplicationUseCase, GetMyVerifierApplicationUseCase, GetVerifierApplicationDetailUseCase (+37 more)

### Community 10 - "drizzle-orm"
Cohesion: 0.09
Nodes (37): drizzle-orm, ContributionStatus, announcements, apiClients, categories, categorySuggestions, commentBlocklistWords, databaseBackupLogs (+29 more)

### Community 11 - "comment.controller.ts"
Cohesion: 0.05
Nodes (40): DeleteCommentUseCase, ListAdminCommentsUseCase, ListMyCommentsUseCase, CommentWithVotes, ListWordCommentsResult, ListWordCommentsUseCase, UncensorCommentCommand, UncensorCommentUseCase (+32 more)

### Community 12 - "create-word.use-case.ts"
Cohesion: 0.06
Nodes (46): CreateWordDto, AddExampleDto, AddMeaningDto, AddMeaningUseCase, AddPronunciationDto, AddPronunciationUseCase, AddWordImageUseCase, Actor (+38 more)

### Community 13 - "BadRequestError"
Cohesion: 0.06
Nodes (24): NewAuditLog, FacebookLoginDto, GoogleLoginDto, LoginMeta, ListAdminUsersCommand, ListAdminUsersResult, LoginResult, allocateUniqueUsername() (+16 more)

### Community 14 - "fcm-analytics.provider.ts"
Cohesion: 0.05
Nodes (50): AnalyticsProviderError, AnalyticsProviderErrorKind, FcmAnalyticsProvider, CacheEntry, ERROR_SUFFIX, errorMessage(), FCM_DATA_LAG_DAYS, GetFcmAnalyticsInput (+42 more)

### Community 15 - "wa-message.repository.impl.ts"
Cohesion: 0.06
Nodes (40): DEFAULT_WA_GROUP_CTA_URL, WaSendCommand, WaSenderPort, SendVerifierWaCommand, isValidWaPhone(), renderWaBody(), SendWaMessageCommand, SendWaMessageResult (+32 more)

### Community 16 - "ResolvedRange"
Cohesion: 0.06
Nodes (49): MobileAnalyticsProvider, AppVersionRow, CountryRow, DateRangeWire, EventRow, MobileAudience, MobileEvents, MobileOverview (+41 more)

### Community 17 - "region.repository.impl.ts"
Cohesion: 0.06
Nodes (33): assertSlug(), CreateRegionUseCase, DeleteRegionUseCase, GetRegionByIdUseCase, ListRegionsUseCase, UpdateRegionUseCase, Region, RegionStatus (+25 more)

### Community 18 - "fake-web-analytics.provider.ts"
Cohesion: 0.06
Nodes (44): SearchAnalyticsProvider, VisitorAnalyticsProvider, GetWebAnalyticsUseCase, Ga4Behavior, Ga4Sources, Ga4Visitors, QueryRow, SearchDetail (+36 more)

### Community 19 - "seed-reference.ts"
Cohesion: 0.04
Nodes (50): @hono/node-server, ulid, app, server, shutdown(), USERNAME_HANDLE_REGEX, derive(), encoder (+42 more)

### Community 20 - "zod"
Cohesion: 0.05
Nodes (49): zod, AuthRoutesDeps, createAuthRoutes(), accountDeletionMessageSchema, ConfirmAccountDeletionBody, confirmAccountDeletionSchema, DeleteOwnAccountBody, deleteOwnAccountSchema (+41 more)

### Community 21 - "WordRepository"
Cohesion: 0.04
Nodes (20): ApplyCommaSplitCommand, ApplyCommaSplitUseCase, ListAdminWordsQuery, ListAdminWordsUseCase, ListCommaSplitsUseCase, MarkCommaLiteralCommand, MarkCommaLiteralUseCase, RestoreWordUseCase (+12 more)

### Community 22 - "word.repository.ts"
Cohesion: 0.05
Nodes (46): CreateWordExampleDto, CreateWordImageDto, CreateWordMeaningDto, CreateWordRelatedDto, CreateWordTranslationDto, CreateWordVariantDto, InlineWordDto, MeaningOverrideDto (+38 more)

### Community 23 - "contribution.use-case.test.ts"
Cohesion: 0.07
Nodes (30): CorrectContributionCommand, CorrectContributionInput, CorrectContributionUseCase, ContributionDetail, GetContributionDetailUseCase, GetMyContributionDetailUseCase, ListContributionsUseCase, ListMyContributionsQuery (+22 more)

### Community 24 - "CursorPage"
Cohesion: 0.08
Nodes (33): CreateBugReportCommand, CreateBugReportUseCase, ListBugReportsUseCase, ResolveBugReportCommand, ResolveBugReportUseCase, BugReport, BugReportImage, BugReportListFilter (+25 more)

### Community 25 - "AppSettingsRepository"
Cohesion: 0.07
Nodes (31): ALLOWED, APP_SETTING_KEYS, AppSetting, AppSettingKey, AppSettingType, DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES, DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES, DEFAULT_WORD_VOTE_PUSH_COOLDOWN_MINUTES (+23 more)

### Community 26 - "user.controller.ts"
Cohesion: 0.06
Nodes (22): GetPublicActivityUseCase, PublicActivityPageResult, GetPublicProfileUseCase, PublicActivityQueryInput, MENTION_SUGGEST_LIMIT, SuggestMentionUsersUseCase, MentionUserRow, PublicActivityItem (+14 more)

### Community 27 - "AppVariables"
Cohesion: 0.06
Nodes (37): CategoryController, serialize(), CategoryRoutesDeps, composePlaceRejectDisplay(), PLACE_REJECT_REASON_CODES, PLACE_REJECT_REASON_LABELS, PlaceRejectReasonCode, PlaceContributionController (+29 more)

### Community 28 - "get-web-analytics.use-case.ts"
Cohesion: 0.07
Nodes (44): CacheEntry, ERROR_SUFFIX, errorMessage(), GetMobileAnalyticsInput, GetMobileAnalyticsUseCase, isEmpty(), MOBILE_ANALYTICS_SECTIONS, MobileAnalyticsReport (+36 more)

### Community 29 - "notification-campaign.repository.impl.ts"
Cohesion: 0.08
Nodes (25): buildCampaignPushData(), CAMPAIGN_CHUNK_SIZE, CAMPAIGN_FCM_TOPIC, CAMPAIGN_MAX_CHUNKS_PER_RUN, CampaignAudienceType, CampaignBodyType, campaignInboxAction(), CampaignRecipient (+17 more)

### Community 30 - "play-stats.provider.ts"
Cohesion: 0.08
Nodes (36): AnalyticsProviderError, PlayStatsProvider, PlayGrowth, PlayOverview, PlayRatings, findCol(), isOverviewCsv(), isRelevantPlayCsv() (+28 more)

### Community 31 - "list-share-backgrounds.use-case.ts"
Cohesion: 0.08
Nodes (35): SHARE_BACKGROUND_PROVIDER_IDS, SHARE_MEDIA_KINDS, SHARE_ORIENTATIONS, SHARE_PROVIDER_MEDIA, ShareBackgroundItem, ShareBackgroundProviderId, ShareBackgroundProviderInfo, ShareBackgroundProviderPort (+27 more)

### Community 32 - "WordRepositoryImpl"
Cohesion: 0.06
Nodes (18): WordAudioMedia, WordImageMedia, WordToSave, childStatusOf(), contributionStatusOf(), mapMediaViolation(), toContentWarnings(), toWord() (+10 more)

### Community 33 - "announcement.controller.ts"
Cohesion: 0.08
Nodes (22): announcementController, CreateAnnouncementCommand, CreateAnnouncementUseCase, DeleteAnnouncementUseCase, ListPinnedAnnouncementsUseCase, UpdateAnnouncementCommand, UpdateAnnouncementUseCase, ListAnnouncementsUseCase (+14 more)

### Community 34 - "place-category.repository.impl.ts"
Cohesion: 0.09
Nodes (19): CreatePlaceCategoryUseCase, DeletePlaceCategoryUseCase, GetPlaceCategoryUseCase, ListPlaceCategoriesUseCase, UpdatePlaceCategoryUseCase, PlaceCategoryRecord, PlaceCategoryStatus, CreatePlaceCategoryInput (+11 more)

### Community 35 - "dashboard.repository.impl.ts"
Cohesion: 0.07
Nodes (39): createTouchLastSeen(), LAST_SEEN_TOUCH_THROTTLE_MS, ONLINE_RECENTLY_WINDOW_MS, onlineRecentlySince(), GetDashboardStatsUseCase, ActivityDailyPoint, AppRoleKey, ContributionStatusKey (+31 more)

### Community 36 - "campaign.validator.ts"
Cohesion: 0.07
Nodes (36): mapCampaign(), mapTemplate(), AdminCtx, NotificationCampaignController, NotificationCampaignRoutesDeps, ALLOWED_DEEP_LINK_HOSTS, audienceTypeSchema, bodySchema (+28 more)

### Community 37 - "word-group.controller.ts"
Cohesion: 0.09
Nodes (18): AddWordGroupMemberUseCase, assertName(), CreateWordGroupUseCase, DeleteWordGroupUseCase, GetWordGroupUseCase, ListWordGroupsUseCase, RemoveWordGroupMemberUseCase, UpdateWordGroupUseCase (+10 more)

### Community 38 - "types.ts"
Cohesion: 0.06
Nodes (39): ContributionRoutesDeps, createContributionRoutes(), json(), MyContributionController, serializeMine(), createMyContributionRoutes(), json(), MyContributionRoutesDeps (+31 more)

### Community 39 - "vote.repository.impl.ts"
Cohesion: 0.06
Nodes (35): ActivityActor, ActivityKind, ActivityTarget, FeedRow, KIND_BODY, KIND_TO_WIRE, MERGED_PROFILE_KINDS, PROFILE_KIND_SETS (+27 more)

### Community 40 - "user.repository.impl.ts"
Cohesion: 0.06
Nodes (16): CreateAdminUserCommand, ListAdminUsersUseCase, ListUserAbuseEventsUseCase, SetCanContributeUseCase, allowedRolesForAdmin, UpdateUserRoleCommand, UpdateUserRoleResult, UpdateUserRoleUseCase (+8 more)

### Community 41 - "lemma-definition.mapper.ts"
Cohesion: 0.09
Nodes (27): LemmaDefinitionEntryDto, LemmaDefinitionLookupResultDto, LemmaDefinitionSenseDto, LemmaDefinitionSuggestionDto, buildNotes(), expandExamplePlaceholders(), flattenSuggestions(), mapEntry() (+19 more)

### Community 42 - "NotificationRepository"
Cohesion: 0.08
Nodes (17): GetUnreadNotificationCountUseCase, ListMyNotificationsUseCase, MarkAllNotificationsReadUseCase, MarkNotificationReadUseCase, RecordInboxNotificationCommand, InboxNotification, InboxNotificationType, NotificationActionKind (+9 more)

### Community 43 - "NotificationCampaignRepository"
Cohesion: 0.07
Nodes (15): assertDeepLink(), CancelCampaignUseCase, CreateCampaignDraftUseCase, EstimateCampaignAudienceUseCase, GetCampaignDetailUseCase, ListCampaignsUseCase, RetryFailedCampaignRecipientsUseCase, SendCampaignUseCase (+7 more)

### Community 44 - "suggestion.validator.ts"
Cohesion: 0.07
Nodes (34): CensoredSuggestion, censorSuggestionText(), ALLOWED, checkSuggestionCategoryShape(), isRevertibleForApplyPending(), Part, presentParts(), ShapeIssue (+26 more)

### Community 45 - "legal.controller.ts"
Cohesion: 0.10
Nodes (18): ArchiveLegalDocumentUseCase, CreateLegalDocumentDraftUseCase, ListAdminLegalDocumentsUseCase, PublishLegalDocumentUseCase, UpdateLegalDocumentDraftUseCase, GetAppSettingsUseCase, UpdateAppSettingsUseCase, CurrentLegalSummary (+10 more)

### Community 46 - "word.controller.ts"
Cohesion: 0.07
Nodes (30): ListDuplicateWordsUseCase, pickDefaultKeepWordId(), MergeDuplicateWordsUseCase, DuplicateWordGroup, isAllowedStockImageUrl(), isStockWordImageProvider(), resolveWordImageProvider(), STOCK_URL_HOST_SUFFIXES (+22 more)

### Community 47 - ".constructor"
Cohesion: 0.10
Nodes (19): RollbackImportSessionResult, RollbackWordImportSessionUseCase, ClaimWordImportSessionUseCase, emptyToNull(), GetWordImportSessionUseCase, ListWordImportSessionsUseCase, SaveWordImportSessionUseCase, resolveImportAttributedTo() (+11 more)

### Community 48 - "id.ts"
Cohesion: 0.07
Nodes (32): AbuseController, AdminCtx, authErrors, createAbuseRoutes(), json(), anonAbuseEventListResponseSchema, anonMuteListResponseSchema, LiftAnonMuteBody (+24 more)

### Community 49 - "quota-aware-mailer.ts"
Cohesion: 0.15
Nodes (26): accountDeletionEmailHtml(), accountDeletionEmailText(), brandedCodeEmailHtml(), brandedMessageEmailHtml(), documentShell(), emailActionHref(), escapeEmailHtml(), eyebrowRow() (+18 more)

### Community 50 - "email.repository.impl.ts"
Cohesion: 0.08
Nodes (22): EMAIL_PROVIDERS, EmailCategory, EmailLog, EmailLogStatus, EmailProvider, EmailQuotaWithUsage, EmailLogEntry, EmailLogListQuery (+14 more)

### Community 51 - "rate-limit.middleware.ts"
Cohesion: 0.08
Nodes (34): AdminBugReportRoutesDeps, createAdminBugReportRoutes(), json(), createBugReportRoutes(), json(), submitDeviceLimit, submitIpLimit, submitUserLimit (+26 more)

### Community 52 - "admin-verifier-application.routes.ts"
Cohesion: 0.08
Nodes (29): AdminVerifierApplicationRoutesDeps, createAdminVerifierApplicationRoutes(), json(), adminListVerifierApplicationsResponseSchema, adminVerifierApplicationDetailResponseSchema, approveVerifierApplicationResponseSchema, ListVerifierApplicationsQuery, listVerifierApplicationsQuerySchema (+21 more)

### Community 53 - "WordSuggestionRepositoryImpl"
Cohesion: 0.09
Nodes (23): deleteStagingWordImage(), fetchImageBytes(), PromotedWordImage, promoteWordImageFromStaging(), PromoteWordImageOptions, StagingWordImage, CensoredSuggestionFile, deleteProposedStagingImages() (+15 more)

### Community 54 - "web-analytics.entity.ts"
Cohesion: 0.11
Nodes (32): BreakdownRow, ChannelRow, EventRow, Ga4Overview, Ga4Totals, Ga4TrendPoint, LandingPageRow, PageRow (+24 more)

### Community 55 - "word-suggestion.entity.ts"
Cohesion: 0.07
Nodes (29): CATEGORY_SET, ChangeAction, CurrentMeaningSnapshot, CurrentWordSnapshot, DiffField, DiffMeaning, DiffResult, ImageAction (+21 more)

### Community 56 - "batch-contribute-words.use-case.ts"
Cohesion: 0.10
Nodes (20): canVerifyImport(), decideImportPublication(), ImportMeaningInput, ImportOutcome, ImportWordInput, ImportWordResult, meaningFingerprint(), normalizeLemma() (+12 more)

### Community 57 - "get-play-analytics.use-case.ts"
Cohesion: 0.08
Nodes (28): AnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), GetPlayAnalyticsInput, GetPlayAnalyticsUseCase, isEmpty(), PLAY_STATS_LAG_DAYS (+20 more)

### Community 58 - "place.repository.impl.ts"
Cohesion: 0.13
Nodes (24): PlaceCategory, PlaceImage, PlaceImageAttribution, PlaceRelatedCard, PlaceRelation, PlaceRelationKind, PlaceSource, PlaceStatus (+16 more)

### Community 59 - "admin-user.routes.ts"
Cohesion: 0.09
Nodes (26): AdminUsersController, AdminUserRoutesDeps, createAdminUserRoutes(), createContributionAccessRoutes(), json(), adminUserMutationResponseSchema, adminUsersListResponseSchema, adminUserWireSchema (+18 more)

### Community 60 - "ValidationError"
Cohesion: 0.08
Nodes (18): ChangePasswordDto, ChangePasswordUseCase, Password, DnsEmailDomainVerifier, DohResponse, DohStatus, DohType, RR (+10 more)

### Community 61 - "service-account-token.ts"
Cohesion: 0.10
Nodes (25): MobileAnalyticsProviderError, MobileAnalyticsProviderErrorKind, kindForStatus(), postGoogleJson(), toError(), MobileAnalyticsConfig, emptyOverview, okOverview (+17 more)

### Community 62 - "WordController"
Cohesion: 0.08
Nodes (13): ApplyCommaSplitBody, MarkCommaLiteralBody, MergeDuplicateWordsBody, ListImportSessionsQuery, SaveImportSessionBody, AddExampleBody, AddMeaningBody, AddPronunciationBody (+5 more)

### Community 63 - "discussion.validator.ts"
Cohesion: 0.08
Nodes (32): tokenIpLimit, tokenUserLimit, adminImageWireSchema, attachDiscussionAudioResponseSchema, createDiscussionBodySchema, createDiscussionReplyBodySchema, createDiscussionReplyResponseSchema, createDiscussionResponseSchema (+24 more)

### Community 64 - "create-word.validator.ts"
Cohesion: 0.09
Nodes (32): adminListWordsQuerySchema, applyCommaSplitBodySchema, applyCommaSplitResponseSchema, applyLemmaSplitBodySchema, commaSplitCandidatesResponseSchema, createWordResponseSchema, duplicateWordGroupsResponseSchema, duplicateWordItemSchema (+24 more)

### Community 65 - "publicAccountDisplayName"
Cohesion: 0.17
Nodes (16): ActivityRepositoryImpl, feedSafeUsageLabelsSql(), feedVisibleWordSql(), keysetBefore(), notMyWordVoteSql(), notSelfOrNullSql(), notSelfSql(), occurredAtSql() (+8 more)

### Community 66 - "src_shared_database_drizzle_schema_index_users"
Cohesion: 0.09
Nodes (15): AuditLogRepositoryImpl, { parsed }, USER_A, USER_B, WORD_1, ilikeCompat(), auditLogs, parseMeta() (+7 more)

### Community 67 - "SearchMissRepository"
Cohesion: 0.14
Nodes (12): ListSearchMissesUseCase, SkipSearchMissCommand, SkipSearchMissUseCase, UpdateSearchMissCommand, UpdateSearchMissUseCase, SearchMiss, SearchMissDirection, normalizeSearchMissTerm() (+4 more)

### Community 68 - "bookmark.repository.impl.ts"
Cohesion: 0.14
Nodes (14): GetMyBookmarksUseCase, ToggleBookmarkCommand, ToggleBookmarkUseCase, BookmarkItem, BookmarkListOptions, BookmarkListResult, BookmarkRepository, BookmarkWordSummary (+6 more)

### Community 69 - "admin-vote.controller.ts"
Cohesion: 0.10
Nodes (16): GetTopTargetVotesCommand, GetTopTargetVotesUseCase, ResetTargetVotesCommand, ResetTargetVotesResult, ResetTargetVotesUseCase, ToggleVoteCommand, AdminTopVoteTarget, VoteTargetType (+8 more)

### Community 70 - "record-anon-abuse-signal.use-case.ts"
Cohesion: 0.12
Nodes (13): onAnonRateLimited(), wordController, repo(), assertUgcTextQualityWithAnonStrike(), AnonClientContext, assertAnonWriteAllowed(), RecordAnonAbuseSignalCommand, RecordAnonAbuseSignalUseCase (+5 more)

### Community 71 - "update-word.use-case.ts"
Cohesion: 0.11
Nodes (20): UpdateWordDto, UpdateWordRelatedDto, UpdateWordResult, UpdateWordUseCase, DUPLICATE_LEMMA_MERGED_NOW, DUPLICATE_LEMMA_PENDING_MERGE, DUPLICATE_LEMMA_USE_TAB, Word (+12 more)

### Community 72 - "logger.ts"
Cohesion: 0.12
Nodes (17): githubTokenVerifier, githubTokenVerifierHolder, createImageStorage(), basicAuth(), hmacSha1Hex(), ImageKitStorageService, randomToken(), KAPSO_WA_DEFAULT_BASE_URL (+9 more)

### Community 73 - "CategoryRepository"
Cohesion: 0.16
Nodes (8): CreateCategoryCommand, CreateCategoryUseCase, DeleteCategoryUseCase, UpdateCategoryCommand, UpdateCategoryUseCase, ListCategoriesUseCase, Category, CategoryRepository

### Community 74 - "ContributionRepositoryImpl"
Cohesion: 0.14
Nodes (6): ApplyChildCorrectionCommand, ChildEntityWithParent, MyContributionListFilter, ReviewCommand, ContributionRepositoryImpl, decisionToStatus()

### Community 75 - "vote.repository.ts"
Cohesion: 0.13
Nodes (18): GetVoteDeckQuery, GetVoteDeckUseCase, ListAdminVotesCommand, ListAdminVotesUseCase, AdminVoteCursor, AdminVoteListFilter, AdminVoteListItem, AdminVoteListResult (+10 more)

### Community 76 - "WordDetail"
Cohesion: 0.10
Nodes (10): AddExampleUseCase, GetWordByIdUseCase, GetWordByLemmaUseCase, GetWordOfDayUseCase, wibDateString(), WordOfDayResult, wordOfDaySettingKey(), WordDetail (+2 more)

### Community 77 - "WordSummary"
Cohesion: 0.12
Nodes (15): ListWordsQuery, ListWordsUseCase, SearchWordsQuery, SearchWordsUseCase, WordSummary, decodeListCursor(), encodeListCursor(), ListAtoZParams (+7 more)

### Community 78 - "place.use-cases.ts"
Cohesion: 0.15
Nodes (14): AppendPlaceImagesUseCase, CreatePlaceUseCase, DeletePlaceUseCase, GetPlaceBySlugUseCase, ListPlaceImagesUseCase, ListPlacesUseCase, UpdatePlaceUseCase, mapImages() (+6 more)

### Community 79 - "VoteRepository"
Cohesion: 0.09
Nodes (11): DeleteAdminVoteCommand, DeleteAdminVoteResult, DeleteAdminVoteUseCase, ListMyVoteHistoryUseCase, FIRST_PARTY_SET, ResetVotesByClientCommand, ResetVotesByClientResult, ResetVotesByClientUseCase (+3 more)

### Community 80 - "ActivityEventFeedRepositoryImpl"
Cohesion: 0.13
Nodes (11): RecordActivityEventCommand, ActivityEventKind, ActivityEventFeedRepositoryImpl, cursorFromEventId(), profileCategoryOf(), quoted(), CONTRIBUTION_KIND, insertAll() (+3 more)

### Community 81 - "trigger-sqlite-backup.use-case.ts"
Cohesion: 0.13
Nodes (11): GithubActionsDispatchPort, WorkflowDispatchInput, ListDatabaseBackupLogsUseCase, BACKUP_STALE_MESSAGE, BACKUP_STALE_MS, resolveGithubToken(), TriggerSqliteBackupInput, TriggerSqliteBackupResult (+3 more)

### Community 82 - "web-import.use-cases.ts"
Cohesion: 0.12
Nodes (14): ApproveWebImportUseCase, GetWebImportUseCase, ListWebImportsUseCase, normalizeType(), PreviewWebImportUseCase, RejectWebImportUseCase, SubmitWebImportInput, SubmitWebImportResult (+6 more)

### Community 83 - "admin-api-client.use-cases.ts"
Cohesion: 0.12
Nodes (12): ALLOWED_SCOPES, assertChannels(), assertScopes(), assertStatus(), CHANNELS, CreateAdminApiClientUseCase, GetAdminApiClientUseCase, ListAdminApiClientsUseCase (+4 more)

### Community 84 - "DiscussionController"
Cohesion: 0.16
Nodes (12): DiscussionController, redactReplyAudio(), redactReplyBody(), toAdminItem(), toAdminReply(), toPublicReply(), DiscussionRoutesDeps, CreateDiscussionBody (+4 more)

### Community 85 - "user-consent.repository.impl.ts"
Cohesion: 0.18
Nodes (11): AcceptLegalUseCase, assertConsentsMatchActiveVersions(), ConsentInput, ConsentDocumentType, ConsentSource, NewUserConsent, UserConsent, DbExecutor (+3 more)

### Community 86 - "PlaceRepository"
Cohesion: 0.14
Nodes (4): assertCategory(), assertOurPlaceImage(), Place, PlaceRepository

### Community 87 - "BadGatewayError"
Cohesion: 0.18
Nodes (8): GitHubPublicImageStorageService, createPublicImageStorage(), buildJsDelivrPublicUrl(), bytesToBase64(), parseGithubRepoUrl(), GitHubPronunciationStorageService, createPronunciationStorage(), BadGatewayError

### Community 88 - "supabase-health-check.repository.impl.ts"
Cohesion: 0.13
Nodes (11): ListSupabaseHealthChecksUseCase, projectRefFromUrl(), TriggerSupabaseHealthCheckUseCase, SupabaseHealthCheck, SupabaseHealthCheckFilter, SupabaseHealthCheckPage, SupabaseHealthCheckRepository, SupabaseHealthEnv (+3 more)

### Community 89 - "web-import.repository.impl.ts"
Cohesion: 0.12
Nodes (17): NewWebImportDetail, WebImportDetail, WebImportDetailOutcome, WebImportDetailStatus, WebImportSupportType, ListWebImportDetailsInput, ListWebImportDetailsResult, ListWebImportsInput (+9 more)

### Community 90 - "web-import.controller.ts"
Cohesion: 0.15
Nodes (18): approveWebImportBodySchema, getWebImportResponseSchema, listWebImportsQuerySchema, listWebImportsResponseSchema, previewWebImportQuerySchema, previewWebImportResponseSchema, rejectWebImportBodySchema, submitWebImportBodySchema (+10 more)

### Community 91 - "bulk-words-action.use-case.ts"
Cohesion: 0.10
Nodes (13): BulkWordsAction, BulkWordsActionResult, BulkWordsActionUseCase, BulkWordsItemFailure, BulkWordsItemResult, BulkWordsItemSuccess, PUBLISH_ROLES, PublishWordUseCase (+5 more)

### Community 92 - "word-report.controller.ts"
Cohesion: 0.16
Nodes (8): ListWordReportsUseCase, FlagViolentImageReportUseCase, ResolveWordReportUseCase, WordReport, WordReportListFilter, WordReportRepository, CreateWordReportBody, ListWordReportsQuery

### Community 93 - "legal.routes.ts"
Cohesion: 0.14
Nodes (23): createAdminLegalRoutes(), createLegalAuthRoutes(), createLegalPublicRoutes(), json(), acceptLegalBodySchema, acceptLegalResponseSchema, appSettingItemSchema, appSettingsListResponseSchema (+15 more)

### Community 94 - "PlaceContributionUseCases"
Cohesion: 0.15
Nodes (6): decisionCopy(), PlaceContributionUseCases, ContributionPayload, mapRow(), PlaceContribution, PlaceContributionRepositoryImpl

### Community 95 - "resolve-word-report.use-case.ts"
Cohesion: 0.17
Nodes (15): TakedownWordCommand, TakedownReasonCode, WordReportReasonCode, normalizeTakedownNote(), CreateWordReportCommand, FlagViolentImageReportCommand, ResolveWordReportCommand, TakedownWordReportCommand (+7 more)

### Community 96 - "comment-blocklist.validator.ts"
Cohesion: 0.12
Nodes (15): BLOCKLIST_BULK_MAX, BLOCKLIST_WORD_MAX_LENGTH, normalizeBlocklistWords(), NormalizedBlocklistBatch, CommentBlocklistController, BulkCreateBlocklistBody, bulkCreateBlocklistBodySchema, bulkCreateBlocklistResponseSchema (+7 more)

### Community 97 - "activity-event.entity.ts"
Cohesion: 0.11
Nodes (9): RecordCardShareUseCase, ACTIVITY_EVENT_KINDS, ActivityEventRow, AppendActivityEventInput, ActivityEventCursor, ActivityEventRepository, AppendResult, ActivityEventRepositoryImpl (+1 more)

### Community 98 - "LanguageRepository"
Cohesion: 0.17
Nodes (7): ListDialectsUseCase, ListLanguagesUseCase, Dialect, Language, LanguageRepository, LanguageRepositoryImpl, LanguageController

### Community 99 - "notification.routes.ts"
Cohesion: 0.15
Nodes (15): NotificationController, createNotificationRoutes(), json(), NotificationRoutesDeps, inboxNotificationTypeSchema, ListNotificationsQuery, listNotificationsQuerySchema, listNotificationsResponseSchema (+7 more)

### Community 100 - "validate-image-file.ts"
Cohesion: 0.17
Nodes (18): PublicImagePurpose, UploadPublicImageResult, UploadPublicImageUseCase, buildAvatarImagePath(), buildCampaignImagePath(), buildDiscussionImagePath(), buildPlaceImagePath(), buildWordImagePath() (+10 more)

### Community 101 - "user.routes.ts"
Cohesion: 0.15
Nodes (18): createMeAvatarRoutes(), createMeProfileRoutes(), createPublicUserRoutes(), getCachedSuggest(), json(), setCachedSuggest(), suggestCache, SuggestCacheEntry (+10 more)

### Community 102 - "VoteRepositoryImpl"
Cohesion: 0.16
Nodes (7): MyVoteItem, VoteDeckListOptions, VoteDeckWord, VoteHistoryWord, VoteTarget, VoteRepositoryImpl, voteTargetKey()

### Community 103 - "vote.controller.ts"
Cohesion: 0.15
Nodes (9): GetMyVotesUseCase, SkipVoteDeckWordUseCase, SkipVoteDeckBody, ToggleVoteBody, VoteDeckQuery, VoteHistoryQuery, VoteController, VoteRoutesDeps (+1 more)

### Community 104 - "facebook-token-verifier.ts"
Cohesion: 0.16
Nodes (11): FacebookAccessTokenClaims, FACEBOOK_GRAPH_VERSION, FacebookFetch, FacebookTokenVerifier, facebookTokenVerifier, facebookTokenVerifierHolder, invalidToken(), isExpired() (+3 more)

### Community 105 - "ServiceUnavailableError"
Cohesion: 0.13
Nodes (11): GithubOauthCodeExchangerPort, GoogleIdTokenClaims, GithubOauthCodeExchanger, messageForGithubOauthError(), GOOGLE_ISSUERS, GoogleTokenVerifier, googleTokenVerifier, googleTokenVerifierHolder (+3 more)

### Community 106 - "api-client.validator.ts"
Cohesion: 0.14
Nodes (15): AdminApiClientController, AdminCtx, apiClientAdminListResponseSchema, apiClientAdminResponseSchema, apiClientAdminSchema, apiClientIdParamsSchema, channelEnum, CreateAdminApiClientBody (+7 more)

### Community 107 - "PushSenderPort"
Cohesion: 0.23
Nodes (11): PushMessage, PushSenderPort, PushSendResult, FcmPushSender, getFcmAccessToken(), NoopPushSender, pushOne(), pushTopic() (+3 more)

### Community 109 - "merge-activity.ts"
Cohesion: 0.15
Nodes (12): ListActivityInput, ListActivityPage, ListActivityUseCase, ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT, ACTIVITY_PER_KIND_CAP, ACTIVITY_PER_SOURCE, compareNewestFirst() (+4 more)

### Community 110 - "LegalController"
Cohesion: 0.15
Nodes (9): LegalController, LegalRoutesDeps, mapLegalDocumentAdmin(), mapLegalDocumentPublic(), AcceptLegalBody, CreateLegalDraftBody, ListAdminLegalQuery, PatchAppSettingsBody (+1 more)

### Community 111 - "pixabay-background.provider.ts"
Cohesion: 0.20
Nodes (15): proxyImageCdnUrl(), ALLOWED_LICENSES, buildOpenverseSearchUrl(), mapAspect(), mapOpenversePhoto(), mapOpenversePhotos(), OPENVERSE_SAFE_LICENSES, openverseLicenseLabel() (+7 more)

### Community 112 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, cleanup-tokens, dataset:export, db:backfill-activity, db:migrate, deploy, deploy:staging, dev (+12 more)

### Community 113 - "AuthController"
Cohesion: 0.12
Nodes (7): AuthController, ChangePasswordBody, ForgotPasswordBody, GoogleLinkBody, RegisterBody, ResetPasswordBody, ResendOtpBody

### Community 114 - "bookmark.routes.ts"
Cohesion: 0.18
Nodes (12): BookmarkController, BookmarkRoutesDeps, createBookmarkRoutes(), json(), bookmarkDataSchema, cursorMetaSchema, MyBookmarksQuery, myBookmarksQuerySchema (+4 more)

### Community 115 - "validate-audio-file.ts"
Cohesion: 0.17
Nodes (14): buildCommentAudioPath(), buildPronunciationAudioPath(), extensionForMime(), MIME_TO_EXT, slugifyLemma(), ALLOWED_AUDIO_MIMES, looksLikeM4a(), looksLikeMp3() (+6 more)

### Community 116 - "api-client.repository.impl.ts"
Cohesion: 0.25
Nodes (11): ApiClient, ApiClientChannel, ApiClientStatus, ApiClientListFilter, ApiClientListResult, CreateApiClientInput, UpdateApiClientInput, ApiClientRepositoryImpl (+3 more)

### Community 117 - "wa-admin.routes.ts"
Cohesion: 0.12
Nodes (19): createWaAdminRoutes(), createWaTemplateBodySchema, json(), listWaLogsQuerySchema, requireUser(), serializeTemplate(), serializeUsage(), testSendBodySchema (+11 more)

### Community 118 - "package.json"
Cohesion: 0.11
Nodes (17): description, engines, node, license, name, private, type, version (+9 more)

### Community 119 - "SmtpMailerService"
Cohesion: 0.15
Nodes (13): 1. Verifikasi file sudah benar (RED evidence dulu), 2. Verifikasi GREEN lokal, 3. Commit TERBATAS satu file (butuh go-ahead Tuan dulu), 4. Push staging + pantau CI (butuh go-ahead Tuan dulu), Architecture / pendekatan, Current context / asumsi, Fix: 29 suite e2e CI gagal — Cannot find module './smtp-mailer.service', Goal (+5 more)

### Community 120 - "review-category-suggestion.use-case.ts"
Cohesion: 0.23
Nodes (7): ProposeCategorySuggestionCommand, RejectCategorySuggestionCommand, ReviewCategorySuggestionCommand, CategorySuggestion, CategorySuggestionStatus, normalizeCategoryName(), CreateCategorySuggestionInput

### Community 121 - "CategorySuggestionRepository"
Cohesion: 0.19
Nodes (6): ListCategorySuggestionsUseCase, ProposeCategorySuggestionUseCase, ApproveCategorySuggestionUseCase, RejectCategorySuggestionUseCase, CategorySuggestionRepository, createCategorySuggestionModule()

### Community 122 - "DeviceTokenRepository"
Cohesion: 0.18
Nodes (3): RegisterDeviceTokenUseCase, RevokeDeviceTokenUseCase, DeviceTokenRepository

### Community 123 - "admin-vote.routes.ts"
Cohesion: 0.17
Nodes (17): AdminVoteRoutesDeps, createAdminVoteRoutes(), json(), adminTopTargetWireSchema, AdminVoteTargetType, adminVoteWireSchema, deleteAdminVoteParamsSchema, deleteAdminVoteResponseSchema (+9 more)

### Community 124 - "vote.routes.ts"
Cohesion: 0.18
Nodes (17): MAX_VOTE_TARGETS, myVotesResponseSchema, skipVoteDeckParamsSchema, skipVoteDeckResponseSchema, skipVoteDeckSchema, targetsQuerySchema, toggleVoteResponseSchema, toggleVoteSchema (+9 more)

### Community 125 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 126 - "activity.routes.ts"
Cohesion: 0.18
Nodes (12): ActivityController, toWire(), createActivityRoutes(), createCardShareRoutes(), json(), activityActorSchema, activityItemSchema, activityTargetSchema (+4 more)

### Community 127 - "contribution.controller.ts"
Cohesion: 0.20
Nodes (8): CensoredImageFile, ContributionController, decisionResponse(), parseApprovePayload(), serializeEntity(), approveContributionSchema, CorrectContributionBody, ListContributionsQueryBody

### Community 128 - "search-miss.routes.ts"
Cohesion: 0.18
Nodes (16): createAdminSearchMissRoutes(), createSearchMissRoutes(), json(), SearchMissRoutesDeps, adminSearchMissQuerySchema, bulkDismissItemFailureSchema, bulkDismissItemSuccessSchema, bulkDismissSearchMissBodySchema (+8 more)

### Community 129 - "database-backup-log.repository.impl.ts"
Cohesion: 0.20
Nodes (9): CreateDatabaseBackupLogInput, DatabaseBackupLog, DatabaseBackupLogFilter, DatabaseBackupLogPage, DatabaseBackupLogStatus, DatabaseBackupTriggerSource, ACTIVE_STATUSES, DatabaseBackupLogRepositoryImpl (+1 more)

### Community 130 - "word-media.routes.ts"
Cohesion: 0.20
Nodes (16): addExampleResponseSchema, addExampleSchema, addMeaningResponseSchema, addMeaningSchema, addPronunciationResponseSchema, addPronunciationSchema, addWordImageResponseSchema, addWordImageSchema (+8 more)

### Community 131 - "jwt-token.service.ts"
Cohesion: 0.18
Nodes (10): jose, authenticate, optionalAuthenticate, softAuthenticate, AccessTokenPayload, JwtTokenService, JwtTokenServiceOptions, normalizeRoleClaims() (+2 more)

### Community 132 - "category-suggestion.controller.ts"
Cohesion: 0.18
Nodes (12): CategorySuggestionController, toApi(), ListCategorySuggestionsQuery, ListCategorySuggestionsQueryDTO, ListCategorySuggestionsQuerySchema, ProposeCategorySuggestionBody, ProposeCategorySuggestionDTO, ProposeCategorySuggestionSchema (+4 more)

### Community 133 - "ApiClientRepository"
Cohesion: 0.19
Nodes (7): ResolvedFirstPartyClient, ResolveFirstPartyClientInput, ResolveFirstPartyClientUseCase, FIRST_PARTY_CLIENT_IDS, FIRST_PARTY_SCOPE_STRING, FirstPartyScope, ApiClientRepository

### Community 134 - "DiscussionRepositoryImpl"
Cohesion: 0.18
Nodes (6): decodePopularDiscussionCursor(), DiscussionRepositoryImpl, encodePopularDiscussionCursor(), toDiscussion(), toDiscussionAudio(), toImageRows()

### Community 135 - "word-report.validator.ts"
Cohesion: 0.12
Nodes (15): TAKEDOWN_REASON_CODES, WORD_REPORT_REASON_CODES, createWordReportBodySchema, createWordReportResponseSchema, listWordReportsQuerySchema, noteSchema, resolveWordReportBodySchema, takedownReasonCodeSchema (+7 more)

### Community 136 - "update-word.validator.ts"
Cohesion: 0.13
Nodes (13): createWordBodySchema, relationTypeSchema, ulid, wordDetailResponseSchema, wordStatusSchema, wordTypeSchema, adminWordDetailResponseSchema, UpdateWordBody (+5 more)

### Community 137 - "CommentBlocklistWord"
Cohesion: 0.21
Nodes (3): CommentBlocklistWord, CommentBlocklistRepositoryImpl, wordContains()

### Community 138 - "device.routes.ts"
Cohesion: 0.25
Nodes (9): DeviceController, createDeviceRoutes(), DeviceRoutesDeps, json(), deviceTokenMutationResponseSchema, RegisterDeviceTokenBody, registerDeviceTokenSchema, RevokeDeviceTokenBody (+1 more)

### Community 139 - "system-supabase.routes.ts"
Cohesion: 0.21
Nodes (11): AdminCtx, SystemSupabaseController, toWire(), createSystemSupabaseRoutes(), json(), SystemSupabaseRoutesDeps, healthCheckItemSchema, ListSupabaseHealthChecksQuery (+3 more)

### Community 140 - "SambasKu-API"
Cohesion: 0.13
Nodes (14): Akses Database, Alur record (DB + asset), Audio pelafalan (GitHub asset repo), Cloudflare Workers (deploy), Command Sehari-hari, Database (tanpa Docker), Database test (integration & e2e), Deploy otomatis dari GitHub (CI/CD) (+6 more)

### Community 141 - "ActivityItem"
Cohesion: 0.31
Nodes (3): ActivityItem, ActivityCursor, ActivityRepository

### Community 142 - "ReviewPushCooldownGate"
Cohesion: 0.16
Nodes (7): makePushCooldownGate(), parseCooldownMinutes(), log(), parseCooldownMinutes(), ReviewPushCooldownGate, log(), parseCooldownMinutes()

### Community 143 - "search-miss.controller.ts"
Cohesion: 0.22
Nodes (7): SearchMissController, toApi(), AdminSearchMissQueryBody, BulkDismissSearchMissBody, PublicSearchMissQueryBody, ResolveSearchMissBody, UpdateSearchMissBody

### Community 144 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, dotenv, drizzle-orm, hono, @hono/node-server, @hono/zod-openapi, jose, @libsql/client (+6 more)

### Community 145 - "@libsql/client"
Cohesion: 0.23
Nodes (6): @libsql/client, SearchIndexHit, WordSearchIndex, FtsWordSearchIndex, env(), main()

### Community 147 - "announcement.routes.ts"
Cohesion: 0.22
Nodes (11): AnnouncementRoutesDeps, createAdminAnnouncementRoutes(), createPublicAnnouncementRoutes(), json(), announcementItemResponseSchema, announcementItemSchema, announcementListResponseSchema, bodyTypeSchema (+3 more)

### Community 148 - "UserSkipRepository"
Cohesion: 0.23
Nodes (3): SkipContributionUseCase, makeDeps(), UserSkipRepository

### Community 149 - "toOwnerItem"
Cohesion: 0.16
Nodes (9): isVerifierRole(), redactDiscussionAudio(), toAdminImages(), toOwnerImages(), toOwnerItem(), toPublicImages(), toPublicItem(), ListDiscussionsQuery (+1 more)

### Community 151 - "LegalDocument"
Cohesion: 0.33
Nodes (4): LegalDocument, LegalDocumentListResult, LegalDocumentRepositoryImpl, toEntity()

### Community 152 - "place.validator.ts"
Cohesion: 0.14
Nodes (12): attributionSchema, imageSchema, placeCategorySchema, placeImageResponseSchema, placeItemResponseSchema, placeListResponseSchema, placeRelationSchema, placeStatusSchema (+4 more)

### Community 153 - "mailer.factory.ts"
Cohesion: 0.24
Nodes (6): CreateMailerEmailDeps, EmailSenderPort, EmailSendPayload, EmailSendResult, EmailRoutingEntry, ResendEmailSender

### Community 154 - "SearchMissRepositoryImpl"
Cohesion: 0.27
Nodes (3): SearchMissUpdatePatch, normalizeTerm, SearchMissRepositoryImpl

### Community 155 - "word-report.use-case.test.ts"
Cohesion: 0.21
Nodes (6): CloseOpenWordReports, TakedownWordUseCase, CreateWordReportUseCase, TakedownWordReportUseCase, make(), publishedWord()

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

### Community 160 - ".loginJson"
Cohesion: 0.21
Nodes (5): FacebookLoginBody, GoogleLoginBody, LoginBody, resolveLoginIdentifier(), VerifyEmailBody

### Community 161 - "ToggleVoteUseCase"
Cohesion: 0.21
Nodes (4): ToggleVoteUseCase, wordVoteBody(), makeDeps(), TARGET

### Community 162 - "place-category.routes.ts"
Cohesion: 0.27
Nodes (10): createAdminPlaceCategoryRoutes(), createPublicPlaceCategoryRoutes(), json(), createPlaceCategoryBodySchema, idSchema, placeCategoryIdQuerySchema, placeCategoryItemResponseSchema, placeCategoryListResponseSchema (+2 more)

### Community 163 - "get-vote-counts.use-case.ts"
Cohesion: 0.21
Nodes (8): GetVoteCountsUseCase, VoteCountItem, ToggleVoteResult, VoteCounts, makeDeps(), MEANING, PRON, WORD

### Community 164 - "createWordSchema"
Cohesion: 0.23
Nodes (10): createWordSchema, refineMeaningPadanan(), variantRootRefine(), build(), FORM_A, FORM_B, ULID(), build() (+2 more)

### Community 165 - ".github"
Cohesion: 0.18
Nodes (7): Alur record (DB + asset), Endpoint ringkas, Env (lokal / Workers), Gambar publik (GitHub asset repo), GithubLinkBody, GithubLoginBody, SetPasswordBody

### Community 166 - "bulk-dismiss-search-miss.use-case.ts"
Cohesion: 0.24
Nodes (8): BulkDismissSearchMissCommand, BulkDismissSearchMissItemFailure, BulkDismissSearchMissItemResult, BulkDismissSearchMissItemSuccess, BulkDismissSearchMissResult, BulkDismissSearchMissUseCase, SEARCH_MISS_BULK_DISMISS_MAX, makeUseCase()

### Community 168 - "refresh-cookie.ts"
Cohesion: 0.29
Nodes (6): getAllCookieValues(), clearRefreshCookieVariants(), currentRefreshCookieScope(), REFRESH_COOKIE_PATH, REFRESH_TOKEN_COOKIE, setRefreshTokenCookie()

### Community 169 - "language.routes.ts"
Cohesion: 0.36
Nodes (8): createDialectRoutes(), createLanguageRoutes(), json(), dialectListResponseSchema, errorSchema, languageListResponseSchema, listDialectsQuerySchema, listLanguagesQuerySchema

### Community 170 - "resolve-search-miss.use-case.ts"
Cohesion: 0.22
Nodes (7): ResolveSearchMissAction, ResolveSearchMissCommand, ResolveSearchMissResult, ResolveSearchMissUseCase, missLemma, missTranslation, publishedWord

### Community 171 - "import-session.validator.ts"
Cohesion: 0.20
Nodes (8): ClaimImportSessionBody, claimImportSessionBodySchema, importSessionItemSchema, importSessionResponseSchema, listImportSessionsQuerySchema, rollbackImportSessionResponseSchema, saveImportSessionBodySchema, supportTypeSchema

### Community 174 - "lookup-lemma-definition.validator.ts"
Cohesion: 0.25
Nodes (7): KBBI_PROVIDER_IDS, KbbiProviderId, entrySchema, lookupLemmaDefinitionQuerySchema, lookupLemmaDefinitionResponseSchema, senseSchema, suggestionSchema

### Community 175 - "bulk-words.validator.ts"
Cohesion: 0.22
Nodes (7): WORDS_BULK_MAX, bulkItemFailureSchema, bulkItemSuccessSchema, bulkWordsActionSchema, BulkWordsBody, bulkWordsBodySchema, bulkWordsResponseSchema

### Community 176 - "github-token-verifier.ts"
Cohesion: 0.32
Nodes (5): GithubUserClaims, GhEmail, GhUser, GithubTokenVerifier, INVALID()

### Community 178 - "web-analytics.validator.ts"
Cohesion: 0.25
Nodes (6): WEB_ANALYTICS_SECTIONS, dateRangeSchema, providerResultSchema, webAnalyticsParamsSchema, webAnalyticsQuerySchema, webAnalyticsResponseSchema

### Community 179 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, drizzle-kit, @types/node, @types/nodemailer, typescript, vitest, wrangler

### Community 181 - "require-approved-client.middleware.ts"
Cohesion: 0.38
Nodes (6): createRequireApprovedClientMiddleware(), deny(), hasScope(), JsonStatus, RequireApprovedClientOptions, makeApp()

### Community 182 - "worker.ts"
Cohesion: 0.43
Nodes (6): AppModule, bootstrap(), Env, fetch(), loadApp(), scheduled()

### Community 183 - "createDiscussionRoutes"
Cohesion: 0.47
Nodes (6): createDiscussionRoutes(), json(), replyAudioUserLimit(), replyUserLimit(), submitUserLimit(), ugcRateLimitedHook()

### Community 184 - "NotificationPushCooldownRepositoryImpl"
Cohesion: 0.40
Nodes (3): NotificationPushCooldown, NotificationPushCooldownChannel, NotificationPushCooldownRepositoryImpl

### Community 185 - "map-word-image-url.ts"
Cohesion: 0.60
Nodes (3): mapPublicWordImageUrl(), WordImageUrlFields, PENDING_WORD_IMAGE_PLACEHOLDER_URL

### Community 187 - "share-query-denylist.ts"
Cohesion: 0.60
Nodes (3): BLOCKED_TERMS, isBlockedShareQuery(), normalizeQuery()

## Knowledge Gaps
- **1077 isolated node(s):** `imports`, `name`, `version`, `description`, `license` (+1072 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1440 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `app-error.ts`, `word.repository.impl.ts`, `UnauthorizedError`, `create-comment-audio.use-case.ts`, `createOpenApiApp`, `UserRepository`, `test-utils.ts`, `ConflictError`, `create-word.use-case.ts`, `BadRequestError`, `fcm-analytics.provider.ts`, `wa-message.repository.impl.ts`, `fake-web-analytics.provider.ts`, `seed-reference.ts`, `WordRepository`, `word.repository.ts`, `contribution.use-case.test.ts`, `CursorPage`, `AppSettingsRepository`, `user.controller.ts`, `get-web-analytics.use-case.ts`, `notification-campaign.repository.impl.ts`, `play-stats.provider.ts`, `list-share-backgrounds.use-case.ts`, `WordRepositoryImpl`, `dashboard.repository.impl.ts`, `campaign.validator.ts`, `types.ts`, `vote.repository.impl.ts`, `lemma-definition.mapper.ts`, `suggestion.validator.ts`, `legal.controller.ts`, `word.controller.ts`, `.constructor`, `id.ts`, `quota-aware-mailer.ts`, `admin-verifier-application.routes.ts`, `WordSuggestionRepositoryImpl`, `batch-contribute-words.use-case.ts`, `get-play-analytics.use-case.ts`, `admin-user.routes.ts`, `ValidationError`, `service-account-token.ts`, `src_shared_database_drizzle_schema_index_users`, `SearchMissRepository`, `bookmark.repository.impl.ts`, `record-anon-abuse-signal.use-case.ts`, `update-word.use-case.ts`, `logger.ts`, `vote.repository.ts`, `WordDetail`, `WordSummary`, `supabase-health-check.repository.impl.ts`, `bulk-words-action.use-case.ts`, `resolve-word-report.use-case.ts`, `comment-blocklist.validator.ts`, `user.routes.ts`, `vote.controller.ts`, `facebook-token-verifier.ts`, `ServiceUnavailableError`, `merge-activity.ts`, `pixabay-background.provider.ts`, `validate-audio-file.ts`, `package.json`, `DeviceTokenRepository`, `jwt-token.service.ts`, `ApiClientRepository`, `update-word.validator.ts`, `UserSkipRepository`, `word-report.use-case.test.ts`, `ToggleVoteUseCase`, `get-vote-counts.use-case.ts`, `createWordSchema`, `bulk-dismiss-search-miss.use-case.ts`, `refresh-cookie.ts`, `resolve-search-miss.use-case.ts`, `map-word-image-url.ts`, `.assertNotBrowserBodyChannel`, `share-query-denylist.ts`, `query-boolean.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `zod` connect `zod` to `search-miss.routes.ts`, `word-media.routes.ts`, `app.ts`, `category-suggestion.controller.ts`, `createOpenApiApp`, `word-report.validator.ts`, `update-word.validator.ts`, `device.routes.ts`, `comment.controller.ts`, `fcm-analytics.provider.ts`, `region.repository.impl.ts`, `fake-web-analytics.provider.ts`, `announcement.routes.ts`, `place.validator.ts`, `AppVariables`, `get-web-analytics.use-case.ts`, `audit.routes.ts`, `list-share-backgrounds.use-case.ts`, `place-category.repository.impl.ts`, `place-category.routes.ts`, `campaign.validator.ts`, `word-group.controller.ts`, `types.ts`, `language.routes.ts`, `import-session.validator.ts`, `suggestion.validator.ts`, `lookup-lemma-definition.validator.ts`, `word.controller.ts`, `id.ts`, `bulk-words.validator.ts`, `web-analytics.validator.ts`, `rate-limit.middleware.ts`, `admin-verifier-application.routes.ts`, `get-play-analytics.use-case.ts`, `admin-user.routes.ts`, `ValidationError`, `query-boolean.ts`, `discussion.validator.ts`, `create-word.validator.ts`, `logger.ts`, `place.use-cases.ts`, `web-import.controller.ts`, `legal.routes.ts`, `comment-blocklist.validator.ts`, `notification.routes.ts`, `user.routes.ts`, `api-client.validator.ts`, `bookmark.routes.ts`, `wa-admin.routes.ts`, `package.json`, `admin-vote.routes.ts`, `vote.routes.ts`, `activity.routes.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `ValidationError` connect `ValidationError` to `app-error.ts`, `word.repository.impl.ts`, `UnauthorizedError`, `create-comment-audio.use-case.ts`, `UserRepository`, `create-word.use-case.ts`, `BadRequestError`, `fcm-analytics.provider.ts`, `.execute`, `fake-web-analytics.provider.ts`, `toOwnerItem`, `WordRepository`, `contribution.use-case.test.ts`, `CursorPage`, `word.repository.ts`, `word-report.use-case.test.ts`, `get-web-analytics.use-case.ts`, `list-share-backgrounds.use-case.ts`, `WordRepositoryImpl`, `ToggleVoteUseCase`, `word-group.controller.ts`, `lemma-definition.mapper.ts`, `resolve-search-miss.use-case.ts`, `suggestion.validator.ts`, `WordSuggestionRepositoryImpl`, `get-play-analytics.use-case.ts`, `SearchMissRepository`, `update-word.use-case.ts`, `vote.repository.ts`, `WordDetail`, `WordSummary`, `word-report.controller.ts`, `resolve-word-report.use-case.ts`, `LanguageRepository`, `merge-activity.ts`, `contribution.controller.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `imports`, `name`, `version` to the rest of the system?**
  _1077 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `vitest` be split into smaller, more focused modules?**
  _Cohesion score 0.021212779830471637 - nodes in this community are weakly interconnected._
- **Should `app-error.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.029286649214659687 - nodes in this community are weakly interconnected._
- **Should `word.repository.impl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.027427775844065437 - nodes in this community are weakly interconnected._