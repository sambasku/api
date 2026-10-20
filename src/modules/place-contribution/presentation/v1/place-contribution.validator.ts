import { z } from 'zod';
import { createPlaceBodySchema } from '@/modules/place/presentation/v1/validators/place.validator';

export const submitContributionBodySchema = createPlaceBodySchema
  .omit({ id: true, author_id: true, status: true, sources: true, related: true })
  .extend({
    place_id: z.string().min(1).max(64).nullable().optional(),
    images: z
      .array(
        z.object({
          url: z.string().url().startsWith('https://'),
          is_main: z.boolean().optional(),
        }),
      )
      .max(20)
      .optional(),
  });

export const contributionStatusQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});
