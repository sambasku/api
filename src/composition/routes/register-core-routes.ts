/** Auth, stickers, legal, system, mobile-release. */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import * as di from '../container';
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
import {
  createAdminStickerRoutes,
  createPublicStickerRoutes,
} from "@/modules/sticker/presentation/v1/sticker.routes";

export function registerCoreRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {
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

}
