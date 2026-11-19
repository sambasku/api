/** Mount semua route domain (lihat `composition/routes/`). */
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppVariables } from '@/shared/types';
import { registerCoreRoutes } from './routes/register-core-routes';
import { registerDictionaryRoutes } from './routes/register-dictionary-routes';
import { registerExploreRoutes } from './routes/register-explore-routes';
import { registerSocialRoutes } from './routes/register-social-routes';
import { registerCommunityRoutes } from './routes/register-community-routes';

export function registerRoutes(app: OpenAPIHono<{ Variables: AppVariables }>): void {
  registerCoreRoutes(app);
  registerDictionaryRoutes(app);
  registerExploreRoutes(app);
  registerSocialRoutes(app);
  registerCommunityRoutes(app);
}
