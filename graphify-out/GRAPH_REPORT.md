# Graph Report - api  (2026-10-24)

## Corpus Check
- 1177 files · ~593,608 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .mdc 4, (none) 3, .example 2)

## Summary
- 7466 nodes · 24672 edges · 190 communities (168 shown, 22 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 1079 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dcc90bf7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vitest
- discussion.controller.ts
- word.repository.impl.ts
- set-password.use-case.ts
- app.ts
- .record
- createOpenApiApp
- account-deletion.use-case.ts
- test-utils.ts
- VerifierApplication
- drizzle-orm
- comment.controller.ts
- WordRepository
- .findById
- fcm-analytics.provider.ts
- wa-message.repository.impl.ts
- ResolvedRange
- RegionRepository
- web-analytics.entity.ts
- seed-reference.ts
- UnauthorizedError
- word.repository.ts
- .saveWithInlineRelations
- contribution.use-case.test.ts
- bug-report.repository.impl.ts
- app-setting.entity.ts
- user.controller.ts
- achievement.routes.ts
- get-web-analytics.use-case.ts
- notification-campaign.repository.impl.ts
- play-stats.provider.ts
- list-share-backgrounds.use-case.ts
- WordRepositoryImpl
- announcement.controller.ts
- place-category.repository.impl.ts
- dashboard.repository.impl.ts
- campaign.validator.ts
- word-group.repository.impl.ts
- contribution.validator.ts
- EventRepository
- event.repository.impl.ts
- lemma-definition.mapper.ts
- NotificationRepository
- NotificationCampaignRepository
- suggestion.validator.ts
- legal-document.repository.impl.ts
- map-create-word.ts
- word-import-session.use-cases.ts
- UgcAbuseEventRepository
- quota-aware-mailer.ts
- email.repository.impl.ts
- rate-limit.middleware.ts
- admin-verifier-application.routes.ts
- BadRequestError
- ga4.provider.ts
- word-suggestion.entity.ts
- import-words.use-case.ts
- get-play-analytics.use-case.ts
- place.repository.impl.ts
- zod
- register-user.use-case.test.ts
- service-account-token.ts
- WordController
- discussion.validator.ts
- create-word.validator.ts
- publicAccountDisplayName
- ugc-abuse-event.repository.ts
- SearchMissRepository
- bookmark.repository.impl.ts
- admin-vote.controller.ts
- UgcAnonAbuseRepository
- UserRepository
- logger.ts
- AppVariables
- ContributionRepositoryImpl
- vote.repository.ts
- id.ts
- ilikeCompat
- place.controller.ts
- VoteRepository
- ActivityEventFeedRepositoryImpl
- DatabaseBackupLogRepository
- web-import.repository.impl.ts
- ApiClientRepository
- DiscussionController
- login-with-facebook.use-case.ts
- PlaceRepository
- event-contribution.use-cases.ts
- system-supabase.controller.ts
- event.routes.ts
- region.repository.impl.ts
- bulk-words-action.use-case.ts
- AchievementRepository
- get-mobile-analytics.use-case.ts
- place-contribution.use-cases.ts
- word.entity.ts
- admin-comment-blocklist.routes.ts
- ActivityEventKind
- LanguageRepository
- notification.routes.ts
- PublicImageStoragePort
- user.routes.ts
- VoteRepositoryImpl
- resolve-import-attribution.ts
- auth.e2e.test.ts
- WordDetail
- admin-api-client.routes.ts
- PushSenderPort
- .processSelectedAudience
- merge-activity.ts
- legal.controller.ts
- place-contribution.routes.ts
- scripts
- Place
- bookmark.routes.ts
- ugc-anon-abuse.repository.ts
- auth-identity.repository.impl.ts
- wa-admin.routes.ts
- package.json
- mailer.factory.ts
- .execute
- word-media.routes.ts
- DeviceTokenRepository
- admin-vote.routes.ts
- vote.routes.ts
- compilerOptions
- activity.routes.ts
- promote-word-image-staging.ts
- search-miss.routes.ts
- AchievementRepositoryImpl
- send-verifier-wa.use-case.ts
- RefreshTokenRepository
- category-suggestion.routes.ts
- ActivityItem
- database-backup-log.repository.ts
- hono
- vote.controller.ts
- CommentBlocklistWord
- dependencies
- system-database.routes.ts
- SambasKu-API
- achievement-registry.ts
- review-push-cooldown-gate.ts
- ToggleVoteUseCase
- suggestion-category-shape.ts
- fts-word-search-index.ts
- normalize-blocklist-words.ts
- devDependencies
- UserSkipRepository
- .listLatest
- WordImageMedia
- upload-pronunciation-audio.use-case.test.ts
- migrate-place-ids.ts
- backfill-user-consents.ts
- SearchMissRepositoryImpl
- list-audit-logs.use-case.ts
- audit.routes.ts
- achievement.repository.impl.ts
- get-vote-counts.use-case.ts
- create-word.validator.test.ts
- list-admin-votes.use-case.ts
- app-error.ts
- import-session.validator.ts
- run-due-achievement-scan.use-case.ts
- scan-achievement.test.ts
- bulk-words.validator.ts
- refresh-token.repository.impl.ts
- worker.ts
- AppSettingsRepository
- map-word-image-url.ts
- UgcAnonAbuseRepositoryImpl
- query-boolean.ts
- deno.json
- ERROR_CODES.md
- ports/README.md
- batch-contribute-words.use-case.ts
- import-words.validator.ts
- isUniqueViolation
- GetAppSettingsUseCase
- meaning-source.validator.test.ts
- selectChain
- ListLatestWordsQueryBody
- record-supabase-health.ts

## God Nodes (most connected - your core abstractions)
1. `NotFoundError` - 268 edges
2. `AppVariables` - 225 edges
3. `AuditLogRepository` - 224 edges
4. `vitest` - 218 edges
5. `drizzle-orm` - 198 edges
6. `generateId()` - 170 edges
7. `WordRepository` - 155 edges
8. `ConflictError` - 155 edges
9. `createOpenApiApp()` - 148 edges
10. `rateLimit()` - 144 edges

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

## Communities (190 total, 22 thin omitted)

### Community 0 - "vitest"
Cohesion: 0.02
Nodes (138): dotenv, @libsql/client, vitest, { parsed }, { parsed }, { parsed }, { parsed }, { parsed } (+130 more)

### Community 1 - "discussion.controller.ts"
Cohesion: 0.04
Nodes (67): ApproveDiscussionCommand, ApproveDiscussionUseCase, fetchImageBytes(), normalizeApproveImageContentWarnings(), AttachDiscussionAudioCommand, AttachDiscussionAudioUseCase, CreateDiscussionCommand, CreateDiscussionUseCase (+59 more)

### Community 2 - "word.repository.impl.ts"
Cohesion: 0.03
Nodes (124): ActivityKind, FeedRow, KIND_BODY, KIND_TO_WIRE, MERGED_PROFILE_KINDS, PROFILE_KIND_SETS, ProfileCategory, CONTRIB_BODY (+116 more)

### Community 3 - "set-password.use-case.ts"
Cohesion: 0.06
Nodes (30): SetPasswordDto, SetPasswordProvider, GithubTokenVerifierPort, GithubUserClaims, GoogleIdTokenClaims, GoogleTokenVerifierPort, LinkGithubAccountUseCase, UnlinkGithubAccountUseCase (+22 more)

### Community 4 - "app.ts"
Cohesion: 0.01
Nodes (165): abuseController, accountDeletion, achievementRepo, activityController, activityEventFeedRepo, activityEventRepo, activityEvents, activityRepo (+157 more)

### Community 5 - ".record"
Cohesion: 0.05
Nodes (46): onAnonRateLimited(), CreateCommentAudioCommand, CreateCommentAudioUseCase, truncateSnippet(), wordCommentBody(), wordCommentBody(), buildCommentAudioPath(), applyBlocklistFilter() (+38 more)

### Community 6 - "createOpenApiApp"
Cohesion: 0.04
Nodes (101): @hono/zod-openapi, createAdminAchievementRoutes(), createMyAchievementRoutes(), createMyProfileBorderRoutes(), createPublicAchievementRoutes(), json(), AnnouncementRoutesDeps, createAdminAnnouncementRoutes() (+93 more)

### Community 7 - "account-deletion.use-case.ts"
Cohesion: 0.06
Nodes (34): ForgotPasswordDto, ResetPasswordDto, MailerPort, PasswordHasherPort, AccountDeletionUseCase, ForgotPasswordUseCase, OAUTH_PROVIDER_LABEL, ResetPasswordUseCase (+26 more)

### Community 8 - "test-utils.ts"
Cohesion: 0.03
Nodes (39): AccountDeletionTokenRecord, NewAccountDeletionToken, NewPasswordResetToken, PasswordResetTokenRecord, AccountDeletionTokenRepositoryImpl, PasswordResetTokenRepositoryImpl, BM_BARU, BM_DEP (+31 more)

### Community 9 - "VerifierApplication"
Cohesion: 0.06
Nodes (33): CreateVerifierApplicationCommand, CreateVerifierApplicationUseCase, GetMyVerifierApplicationUseCase, GetVerifierApplicationDetailUseCase, ListVerifierApplicationsUseCase, ResubmitVerifierApplicationCommand, ResubmitVerifierApplicationUseCase, UpdateVerifierApplicationScreenshotUseCase (+25 more)

### Community 10 - "drizzle-orm"
Cohesion: 0.07
Nodes (45): drizzle-orm, Row, ContributionStatus, ACTIVE_STATUSES, ACHIEVEMENT_GRANTED_VIA, achievementCriteriaSql, achievements, userAchievements (+37 more)

### Community 11 - "comment.controller.ts"
Cohesion: 0.05
Nodes (39): ListAdminCommentsUseCase, ListMyCommentsUseCase, CommentWithVotes, ListWordCommentsResult, ListWordCommentsUseCase, UncensorCommentCommand, UncensorCommentUseCase, Comment (+31 more)

### Community 12 - "WordRepository"
Cohesion: 0.02
Nodes (94): CorrectContributionCommand, CorrectContributionUseCase, ReviewOutcome, CreateWordDto, UpdateWordDto, UpdateWordRelatedDto, AddExampleDto, AddExampleUseCase (+86 more)

### Community 13 - ".findById"
Cohesion: 0.16
Nodes (6): LoginMeta, LoginWithFacebookUseCase, LoginWithGithubUseCase, LoginWithGoogleUseCase, issueLoginSession(), LoginResult

### Community 14 - "fcm-analytics.provider.ts"
Cohesion: 0.05
Nodes (51): AnalyticsProviderError, AnalyticsProviderErrorKind, FcmAnalyticsProvider, CacheEntry, ERROR_SUFFIX, errorMessage(), FCM_DATA_LAG_DAYS, GetFcmAnalyticsInput (+43 more)

### Community 15 - "wa-message.repository.impl.ts"
Cohesion: 0.06
Nodes (36): DEFAULT_WA_GROUP_CTA_URL, WaSendCommand, WaSenderPort, isValidWaPhone(), renderWaBody(), SendWaMessageUseCase, toPositionalParams(), WaSenderPortWithConfigured (+28 more)

### Community 16 - "ResolvedRange"
Cohesion: 0.06
Nodes (55): MobileAnalyticsProvider, MobileAnalyticsProviderError, AppVersionRow, CountryRow, DateRangeWire, EventRow, MobileAudience, MobileEvents (+47 more)

### Community 17 - "RegionRepository"
Cohesion: 0.08
Nodes (21): CreateRegionUseCase, DeleteRegionUseCase, GetRegionByIdUseCase, ListRegionsUseCase, UpdateRegionUseCase, RegionRepository, RegionController, serialize() (+13 more)

### Community 18 - "web-analytics.entity.ts"
Cohesion: 0.05
Nodes (57): SearchAnalyticsProvider, VisitorAnalyticsProvider, GetWebAnalyticsUseCase, BreakdownRow, ChannelRow, EventRow, Ga4Behavior, Ga4Overview (+49 more)

### Community 19 - "seed-reference.ts"
Cohesion: 0.05
Nodes (47): ulid, derive(), encoder, fromB64(), Pbkdf2PasswordService, randomBytes(), timingSafeEqual(), toB64() (+39 more)

### Community 20 - "UnauthorizedError"
Cohesion: 0.03
Nodes (69): GithubOauthCodeExchangerPort, invalidFacebookToken(), invalidGithubToken(), invalidGoogleToken(), GithubOauthCodeExchanger, messageForGithubOauthError(), AuthController, getAllCookieValues() (+61 more)

### Community 21 - "word.repository.ts"
Cohesion: 0.05
Nodes (43): CreateWordExampleDto, CreateWordImageDto, CreateWordMeaningDto, CreateWordRelatedDto, CreateWordTranslationDto, CreateWordVariantDto, InlineWordDto, MeaningOverrideDto (+35 more)

### Community 22 - ".saveWithInlineRelations"
Cohesion: 0.26
Nodes (6): WordToSave, childStatusOf(), contributionStatusOf(), toPronunciation(), toWord(), verificationCols()

### Community 23 - "contribution.use-case.test.ts"
Cohesion: 0.08
Nodes (28): CorrectContributionInput, ContributionDetail, GetContributionDetailUseCase, GetMyContributionDetailUseCase, ListContributionsUseCase, ListMyContributionsQuery, ListMyContributionsUseCase, ReopenContributionUseCase (+20 more)

### Community 24 - "bug-report.repository.impl.ts"
Cohesion: 0.11
Nodes (23): CreateBugReportCommand, CreateBugReportUseCase, ListBugReportsUseCase, ResolveBugReportCommand, ResolveBugReportUseCase, BugReport, BugReportImage, BugReportListFilter (+15 more)

### Community 25 - "app-setting.entity.ts"
Cohesion: 0.11
Nodes (17): ALLOWED, UpdateAppSettingsUseCase, APP_SETTING_KEYS, AppSetting, AppSettingKey, AppSettingType, DEFAULT_OAUTH_CONSENT_ENFORCEMENT, LEGAL_OAUTH_CONSENT_ENFORCEMENT_KEY (+9 more)

### Community 26 - "user.controller.ts"
Cohesion: 0.06
Nodes (25): achievementController, GetPublicActivityUseCase, PublicActivityPageResult, GetPublicProfileUseCase, PublicActivityQueryInput, MENTION_SUGGEST_LIMIT, SuggestMentionUsersUseCase, MentionUserRow (+17 more)

### Community 27 - "achievement.routes.ts"
Cohesion: 0.09
Nodes (27): AchievementController, serializeAchievement(), AchievementRoutesDeps, idParam, achievementAdminListResponseSchema, achievementBorderResponseSchema, achievementCodeSchema, achievementCriteriaSchema (+19 more)

### Community 28 - "get-web-analytics.use-case.ts"
Cohesion: 0.15
Nodes (21): AnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), isGa4Empty(), isSearchEmpty(), PROVIDER_COPY, ProviderKey (+13 more)

