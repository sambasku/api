import { describe, expect, it, vi } from 'vitest';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { AppendCuisineImagesUseCase } from '../../application/use-cases/culinary.use-cases';
import type { CulinaryRepository } from '../../domain/repositories/culinary.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { CuisineDetail } from '../../domain/entities/culinary.entity';

const PHOTO =
  'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/culinary/a.webp';
const PHOTO_B =
  'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/culinary/b.webp';

function cuisine(over: Partial<CuisineDetail> = {}): CuisineDetail {
  return {
    id: 'C1',
    slug: 'bubur-pedas',
    name: 'Bubur Pedas',
    description: null,
    categoryId: null,
    category: null,
    originRegion: null,
    images: [],
    ingredients: [],
    servingSuggestion: null,
    tags: [],
    sources: [],
    license: null,
    publishStatus: 'published',
    restrictedReason: null,
    restrictedAt: null,
    authorId: null,
    author: null,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: null,
    places: [],
    ...over,
  };
}

describe('AppendCuisineImagesUseCase #281', () => {
  it('append URL ke images_json + catat cuisine_photo_added', async () => {
    const updateCuisine = vi.fn().mockResolvedValue(cuisine());
    const repo = {
      findCuisineBySlug: vi.fn().mockResolvedValue(cuisine()),
      updateCuisine,
    } as unknown as CulinaryRepository;
    const users = {
      findById: vi.fn().mockResolvedValue({
        id: 'U1',
        username: 'warga',
        displayName: 'Warga',
      }),
    } as unknown as UserRepository;
    const activity = {
      safe: vi.fn().mockResolvedValue(undefined),
    } as unknown as RecordActivityEventUseCase;

    await new AppendCuisineImagesUseCase(repo, users, activity).execute(
      'bubur-pedas',
      'U1',
      [PHOTO, PHOTO_B],
    );

    expect(updateCuisine).toHaveBeenCalledOnce();
    const arg = updateCuisine.mock.calls[0][0] as { imagesJson: string };
    const parsed = JSON.parse(arg.imagesJson) as Array<{
      url: string;
      isMain: boolean;
      attribution: { authorId?: string; license?: string };
    }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0].url).toBe(PHOTO);
    expect(parsed[0].isMain).toBe(true);
    expect(parsed[0].attribution.authorId).toBe('U1');
    expect(parsed[0].attribution.license).toBe('CC BY-SA 4.0');
    expect(parsed[1].isMain).toBe(false);
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'cuisine_photo_added',
        actorId: 'U1',
        targetId: 'C1',
        dedupeKey: `cuisine_photo:C1:${PHOTO}|${PHOTO_B}`,
      }),
    );
  });

  it('tolak anonim', async () => {
    const repo = {
      findCuisineBySlug: vi.fn(),
    } as unknown as CulinaryRepository;
    const users = { findById: vi.fn() } as unknown as UserRepository;
    await expect(
      new AppendCuisineImagesUseCase(repo, users).execute(
        'x',
        ANONIM_USER_ID,
        [PHOTO],
      ),
    ).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' });
  });

  it('tolak URL di luar assets/culinary', async () => {
    const repo = {
      findCuisineBySlug: vi.fn().mockResolvedValue(cuisine()),
    } as unknown as CulinaryRepository;
    const users = {
      findById: vi.fn().mockResolvedValue({
        id: 'U1',
        username: 'warga',
        displayName: 'Warga',
      }),
    } as unknown as UserRepository;
    await expect(
      new AppendCuisineImagesUseCase(repo, users).execute('bubur-pedas', 'U1', [
        'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/x.webp',
      ]),
    ).rejects.toMatchObject({ errorCode: 'IMAGE_URL' });
  });
});
