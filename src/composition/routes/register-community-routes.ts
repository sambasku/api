/** Encyclopedia, analytics, admin users, campaigns, activity, share, geo. */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import * as di from '../container';
import { wordReportController } from './shared-late-controllers';
import { env } from "@/shared/config/env";
import { db } from "@/shared/database/drizzle/client";
import { createEmailAdminRoutes } from "@/modules/email/presentation/v1/email-admin.routes";
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
import { AbuseController } from "@/modules/abuse/presentation/v1/abuse.controller";
import { createAbuseRoutes } from "@/modules/abuse/presentation/v1/abuse.routes";
import { LiftAbuseMuteUseCase } from "@/modules/abuse/application/use-cases/lift-abuse-mute.use-case";
import { createAdminWordReportRoutes } from "@/modules/word-report/presentation/v1/admin-word-report.routes";
import { ResolveMapsUrlUseCase } from "@/modules/geo/application/resolve-maps-url.use-case";
import { GeoController } from "@/modules/geo/presentation/v1/geo.controller";
import { createGeoRoutes } from "@/modules/geo/presentation/v1/geo.routes";
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
import { createDashboardRoutes } from "@/modules/dashboard/presentation/v1/dashboard.routes";
import { createWebAnalyticsRoutes } from "@/modules/web-analytics/presentation/v1/web-analytics.routes";
import { createPlayAnalyticsRoutes } from "@/modules/play-analytics/presentation/v1/play-analytics.routes";
import { createFcmAnalyticsRoutes } from "@/modules/fcm-analytics/presentation/v1/fcm-analytics.routes";
import { createMobileAnalyticsRoutes } from "@/modules/mobile-analytics/presentation/v1/mobile-analytics.routes";
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


export function registerCommunityRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {

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

}