### Community 29 - "notification-campaign.repository.impl.ts"
Cohesion: 0.08
Nodes (25): buildCampaignPushData(), CAMPAIGN_CHUNK_SIZE, CAMPAIGN_FCM_TOPIC, CAMPAIGN_MAX_CHUNKS_PER_RUN, CampaignAudienceType, CampaignBodyType, campaignInboxAction(), CampaignRecipient (+17 more)

### Community 30 - "play-stats.provider.ts"
Cohesion: 0.07
Nodes (44): AnalyticsProviderError, PlayStatsProvider, PlayCountryRow, PlayGrowth, PlayOverview, PlayProviderStatus, PlayRatingBucket, PlayRatings (+36 more)

### Community 31 - "list-share-backgrounds.use-case.ts"
Cohesion: 0.06
Nodes (55): SHARE_BACKGROUND_PROVIDER_IDS, SHARE_MEDIA_KINDS, SHARE_ORIENTATIONS, SHARE_PROVIDER_MEDIA, ShareBackgroundItem, ShareBackgroundProviderId, ShareBackgroundProviderInfo, ShareBackgroundProviderPort (+47 more)

### Community 33 - "announcement.controller.ts"
Cohesion: 0.10
Nodes (16): ListPinnedAnnouncementsUseCase, UpdateAnnouncementCommand, ListAnnouncementsUseCase, Announcement, ANNOUNCEMENT_EVENT_KIND, AnnouncementBodyType, AnnouncementRow, AnnouncementRepository (+8 more)

