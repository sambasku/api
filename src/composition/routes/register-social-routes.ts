import { CreateJinyeCommentAudioUseCase } from '@/modules/jinye/application/use-cases/create-jinye-comment-audio.use-case';
/** Audit/images/bug + discussions, chat, pantun, jinye. */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import * as di from '../container';
import { env } from "@/shared/config/env";
import { NotifyChatMentionsUseCase } from "@/modules/chat/application/use-cases/notify-chat-mentions.use-case";
import { db } from "@/shared/database/drizzle/client";
import { ListAuditLogsUseCase } from "@/modules/audit/application/use-cases/list-audit-logs.use-case";
import { AuditController } from "@/modules/audit/presentation/v1/audit.controller";
import { createAuditRoutes } from "@/modules/audit/presentation/v1/audit.routes";
import { CreateUploadCredentialsUseCase } from "@/modules/image/application/use-cases/create-upload-credentials.use-case";
import { ImageController } from "@/modules/image/presentation/v1/image.controller";
import { createImageRoutes } from "@/modules/image/presentation/v1/image.routes";
import { BugReportRepositoryImpl } from "@/modules/bug-report/infrastructure/bug-report.repository.impl";
import { CreateBugReportUseCase } from "@/modules/bug-report/application/use-cases/create-bug-report.use-case";
import { ListBugReportsUseCase } from "@/modules/bug-report/application/use-cases/list-bug-reports.use-case";
import { ResolveBugReportUseCase } from "@/modules/bug-report/application/use-cases/resolve-bug-report.use-case";
import { BugReportController } from "@/modules/bug-report/presentation/v1/bug-report.controller";
import { createBugReportRoutes } from "@/modules/bug-report/presentation/v1/bug-report.routes";
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
import {
  GetChatPingStatusUseCase,
  SendChatPingUseCase,
} from "@/modules/chat/application/use-cases/send-chat-ping.use-case";
import { ChatController } from "@/modules/chat/presentation/v1/chat.controller";
import { createChatRoutes } from "@/modules/chat/presentation/v1/chat.routes";
import { MintVoiceTokenUseCase } from "@/modules/voice/application/mint-voice-token.use-case";
import { MintTurnCredentialsUseCase } from "@/modules/voice/application/mint-turn-credentials.use-case";
import { RecordVoiceRoomEventUseCase } from "@/modules/voice/application/record-voice-room-event.use-case";
import { VoiceRoomEventsRepository } from "@/modules/voice/infrastructure/voice-room-events.repository";
import { GetVoiceRoomSummaryUseCase } from "@/modules/voice/application/get-voice-room-summary.use-case";
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
import { UploadPublicImageUseCase } from "@/modules/public-image/application/use-cases/upload-public-image.use-case";
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
import { PromoteJinyeImageUseCase } from "@/modules/jinye/application/use-cases/promote-jinye-image.use-case";
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

export function registerSocialRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {
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
    create: new CreateBugReportUseCase(
      bugReportRepo,
      di.auditRepo,
      di.explorationGroupNotifier,
    ),
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
      di.publicImageStorage,
      di.imageStorage,
      di.activityEvents,
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
      di.activityEvents,
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
  const chatMentions = new NotifyChatMentionsUseCase(
    di.userRepo,
    di.recordInbox,
    di.notifyUser,
    di.notificationPushCooldownRepo,
    di.notificationRepo,
  );
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
      chatMentions,
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
      chatMentions,
    ),
    new DeleteChatMessageUseCase(
      chatRepo,
      chatMirror,
      di.pronunciationStorage,
      chatMentions,
    ),
    new ListChatRevisionsUseCase(chatRepo),
    new GetChatPingStatusUseCase(chatRepo),
    new SendChatPingUseCase(
      chatRepo,
      di.userRepo,
      chatMirror,
      di.activityEvents,
      di.explorationGroupNotifier,
    ),
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
    new RecordVoiceRoomEventUseCase(
      voiceRoomEventsRepo,
      chatRepo,
      chatMirror,
      di.userRepo,
    ),
    new MintTurnCredentialsUseCase(),
    new GetVoiceRoomSummaryUseCase(di.appSettingsRepo),
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
  const takedownJinye = new TakedownJinyeUseCase(
    jinyeRepo,
    di.auditRepo,
    di.wordRepo,
    di.publicImageStorage,
  );
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
      env.IMAGEKIT_URL_ENDPOINT,
    ),
    listPublished: new ListPublishedJinyeUseCase(jinyeRepo, di.userRepo),
    getDetail: new GetJinyeDetailUseCase(jinyeRepo),
    deleteJinye: new DeleteJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.wordRepo,
      di.translationRepo,
      di.publicImageStorage,
    ),
    attachAudio: new AttachJinyeAudioUseCase(
      jinyeRepo,
      di.pronunciationStorage,
      di.auditRepo,
    ),
    uploadImage: new UploadPublicImageUseCase(di.publicImageStorage),
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
      env.IMAGEKIT_URL_ENDPOINT,
    ),
    createCommentAudio: new CreateJinyeCommentAudioUseCase(
      jinyeRepo,
      di.pronunciationStorage,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
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
      di.publicImageStorage,
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
    promoteImage: new PromoteJinyeImageUseCase(
      jinyeRepo,
      di.wordRepo,
      di.publicImageStorage,
      di.auditRepo,
      env.IMAGEKIT_URL_ENDPOINT,
    ),
    update: new UpdateJinyeUseCase(
      jinyeRepo,
      di.auditRepo,
      di.commentBlocklistRepo,
      di.recordAbuseSignal,
      di.activityEvents,
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
}
