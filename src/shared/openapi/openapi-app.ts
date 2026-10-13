import { OpenAPIHono } from '@hono/zod-openapi';
import type { z } from 'zod';
import type { AppVariables } from '@/shared/types';
import { env } from '@/shared/config/env';

// Factory app OpenAPIHono dengan defaultHook: error validasi Zod otomatis
// dibungkus envelope standar (VALIDATION_ERROR + details per field).
export function createOpenApiApp() {
  return new OpenAPIHono<{ Variables: AppVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        // Pesan Zod (en-US, teknis) hanya untuk env non-prod. Di production
        // diganti generik supaya toast user tidak menyalahkan isian user.
        const isProd = env.NODE_ENV === 'production';
        return c.json(
          {
            success: false as const,
            error_code: 'VALIDATION_ERROR',
            message: 'Beberapa isian belum sesuai, coba periksa lagi ya.',
            details: (result.error as z.ZodError).issues.map((issue) => ({
              field: issue.path.join('.'),
              message: isProd ? 'Terjadi kendala pada isian ini.' : issue.message,
            })),
          },
          400,
        );
      }
    },
  });
}