### Community 34 - "place-category.repository.impl.ts"
Cohesion: 0.09
Nodes (18): CreatePlaceCategoryUseCase, DeletePlaceCategoryUseCase, GetPlaceCategoryUseCase, ListPlaceCategoriesUseCase, UpdatePlaceCategoryUseCase, PlaceCategoryRecord, PlaceCategoryStatus, CreatePlaceCategoryInput (+10 more)

### Community 35 - "dashboard.repository.impl.ts"
Cohesion: 0.06
Nodes (44): NewAuditLog, AuditLogRepositoryImpl, { parsed }, USER_A, USER_B, WORD_1, LAST_SEEN_TOUCH_THROTTLE_MS, ONLINE_RECENTLY_WINDOW_MS (+36 more)

### Community 36 - "campaign.validator.ts"
Cohesion: 0.07
Nodes (36): mapCampaign(), mapTemplate(), AdminCtx, NotificationCampaignController, NotificationCampaignRoutesDeps, ALLOWED_DEEP_LINK_HOSTS, audienceTypeSchema, bodySchema (+28 more)

### Community 37 - "word-group.repository.impl.ts"
Cohesion: 0.09
Nodes (18): AddWordGroupMemberUseCase, assertName(), CreateWordGroupUseCase, DeleteWordGroupUseCase, GetWordGroupUseCase, ListWordGroupsUseCase, RemoveWordGroupMemberUseCase, UpdateWordGroupUseCase (+10 more)

### Community 38 - "contribution.validator.ts"
Cohesion: 0.07
Nodes (36): CensoredImageFile, ContributionController, decisionResponse(), parseApprovePayload(), serializeEntity(), ContributionRoutesDeps, createContributionRoutes(), json() (+28 more)

### Community 39 - "EventRepository"
Cohesion: 0.06
Nodes (21): assertCategoryPublished(), assertPlaces(), assertVillage(), CreateEventUseCase, DeleteEventUseCase, GetEventBySlugUseCase, ListEventCategoriesUseCase, ListEventsUseCase (+13 more)

### Community 40 - "event.repository.impl.ts"
Cohesion: 0.09
Nodes (24): EventContributionStatus, Event, EventCategory, EventCategoryRef, EventOccurrenceStatus, EventPlaceRef, EventSourceType, EventStatus (+16 more)

### Community 41 - "lemma-definition.mapper.ts"
Cohesion: 0.07
Nodes (34): LemmaDefinitionEntryDto, LemmaDefinitionLookupResultDto, LemmaDefinitionSenseDto, LemmaDefinitionSuggestionDto, KBBI_PROVIDER_IDS, KbbiProviderId, buildNotes(), expandExamplePlaceholders() (+26 more)

### Community 42 - "NotificationRepository"
Cohesion: 0.09
Nodes (17): GetUnreadNotificationCountUseCase, ListMyNotificationsUseCase, MarkAllNotificationsReadUseCase, MarkNotificationReadUseCase, RecordInboxNotificationCommand, InboxNotification, InboxNotificationType, NotificationActionKind (+9 more)

### Community 43 - "NotificationCampaignRepository"
Cohesion: 0.07
Nodes (15): assertDeepLink(), CancelCampaignUseCase, CreateCampaignDraftUseCase, EstimateCampaignAudienceUseCase, GetCampaignDetailUseCase, ListCampaignsUseCase, RetryFailedCampaignRecipientsUseCase, SendCampaignUseCase (+7 more)

### Community 44 - "suggestion.validator.ts"
Cohesion: 0.08
Nodes (33): composeReasonDisplay(), adminListSuggestionsQuerySchema, approveResponseSchema, approveSuggestionBodySchema, changeHistoryResponseSchema, CreateSuggestionRequest, createSuggestionResponseSchema, createSuggestionSchema (+25 more)

### Community 45 - "legal-document.repository.impl.ts"
Cohesion: 0.08
Nodes (21): AcceptLegalUseCase, ArchiveLegalDocumentUseCase, CreateLegalDocumentDraftUseCase, ListAdminLegalDocumentsUseCase, PublishLegalDocumentUseCase, UpdateLegalDocumentDraftUseCase, CurrentLegalSummary, GetCurrentLegalUseCase (+13 more)

### Community 46 - "map-create-word.ts"
Cohesion: 0.13
Nodes (23): isAllowedStockImageUrl(), isStockWordImageProvider(), resolveWordImageProvider(), STOCK_URL_HOST_SUFFIXES, STOCK_WORD_IMAGE_PROVIDERS, stockImageAttribution(), StockWordImageProvider, wordImageIsAutoVerified() (+15 more)

### Community 47 - "word-import-session.use-cases.ts"
Cohesion: 0.13
Nodes (14): emptyToNull(), ListWordImportSessionsUseCase, SaveWordImportSessionUseCase, ClaimWordImportSessionInput, NewWordImportSession, WordImportSession, WordImportSessionItem, WordImportSessionStatus (+6 more)

### Community 48 - "UgcAbuseEventRepository"
Cohesion: 0.24
Nodes (3): LiftAbuseMuteUseCase, ListUserAbuseEventsUseCase, UgcAbuseEventRepository

### Community 49 - "quota-aware-mailer.ts"
Cohesion: 0.13
Nodes (27): accountDeletionEmailHtml(), accountDeletionEmailText(), brandedCodeEmailHtml(), brandedMessageEmailHtml(), documentShell(), emailActionHref(), escapeEmailHtml(), eyebrowRow() (+19 more)

### Community 50 - "email.repository.impl.ts"
Cohesion: 0.07
Nodes (26): EMAIL_PROVIDERS, EmailCategory, EmailLog, EmailLogStatus, EmailProvider, EmailQuotaWithUsage, EmailLogEntry, EmailLogListQuery (+18 more)

### Community 51 - "rate-limit.middleware.ts"
Cohesion: 0.07
Nodes (37): AdminBugReportRoutesDeps, createAdminBugReportRoutes(), json(), BugReportController, toAdminItem(), BugReportRoutesDeps, createBugReportRoutes(), json() (+29 more)

### Community 52 - "admin-verifier-application.routes.ts"
Cohesion: 0.12
Nodes (22): createAdminVerifierApplicationRoutes(), json(), adminListVerifierApplicationsResponseSchema, adminVerifierApplicationDetailResponseSchema, approveVerifierApplicationResponseSchema, listVerifierApplicationsQuerySchema, myVerifierApplicationResponseSchema, rejectVerifierApplicationResponseSchema (+14 more)

### Community 53 - "BadRequestError"
Cohesion: 0.11
Nodes (15): applyChangesToWord(), assertWordTypeAllowsComponents(), ensurePrimaryImage(), ValidationError, verifyProposedChanges(), ChangeHistoryItem, asProposed(), assertProposedTargetsCurrent() (+7 more)

