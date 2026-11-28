import { z } from 'zod';

export const devicePlatformSchema = z.enum(['android', 'ios']);

export const registerDeviceTokenSchema = z.object({
  udid: z.string().min(1).max(255),
  fcm_token: z.string().min(1).max(4096),
  platform: devicePlatformSchema.default('android'),
});

export type RegisterDeviceTokenBody = z.infer<typeof registerDeviceTokenSchema>;

export const revokeDeviceTokenSchema = z.object({
  udid: z.string().min(1).max(255),
});

export type RevokeDeviceTokenBody = z.infer<typeof revokeDeviceTokenSchema>;

export const deviceTokenMutationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    udid: z.string(),
    platform: devicePlatformSchema.optional(),
    fcm_token_registered: z.boolean().optional(),
    revoked: z.boolean().optional(),
  }),
});
