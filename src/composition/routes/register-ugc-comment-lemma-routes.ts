import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import type * as di from '../container';
import { createUgcCommentLemmaRoutes } from '@/modules/ugc-comment-lemma/presentation/ugc-comment-lemma-routes';
import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';

type Mount = {
  mount: string;
  anchorKind: UgcCommentAnchorKind;
  path: string;
  hostParam: string;
  commentParam: string;
};

const MOUNTS: Mount[] = [
  {
    mount: '/api/v1/words',
    anchorKind: 'word_comment',
    path: '/:wordId/comments/:commentId/lemma-links',
    hostParam: 'wordId',
    commentParam: 'commentId',
  },
  {
    mount: '/api/v1/places',
    anchorKind: 'place_comment',
    path: '/:id/comments/:commentId/lemma-links',
    hostParam: 'id',
    commentParam: 'commentId',
  },
  {
    mount: '/api/v1/usaha',
    anchorKind: 'usaha_comment',
    path: '/:id/comments/:commentId/lemma-links',
    hostParam: 'id',
    commentParam: 'commentId',
  },
  {
    mount: '/api/v1/culinary',
    anchorKind: 'cuisine_comment',
    path: '/:id/comments/:commentId/lemma-links',
    hostParam: 'id',
    commentParam: 'commentId',
  },
  {
    mount: '/api/v1/events',
    anchorKind: 'event_comment',
    path: '/:id/comments/:commentId/lemma-links',
    hostParam: 'id',
    commentParam: 'commentId',
  },
  {
    mount: '/api/v1/karya',
    anchorKind: 'karya_comment',
    path: '/:id/comments/:commentId/lemma-links',
    hostParam: 'id',
    commentParam: 'commentId',
  },
  {
    mount: '/api/v1/encyclopedia',
    anchorKind: 'article_comment',
    path: '/articles/:id/comments/:commentId/lemma-links',
    hostParam: 'id',
    commentParam: 'commentId',
  },
];

export function registerUgcCommentLemmaRoutes(
  app: OpenAPIHono<{ Variables: AppVariables }>,
  container: typeof di,
): void {
  const deps = {
    controller: container.ugcCommentLemmaController,
    authenticate: container.authenticate,
    requireApprovedClient: container.requireCommentWriteClient,
    requireLegalConsent: container.requireLegalConsent,
  };
  for (const m of MOUNTS) {
    app.route(
      m.mount,
      createUgcCommentLemmaRoutes(
        {
          anchorKind: m.anchorKind,
          path: m.path,
          hostParam: m.hostParam,
          commentParam: m.commentParam,
        },
        deps,
      ),
    );
  }
}