### Community 54 - "ga4.provider.ts"
Cohesion: 0.15
Nodes (23): Ga4Visitors, byMetricDesc(), CHANNEL_ORDER, channelBucket(), dr(), ga4DateToYmd(), Ga4Provider, Ga4Record (+15 more)

### Community 55 - "word-suggestion.entity.ts"
Cohesion: 0.06
Nodes (32): CATEGORY_SET, ChangeAction, CurrentMeaningSnapshot, CurrentWordSnapshot, DiffField, DiffMeaning, DiffResult, GroupAction (+24 more)

### Community 56 - "import-words.use-case.ts"
Cohesion: 0.19
Nodes (14): canVerifyImport(), decideImportPublication(), ImportMeaningInput, ImportOutcome, ImportWordInput, ImportWordResult, meaningFingerprint(), normalizeLemma() (+6 more)

### Community 57 - "get-play-analytics.use-case.ts"
Cohesion: 0.11
Nodes (20): AnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), GetPlayAnalyticsInput, GetPlayAnalyticsUseCase, isEmpty(), PLAY_STATS_LAG_DAYS (+12 more)

### Community 58 - "place.repository.impl.ts"
Cohesion: 0.18
Nodes (24): PlaceCategory, PlaceImage, PlaceImageAttribution, PlaceRelatedCard, PlaceRelation, PlaceRelationKind, PlaceSource, PlaceStatus (+16 more)

### Community 59 - "zod"
Cohesion: 0.07
Nodes (37): zod, AdminUserRoutesDeps, adminUserMutationResponseSchema, adminUsersListResponseSchema, adminUserWireSchema, ALL_ROLES, ASSIGNABLE_ADMIN_ROLES, listAdminUsersQuerySchema (+29 more)

### Community 60 - "register-user.use-case.test.ts"
Cohesion: 0.07
Nodes (20): EmailDomainVerifierPort, RegisterUserUseCase, VerifyEmailUseCase, EmailVerificationOtp, EmailVerificationOtpRepository, NewEmailVerificationOtp, DnsEmailDomainVerifier, DohResponse (+12 more)

### Community 61 - "service-account-token.ts"
Cohesion: 0.11
Nodes (20): MobileAnalyticsConfig, AnalyticsProviderError, Ga4Config, kindForStatus(), postGoogleJson(), SearchConsoleConfig, ga4(), gsc() (+12 more)

### Community 62 - "WordController"
Cohesion: 0.07
Nodes (15): AdminListWordsQueryBody, ApplyCommaSplitBody, ListWordsQueryBody, MarkCommaLiteralBody, MergeDuplicateWordsBody, SearchWordsQueryBody, AddExampleBody, AddMeaningBody (+7 more)

### Community 63 - "discussion.validator.ts"
Cohesion: 0.06
Nodes (46): AdminDiscussionRoutesDeps, createAdminDiscussionRoutes(), json(), createDiscussionRoutes(), json(), replyAudioUserLimit(), replyUserLimit(), submitUserLimit() (+38 more)

### Community 64 - "create-word.validator.ts"
Cohesion: 0.06
Nodes (48): adminListWordsQuerySchema, applyCommaSplitBodySchema, applyCommaSplitResponseSchema, applyLemmaSplitBodySchema, commaSplitCandidatesResponseSchema, createWordBodySchema, createWordResponseSchema, createWordSchema (+40 more)

### Community 65 - "publicAccountDisplayName"
Cohesion: 0.18
Nodes (16): ActivityRepositoryImpl, feedSafeUsageLabelsSql(), feedVisibleWordSql(), keysetBefore(), notMyWordVoteSql(), notSelfOrNullSql(), notSelfSql(), occurredAtSql() (+8 more)

### Community 66 - "ugc-abuse-event.repository.ts"
Cohesion: 0.15
Nodes (8): parseMeta(), RecordUgcAbuseEventInput, toEntity(), UGC_ABUSE_WEIGHTS, UgcAbuseEvent, UgcAbuseEventRepositoryImpl, UgcAbuseEventWithUser, UgcAbuseSignal

### Community 67 - "SearchMissRepository"
Cohesion: 0.05
Nodes (35): BulkDismissSearchMissCommand, BulkDismissSearchMissItemFailure, BulkDismissSearchMissItemResult, BulkDismissSearchMissItemSuccess, BulkDismissSearchMissResult, BulkDismissSearchMissUseCase, SEARCH_MISS_BULK_DISMISS_MAX, DismissSearchMissCommand (+27 more)

### Community 68 - "bookmark.repository.impl.ts"
Cohesion: 0.13
Nodes (14): GetMyBookmarksUseCase, ToggleBookmarkCommand, ToggleBookmarkUseCase, BookmarkItem, BookmarkListOptions, BookmarkListResult, BookmarkRepository, BookmarkWordSummary (+6 more)

### Community 69 - "admin-vote.controller.ts"
Cohesion: 0.09
Nodes (17): FIRST_PARTY_CLIENT_IDS, DeleteAdminVoteCommand, DeleteAdminVoteResult, DeleteAdminVoteUseCase, GetTopTargetVotesCommand, GetTopTargetVotesUseCase, ResetTargetVotesCommand, ResetTargetVotesResult (+9 more)

### Community 70 - "UgcAnonAbuseRepository"
Cohesion: 0.16
Nodes (6): wordController, assertAnonWriteAllowed(), RecordAnonAbuseSignalUseCase, subjectsFrom(), AnonAbuseSubject, UgcAnonAbuseRepository

### Community 71 - "UserRepository"
Cohesion: 0.04
Nodes (39): ChangePasswordDto, ChangePasswordUseCase, CreateAdminUserCommand, CreateAdminUserUseCase, ListAdminUsersCommand, ListAdminUsersResult, ListAdminUsersUseCase, ResendOtpUseCase (+31 more)

### Community 72 - "logger.ts"
Cohesion: 0.08
Nodes (29): @hono/node-server, app, server, shutdown(), createImageStorage(), basicAuth(), hmacSha1Hex(), ImageKitStorageService (+21 more)

### Community 73 - "AppVariables"
Cohesion: 0.07
Nodes (32): CategoryController, serialize(), categoryItemResponseSchema, categoryItemSchema, categoryListResponseSchema, CategoryRoutesDeps, createCategoryBodySchema, createCategoryRoutes() (+24 more)

### Community 74 - "ContributionRepositoryImpl"
Cohesion: 0.10
Nodes (9): ReopenContributionOutcome, ContributionEntityType, ApplyChildCorrectionCommand, ChildEntityWithParent, MyContributionListFilter, ReviewCommand, ContributionRepositoryImpl, decisionToStatus() (+1 more)

### Community 75 - "vote.repository.ts"
Cohesion: 0.16
Nodes (12): GetVoteDeckQuery, GetVoteDeckUseCase, AdminVoteListItem, decodeVoteDeckCursor(), encodeVoteDeckCursor(), Vote, VoteDeckCursor, VoteDeckListOptions (+4 more)

### Community 76 - "id.ts"
Cohesion: 0.08
Nodes (30): AbuseController, AdminCtx, authErrors, createAbuseRoutes(), json(), anonAbuseEventListResponseSchema, anonMuteListResponseSchema, LiftAnonMuteBody (+22 more)

### Community 77 - "ilikeCompat"
Cohesion: 0.32
Nodes (7): ListAtoZParams, SearchParams, browseSafeUsageLabelsSql(), escapeLike(), searchTerms(), toUsageLabels(), ilikeCompat()

### Community 78 - "place.controller.ts"
Cohesion: 0.10
Nodes (25): ListPlacesUseCase, mapImages(), mapSources(), PlaceController, serialize(), serializeImage(), appendImagesBody, idParam (+17 more)

