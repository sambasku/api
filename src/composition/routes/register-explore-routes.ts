/** Places, events, usaha, karya, culinary, regions. */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import * as di from '../container';
import { publicImageController } from './shared-late-controllers';
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

export function registerExploreRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {
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

}