### Community 79 - "VoteRepository"
Cohesion: 0.13
Nodes (8): GetMyVotesUseCase, MyVoteItem, ListMyVoteHistoryUseCase, SkipVoteDeckWordUseCase, VoteHistoryListOptions, VoteHistoryListResult, VoteRepository, makeDeps()

### Community 80 - "ActivityEventFeedRepositoryImpl"
Cohesion: 0.17
Nodes (5): ActivityEventFeedRepositoryImpl, cursorFromEventId(), profileCategoryOf(), quoted(), voteEntityTypeOfKind()

### Community 81 - "DatabaseBackupLogRepository"
Cohesion: 0.13
Nodes (9): GithubActionsDispatchPort, WorkflowDispatchInput, ListDatabaseBackupLogsUseCase, BACKUP_STALE_MESSAGE, BACKUP_STALE_MS, resolveGithubToken(), TriggerSqliteBackupUseCase, DatabaseBackupLogRepository (+1 more)

### Community 82 - "web-import.repository.impl.ts"
Cohesion: 0.05
Nodes (50): ApproveWebImportUseCase, GetWebImportUseCase, ListWebImportsUseCase, normalizeType(), PreviewWebImportUseCase, RejectWebImportUseCase, SubmitWebImportInput, SubmitWebImportResult (+42 more)

### Community 83 - "ApiClientRepository"
Cohesion: 0.07
Nodes (30): assertChannels(), assertScopes(), assertStatus(), GetAdminApiClientUseCase, ListAdminApiClientsUseCase, mapAdmin(), ResolvedFirstPartyClient, ResolveFirstPartyClientInput (+22 more)

### Community 84 - "DiscussionController"
Cohesion: 0.11
Nodes (19): isVerifierRole(), DiscussionController, redactDiscussionAudio(), redactReplyAudio(), redactReplyBody(), toAdminItem(), toAdminReply(), toOwnerItem() (+11 more)

### Community 85 - "login-with-facebook.use-case.ts"
Cohesion: 0.06
Nodes (45): FacebookLoginDto, GithubLoginDto, GoogleLoginDto, RegisterDto, ASSIGNABLE_ADMIN_ROLES, AssignableAdminRole, isReservedHandle(), RESERVED_HANDLES (+37 more)

### Community 86 - "PlaceRepository"
Cohesion: 0.07
Nodes (9): AppendPlaceImagesUseCase, DeletePlaceUseCase, GetPlaceBySlugUseCase, GetPlaceViewReportUseCase, HidePlaceImageUseCase, ListPlaceImagesUseCase, ListPlaceViewsUseCase, RecordPlaceViewUseCase (+1 more)

### Community 87 - "event-contribution.use-cases.ts"
Cohesion: 0.12
Nodes (13): decisionCopy(), EventContributionUseCases, EventContribution, EventContributionPayload, composeEventRejectDisplay(), EVENT_REJECT_REASON_CODES, EVENT_REJECT_REASON_LABELS, EventRejectReasonCode (+5 more)

### Community 88 - "system-supabase.controller.ts"
Cohesion: 0.12
Nodes (14): ListSupabaseHealthChecksUseCase, projectRefFromUrl(), TriggerSupabaseHealthCheckUseCase, SupabaseHealthCheck, SupabaseHealthCheckFilter, SupabaseHealthCheckPage, SupabaseHealthCheckRepository, SupabaseHealthEnv (+6 more)

### Community 89 - "event.routes.ts"
Cohesion: 0.08
Nodes (28): createAdminEventContributionRoutes(), createEventContributionRoutes(), idParam, json(), okItem, okList, rejectEventContributionBodySchema, requestRevisionBodySchema (+20 more)

### Community 90 - "region.repository.impl.ts"
Cohesion: 0.16
Nodes (12): assertSlug(), Region, RegionStatus, RegionType, CreateRegionInput, ListRegionsInput, ListRegionsResult, RegionCatalogItem (+4 more)

### Community 91 - "bulk-words-action.use-case.ts"
Cohesion: 0.11
Nodes (12): BulkWordsAction, BulkWordsActionResult, BulkWordsActionUseCase, BulkWordsItemFailure, BulkWordsItemResult, BulkWordsItemSuccess, PUBLISH_ROLES, PublishWordUseCase (+4 more)

### Community 92 - "AchievementRepository"
Cohesion: 0.08
Nodes (12): CreateAchievementUseCase, DeleteAchievementUseCase, GrantAchievementUseCase, PreviewAchievementUseCase, RevokeUserAchievementUseCase, SetActiveBorderUseCase, UpdateAchievementUseCase, ListActiveAchievementsUseCase (+4 more)

### Community 93 - "get-mobile-analytics.use-case.ts"
Cohesion: 0.10
Nodes (21): MobileAnalyticsProviderErrorKind, CacheEntry, ERROR_SUFFIX, errorMessage(), GetMobileAnalyticsInput, GetMobileAnalyticsUseCase, isEmpty(), MOBILE_ANALYTICS_SECTIONS (+13 more)

### Community 94 - "place-contribution.use-cases.ts"
Cohesion: 0.12
Nodes (9): assertOurPlaceImage(), CreatePlaceUseCase, UpdatePlaceUseCase, decisionCopy(), PlaceContributionUseCases, ContributionPayload, mapRow(), PlaceContribution (+1 more)

### Community 95 - "word.entity.ts"
Cohesion: 0.07
Nodes (34): SetWordImageContentWarningsUseCase, CloseOpenWordReports, TakedownWordCommand, TakedownWordUseCase, RelatedWordRef, TAKEDOWN_REASON_CODES, TakedownReasonCode, WORD_REPORT_REASON_CODES (+26 more)

### Community 96 - "admin-comment-blocklist.routes.ts"
Cohesion: 0.16
Nodes (14): AdminCommentBlocklistRoutesDeps, createAdminCommentBlocklistRoutes(), json(), CommentBlocklistController, BulkCreateBlocklistBody, bulkCreateBlocklistBodySchema, bulkCreateBlocklistResponseSchema, createBlocklistResponseSchema (+6 more)

### Community 97 - "ActivityEventKind"
Cohesion: 0.09
Nodes (16): RecordActivityEventCommand, RecordCardShareUseCase, ACTIVITY_EVENT_KINDS, ActivityEventKind, ActivityEventRow, AppendActivityEventInput, ActivityEventCursor, ActivityEventRepository (+8 more)

### Community 98 - "LanguageRepository"
Cohesion: 0.16
Nodes (7): ListDialectsUseCase, ListLanguagesUseCase, Dialect, Language, LanguageRepository, LanguageRepositoryImpl, LanguageController

### Community 99 - "notification.routes.ts"
Cohesion: 0.15
Nodes (15): NotificationController, createNotificationRoutes(), json(), NotificationRoutesDeps, inboxNotificationTypeSchema, ListNotificationsQuery, listNotificationsQuerySchema, listNotificationsResponseSchema (+7 more)

### Community 100 - "PublicImageStoragePort"
Cohesion: 0.10
Nodes (23): PublicImageStoragePort, PublicImagePurpose, UploadPublicImageResult, UploadPublicImageUseCase, buildAvatarImagePath(), buildCampaignImagePath(), buildDiscussionImagePath(), buildEventImagePath() (+15 more)

### Community 101 - "user.routes.ts"
Cohesion: 0.19
Nodes (16): createMeAvatarRoutes(), createMeProfileRoutes(), createPublicUserRoutes(), getCachedSuggest(), json(), setCachedSuggest(), suggestCache, SuggestCacheEntry (+8 more)

### Community 102 - "VoteRepositoryImpl"
Cohesion: 0.18
Nodes (5): VoteHistoryWord, VoteTarget, clipPreview(), VoteRepositoryImpl, voteTargetKey()

### Community 104 - "auth.e2e.test.ts"
Cohesion: 0.12
Nodes (15): FacebookAccessTokenClaims, FacebookTokenVerifierPort, FACEBOOK_GRAPH_VERSION, FacebookFetch, FacebookTokenVerifier, facebookTokenVerifier, facebookTokenVerifierHolder, invalidToken() (+7 more)

### Community 105 - "WordDetail"
Cohesion: 0.11
Nodes (9): GetWordByIdUseCase, GetWordByLemmaUseCase, GetWordOfDayUseCase, wibDateString(), WordOfDayResult, wordOfDaySettingKey(), WordDetail, WIB_NOW (+1 more)

### Community 106 - "admin-api-client.routes.ts"
Cohesion: 0.14
Nodes (18): AdminApiClientController, AdminCtx, AdminApiClientRoutesDeps, createAdminApiClientRoutes(), json(), apiClientAdminListResponseSchema, apiClientAdminResponseSchema, apiClientAdminSchema (+10 more)

### Community 107 - "PushSenderPort"
Cohesion: 0.23
Nodes (11): PushMessage, PushSenderPort, PushSendResult, FcmPushSender, getFcmAccessToken(), NoopPushSender, pushOne(), pushTopic() (+3 more)

### Community 109 - "merge-activity.ts"
Cohesion: 0.13
Nodes (16): ListActivityInput, ListActivityPage, ListActivityUseCase, ActivityActor, ActivityTarget, ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT, ACTIVITY_PER_KIND_CAP (+8 more)

### Community 110 - "legal.controller.ts"
Cohesion: 0.09
Nodes (29): AdminCtx, LegalController, LegalRoutesDeps, mapLegalDocumentAdmin(), mapLegalDocumentPublic(), AcceptLegalBody, acceptLegalBodySchema, acceptLegalResponseSchema (+21 more)

### Community 111 - "place-contribution.routes.ts"
Cohesion: 0.13
Nodes (15): composePlaceRejectDisplay(), PLACE_REJECT_REASON_CODES, PLACE_REJECT_REASON_LABELS, PlaceRejectReasonCode, PlaceContributionController, serialize(), toPayload(), createAdminPlaceContributionRoutes() (+7 more)

### Community 112 - "scripts"
Cohesion: 0.09
Nodes (23): scripts, cleanup-tokens, dataset:export, db:backfill-activity, db:backfill-consents, db:migrate, deploy, deploy:staging (+15 more)

### Community 113 - "Place"
Cohesion: 0.12
Nodes (6): assertCategory(), Place, dayOffset(), normalizeImages(), PlaceRepositoryImpl, searchDayWib()

### Community 114 - "bookmark.routes.ts"
Cohesion: 0.19
Nodes (12): BookmarkController, BookmarkRoutesDeps, createBookmarkRoutes(), json(), bookmarkDataSchema, cursorMetaSchema, MyBookmarksQuery, myBookmarksQuerySchema (+4 more)

### Community 115 - "ugc-anon-abuse.repository.ts"
Cohesion: 0.24
Nodes (7): RecordAnonAbuseSignalCommand, ANON_ABUSE_WEIGHTS, AnonAbuseEvent, AnonAbuseSignal, AnonAbuseSubjectKind, AnonMute, RecordAnonAbuseEventInput

### Community 116 - "auth-identity.repository.impl.ts"
Cohesion: 0.20
Nodes (12): AuthIdentity, NewAuthIdentity, CreateUserWithGoogleIdentityResult, NewGoogleIdentity, AuthIdentityRepositoryImpl, errHaystack(), IdentityRow, loadRoles() (+4 more)

### Community 117 - "wa-admin.routes.ts"
Cohesion: 0.12
Nodes (19): createWaAdminRoutes(), createWaTemplateBodySchema, json(), listWaLogsQuerySchema, requireUser(), serializeTemplate(), serializeUsage(), testSendBodySchema (+11 more)

### Community 118 - "package.json"
Cohesion: 0.11
Nodes (17): description, engines, node, license, name, private, type, version (+9 more)

### Community 119 - "mailer.factory.ts"
Cohesion: 0.11
Nodes (18): 1. Verifikasi file sudah benar (RED evidence dulu), 2. Verifikasi GREEN lokal, 3. Commit TERBATAS satu file (butuh go-ahead Tuan dulu), 4. Push staging + pantau CI (butuh go-ahead Tuan dulu), Architecture / pendekatan, Current context / asumsi, Fix: 29 suite e2e CI gagal — Cannot find module './smtp-mailer.service', Goal (+10 more)

### Community 121 - "word-media.routes.ts"
Cohesion: 0.20
Nodes (16): addExampleResponseSchema, addExampleSchema, addMeaningResponseSchema, addMeaningSchema, addPronunciationResponseSchema, addPronunciationSchema, addWordImageResponseSchema, addWordImageSchema (+8 more)

### Community 122 - "DeviceTokenRepository"
Cohesion: 0.17
Nodes (4): LogoutAllDevicesUseCase, RegisterDeviceTokenUseCase, RevokeDeviceTokenUseCase, DeviceTokenRepository

### Community 123 - "admin-vote.routes.ts"
Cohesion: 0.11
Nodes (22): AdminVotesController, AdminVoteRoutesDeps, json(), adminTopTargetWireSchema, AdminVoteTargetType, adminVoteWireSchema, DeleteAdminVoteParams, deleteAdminVoteParamsSchema (+14 more)

### Community 124 - "vote.routes.ts"
Cohesion: 0.18
Nodes (17): MAX_VOTE_TARGETS, myVotesResponseSchema, skipVoteDeckParamsSchema, skipVoteDeckResponseSchema, skipVoteDeckSchema, targetsQuerySchema, toggleVoteResponseSchema, toggleVoteSchema (+9 more)

### Community 125 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 126 - "activity.routes.ts"
Cohesion: 0.18
Nodes (12): ActivityController, toWire(), createActivityRoutes(), createCardShareRoutes(), json(), activityActorSchema, activityItemSchema, activityTargetSchema (+4 more)

### Community 127 - "promote-word-image-staging.ts"
Cohesion: 0.22
Nodes (13): deleteStagingWordImage(), fetchImageBytes(), PromotedWordImage, promoteWordImageFromStaging(), PromoteWordImageOptions, StagingWordImage, CensoredSuggestionFile, deleteProposedStagingImages() (+5 more)

### Community 128 - "search-miss.routes.ts"
Cohesion: 0.10
Nodes (23): SearchMissController, toApi(), createAdminSearchMissRoutes(), createSearchMissRoutes(), json(), SearchMissRoutesDeps, AdminSearchMissQueryBody, adminSearchMissQuerySchema (+15 more)

### Community 129 - "AchievementRepositoryImpl"
Cohesion: 0.13
Nodes (4): AchievementRepositoryImpl, parseCriteria(), toDomain(), toOwnership()

### Community 130 - "send-verifier-wa.use-case.ts"
Cohesion: 0.50
Nodes (3): SendVerifierWaCommand, SendWaMessageCommand, SendWaMessageResult

### Community 131 - "RefreshTokenRepository"
Cohesion: 0.07
Nodes (24): jose, authenticate, optionalAuthenticate, softAuthenticate, LoginDto, AccessTokenPayload, TokenServicePort, LoginUserUseCase (+16 more)

### Community 132 - "category-suggestion.routes.ts"
Cohesion: 0.05
Nodes (35): ListCategoriesUseCase, Category, CategoryRepository, CategoryRepositoryImpl, ListCategorySuggestionsUseCase, ProposeCategorySuggestionCommand, ProposeCategorySuggestionUseCase, ApproveCategorySuggestionUseCase (+27 more)

### Community 133 - "ActivityItem"
Cohesion: 0.31
Nodes (3): ActivityItem, ActivityCursor, ActivityRepository

### Community 134 - "database-backup-log.repository.ts"
Cohesion: 0.20
Nodes (8): CreateDatabaseBackupLogInput, DatabaseBackupLog, DatabaseBackupLogFilter, DatabaseBackupLogPage, DatabaseBackupLogStatus, DatabaseBackupTriggerSource, DatabaseBackupLogRepositoryImpl, toEntity()

### Community 135 - "hono"
Cohesion: 0.06
Nodes (45): hono, DeviceController, createDeviceRoutes(), DeviceRoutesDeps, json(), deviceTokenMutationResponseSchema, RegisterDeviceTokenBody, registerDeviceTokenSchema (+37 more)

### Community 136 - "vote.controller.ts"
Cohesion: 0.24
Nodes (6): SkipVoteDeckBody, ToggleVoteBody, VoteDeckQuery, VoteHistoryQuery, VoteController, VoteRoutesDeps

### Community 137 - "CommentBlocklistWord"
Cohesion: 0.19
Nodes (4): CommentBlocklistWord, CursorPage, CommentBlocklistRepositoryImpl, wordContains()

### Community 138 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, dotenv, drizzle-orm, hono, @hono/node-server, @hono/zod-openapi, jose, @libsql/client (+6 more)

### Community 139 - "system-database.routes.ts"
Cohesion: 0.17
Nodes (14): AdminCtx, iso(), SystemDatabaseController, toWire(), createSystemDatabaseRoutes(), json(), SystemDatabaseRoutesDeps, backupLogItemSchema (+6 more)

### Community 140 - "SambasKu-API"
Cohesion: 0.11
Nodes (18): Akses Database, Alur record (DB + asset), Alur record (DB + asset), Audio pelafalan (GitHub asset repo), Cloudflare Workers (deploy), Command Sehari-hari, Database (tanpa Docker), Database test (integration & e2e) (+10 more)

### Community 141 - "achievement-registry.ts"
Cohesion: 0.11
Nodes (10): ACHIEVEMENT_SELECTABLE_SOURCES, ACHIEVEMENT_SOURCE_REGISTRY, AchievementFilterField, AchievementSourceDefinition, findAchievementSource(), isAchievementSourceKnown(), manualSource, registrationSource (+2 more)

### Community 142 - "review-push-cooldown-gate.ts"
Cohesion: 0.23
Nodes (8): makePushCooldownGate(), DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES, REVIEW_APPROVE_PUSH_COOLDOWN_MINUTES_KEY, REVIEW_REJECT_PUSH_COOLDOWN_MINUTES_KEY, log(), parseCooldownMinutes(), ReviewPushCooldownGate, ReviewPushCooldownChannel

### Community 143 - "ToggleVoteUseCase"
Cohesion: 0.21
Nodes (5): ToggleVoteUseCase, wordVoteBody(), ToggleVoteResult, makeDeps(), TARGET

### Community 144 - "suggestion-category-shape.ts"
Cohesion: 0.29
Nodes (9): CensoredSuggestion, censorSuggestionText(), ALLOWED, checkSuggestionCategoryShape(), isRevertibleForApplyPending(), Part, presentParts(), ShapeIssue (+1 more)

### Community 145 - "fts-word-search-index.ts"
Cohesion: 0.36
Nodes (3): SearchIndexHit, WordSearchIndex, FtsWordSearchIndex

### Community 146 - "normalize-blocklist-words.ts"
Cohesion: 0.25
Nodes (4): BLOCKLIST_BULK_MAX, BLOCKLIST_WORD_MAX_LENGTH, normalizeBlocklistWords(), NormalizedBlocklistBatch

### Community 147 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, drizzle-kit, @types/node, @types/nodemailer, typescript, vitest, wrangler

### Community 148 - "UserSkipRepository"
Cohesion: 0.19
Nodes (3): SkipContributionUseCase, makeDeps(), UserSkipRepository

### Community 149 - ".listLatest"
Cohesion: 0.29
Nodes (3): encodeLatestCursor(), ListLatestParams, feedSafeUsageLabelsSql()

### Community 151 - "upload-pronunciation-audio.use-case.test.ts"
Cohesion: 0.33
Nodes (6): ADMIN, CONTRIBUTOR, makeDeps(), makeUseCase(), SAMPLE_BYTES, WORD

### Community 152 - "migrate-place-ids.ts"
Cohesion: 0.67
Nodes (3): CHILD_TABLES, main(), rowField()

### Community 154 - "SearchMissRepositoryImpl"
Cohesion: 0.27
Nodes (3): SearchMissUpdatePatch, normalizeTerm, SearchMissRepositoryImpl

### Community 158 - "list-audit-logs.use-case.ts"
Cohesion: 0.24
Nodes (6): ListAuditLogsResult, ListAuditLogsUseCase, AuditLog, AuditLogFilter, AuditLogPage, toEntity()

### Community 159 - "audit.routes.ts"
Cohesion: 0.31
Nodes (7): AuditController, createAuditRoutes(), json(), auditLogItemSchema, auditLogListResponseSchema, ListAuditLogsQuery, listAuditLogsQuerySchema

### Community 160 - "achievement.repository.impl.ts"
Cohesion: 0.18
Nodes (12): ScanAchievementResult, Achievement, AchievementWithOwnership, CreateAchievementInput, ListAchievementsFilter, UpdateAchievementInput, UserAchievement, GrantResult (+4 more)

### Community 163 - "get-vote-counts.use-case.ts"
Cohesion: 0.24
Nodes (7): GetVoteCountsUseCase, VoteCountItem, VoteCounts, makeDeps(), MEANING, PRON, WORD

### Community 164 - "create-word.validator.test.ts"
Cohesion: 0.50
Nodes (4): build(), FORM_A, FORM_B, ULID()

### Community 169 - "list-admin-votes.use-case.ts"
Cohesion: 0.23
Nodes (8): ListAdminVotesCommand, ListAdminVotesUseCase, AdminVoteCursor, AdminVoteListFilter, AdminVoteListResult, decodeAdminCursor(), encodeAdminCursor(), makeDeps()

### Community 170 - "app-error.ts"
Cohesion: 0.02
Nodes (96): RecordActivityEventUseCase, CreateAnnouncementCommand, CreateAnnouncementUseCase, DeleteAnnouncementUseCase, UpdateAnnouncementUseCase, AuditLogRepository, SetCanContributeUseCase, SetUserActiveUseCase (+88 more)

### Community 171 - "import-session.validator.ts"
Cohesion: 0.13
Nodes (10): ClaimImportSessionBody, claimImportSessionBodySchema, importSessionItemSchema, importSessionResponseSchema, ListImportSessionsQuery, listImportSessionsQuerySchema, rollbackImportSessionResponseSchema, SaveImportSessionBody (+2 more)

### Community 172 - "run-due-achievement-scan.use-case.ts"
Cohesion: 0.25
Nodes (6): ACHIEVEMENT_SCAN_BATCH_LIMIT, ACHIEVEMENT_SCAN_INTERVAL_MS, ACHIEVEMENTS_LAST_SCAN_KEY, RunDueAchievementScanResult, RunDueAchievementScanUseCase, ScanAchievementUseCase

### Community 174 - "scan-achievement.test.ts"
Cohesion: 0.27
Nodes (3): AwardTarget, achievement, FakeRepo

### Community 175 - "bulk-words.validator.ts"
Cohesion: 0.25
Nodes (7): WORDS_BULK_MAX, bulkItemFailureSchema, bulkItemSuccessSchema, bulkWordsActionSchema, BulkWordsBody, bulkWordsBodySchema, bulkWordsResponseSchema

### Community 179 - "refresh-token.repository.impl.ts"
Cohesion: 0.27
Nodes (4): NewRefreshToken, RefreshTokenRecord, mapRow(), RefreshTokenRepositoryImpl

### Community 182 - "worker.ts"
Cohesion: 0.31
Nodes (7): KAPSO_WA_DEFAULT_BASE_URL, AppModule, bootstrap(), Env, fetch(), loadApp(), scheduled()

### Community 184 - "AppSettingsRepository"
Cohesion: 0.10
Nodes (19): DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES, DEFAULT_WORD_VOTE_PUSH_COOLDOWN_MINUTES, WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY, WORD_VOTE_PUSH_COOLDOWN_MINUTES_KEY, AppSettingsRepository, CHANNEL, log(), parseCooldownMinutes() (+11 more)

### Community 185 - "map-word-image-url.ts"
Cohesion: 0.60
Nodes (3): mapPublicWordImageUrl(), WordImageUrlFields, PENDING_WORD_IMAGE_PLACEHOLDER_URL

### Community 199 - "batch-contribute-words.use-case.ts"
Cohesion: 0.15
Nodes (9): BATCH_CONTRIBUTE_MAX_ROWS, BATCH_CONTRIBUTE_SOURCE_LABEL, BatchContributeResult, BatchContributeRow, BatchContributeWordsUseCase, BatchContributeWordsBody, batchContributeWordsBodySchema, batchContributeWordsResponseSchema (+1 more)

### Community 203 - "import-words.validator.ts"
Cohesion: 0.33
Nodes (4): importMeaningSchema, ImportWordsBody, importWordsBodySchema, importWordsResponseSchema

### Community 204 - "isUniqueViolation"
Cohesion: 0.24
Nodes (9): mapMediaViolation(), isForeignKeyViolation(), isUniqueViolation(), isUniqueViolationOn(), collectCodes(), collectMessages(), CAPACITY_SIGNATURES, isCapacityFailure() (+1 more)

### Community 206 - "meaning-source.validator.test.ts"
Cohesion: 1.00
Nodes (3): build(), buildMeaning(), ULID()

## Knowledge Gaps
- **1162 isolated node(s):** `imports`, `name`, `version`, `description`, `license` (+1157 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1558 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `discussion.controller.ts`, `word.repository.impl.ts`, `set-password.use-case.ts`, `.record`, `createOpenApiApp`, `account-deletion.use-case.ts`, `test-utils.ts`, `VerifierApplication`, `WordRepository`, `fcm-analytics.provider.ts`, `wa-message.repository.impl.ts`, `ResolvedRange`, `web-analytics.entity.ts`, `seed-reference.ts`, `UnauthorizedError`, `word.repository.ts`, `contribution.use-case.test.ts`, `bug-report.repository.impl.ts`, `app-setting.entity.ts`, `user.controller.ts`, `achievement.routes.ts`, `get-web-analytics.use-case.ts`, `notification-campaign.repository.impl.ts`, `play-stats.provider.ts`, `list-share-backgrounds.use-case.ts`, `dashboard.repository.impl.ts`, `campaign.validator.ts`, `EventRepository`, `lemma-definition.mapper.ts`, `suggestion.validator.ts`, `legal-document.repository.impl.ts`, `map-create-word.ts`, `UgcAbuseEventRepository`, `quota-aware-mailer.ts`, `email.repository.impl.ts`, `admin-verifier-application.routes.ts`, `BadRequestError`, `import-words.use-case.ts`, `register-user.use-case.test.ts`, `service-account-token.ts`, `create-word.validator.ts`, `ugc-abuse-event.repository.ts`, `SearchMissRepository`, `bookmark.repository.impl.ts`, `UgcAnonAbuseRepository`, `UserRepository`, `vote.repository.ts`, `id.ts`, `VoteRepository`, `web-import.repository.impl.ts`, `ApiClientRepository`, `login-with-facebook.use-case.ts`, `event-contribution.use-cases.ts`, `bulk-words-action.use-case.ts`, `word.entity.ts`, `resolve-import-attribution.ts`, `auth.e2e.test.ts`, `WordDetail`, `merge-activity.ts`, `package.json`, `DeviceTokenRepository`, `promote-word-image-staging.ts`, `RefreshTokenRepository`, `hono`, `ToggleVoteUseCase`, `suggestion-category-shape.ts`, `normalize-blocklist-words.ts`, `UserSkipRepository`, `upload-pronunciation-audio.use-case.test.ts`, `get-vote-counts.use-case.ts`, `create-word.validator.test.ts`, `list-admin-votes.use-case.ts`, `app-error.ts`, `scan-achievement.test.ts`, `worker.ts`, `AppSettingsRepository`, `map-word-image-url.ts`, `query-boolean.ts`, `batch-contribute-words.use-case.ts`, `isUniqueViolation`, `meaning-source.validator.test.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `drizzle-orm` connect `drizzle-orm` to `vitest`, `discussion.controller.ts`, `word.repository.impl.ts`, `app.ts`, `category-suggestion.routes.ts`, `test-utils.ts`, `CommentBlocklistWord`, `comment.controller.ts`, `achievement-registry.ts`, `wa-message.repository.impl.ts`, `seed-reference.ts`, `bug-report.repository.impl.ts`, `app-setting.entity.ts`, `backfill-user-consents.ts`, `notification-campaign.repository.impl.ts`, `achievement.repository.impl.ts`, `announcement.controller.ts`, `place-category.repository.impl.ts`, `dashboard.repository.impl.ts`, `word-group.repository.impl.ts`, `event.repository.impl.ts`, `NotificationRepository`, `app-error.ts`, `legal-document.repository.impl.ts`, `email.repository.impl.ts`, `refresh-token.repository.impl.ts`, `AppSettingsRepository`, `place.repository.impl.ts`, `ugc-abuse-event.repository.ts`, `bookmark.repository.impl.ts`, `web-import.repository.impl.ts`, `login-with-facebook.use-case.ts`, `system-supabase.controller.ts`, `region.repository.impl.ts`, `word.entity.ts`, `ActivityEventKind`, `ugc-anon-abuse.repository.ts`, `auth-identity.repository.impl.ts`, `package.json`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `zod` connect `zod` to `search-miss.routes.ts`, `app.ts`, `category-suggestion.routes.ts`, `createOpenApiApp`, `hono`, `comment.controller.ts`, `fcm-analytics.provider.ts`, `RegionRepository`, `web-analytics.entity.ts`, `UnauthorizedError`, `user.controller.ts`, `achievement.routes.ts`, `audit.routes.ts`, `list-share-backgrounds.use-case.ts`, `campaign.validator.ts`, `contribution.validator.ts`, `EventRepository`, `lemma-definition.mapper.ts`, `import-session.validator.ts`, `suggestion.validator.ts`, `map-create-word.ts`, `bulk-words.validator.ts`, `rate-limit.middleware.ts`, `admin-verifier-application.routes.ts`, `get-play-analytics.use-case.ts`, `query-boolean.ts`, `discussion.validator.ts`, `create-word.validator.ts`, `batch-contribute-words.use-case.ts`, `logger.ts`, `AppVariables`, `import-words.validator.ts`, `id.ts`, `isUniqueViolation`, `place.controller.ts`, `web-import.repository.impl.ts`, `event.routes.ts`, `get-mobile-analytics.use-case.ts`, `admin-comment-blocklist.routes.ts`, `notification.routes.ts`, `user.routes.ts`, `admin-api-client.routes.ts`, `legal.controller.ts`, `place-contribution.routes.ts`, `bookmark.routes.ts`, `wa-admin.routes.ts`, `package.json`, `word-media.routes.ts`, `admin-vote.routes.ts`, `vote.routes.ts`, `activity.routes.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `imports`, `name`, `version` to the rest of the system?**
  _1162 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `vitest` be split into smaller, more focused modules?**
  _Cohesion score 0.020732865008543763 - nodes in this community are weakly interconnected._
- **Should `discussion.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03980099502487562 - nodes in this community are weakly interconnected._
- **Should `word.repository.impl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.026496116948378255 - nodes in this community are weakly interconnected._