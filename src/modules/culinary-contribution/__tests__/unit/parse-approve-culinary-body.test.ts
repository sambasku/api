import { describe, expect, it, vi } from 'vitest';
import type { Context } from 'hono';
import { ValidationError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import {
  CulinaryContributionController,
  parseApproveCulinaryBody,
} from '../../presentation/v1/culinary-contribution.controller';

describe('parseApproveCulinaryBody', () => {
  it('body kosong / undefined field = tidak override images', () => {
    expect(parseApproveCulinaryBody({})).toEqual({});
    expect(parseApproveCulinaryBody(undefined)).toEqual({});
    expect(parseApproveCulinaryBody(null)).toEqual({});
  });

  it('images wire (is_main) di-map ke domain (isMain)', () => {
    const out = parseApproveCulinaryBody({
      images: [
        {
          url: 'https://cdn.example/a.jpg',
          is_main: true,
          attribution: { name: 'Admin', license_url: 'https://creativecommons.org/licenses/' },
        },
      ],
    });
    expect(out.images).toEqual([
      {
        url: 'https://cdn.example/a.jpg',
        isMain: true,
        attribution: {
          name: 'Admin',
          provider: undefined,
          url: undefined,
          license: undefined,
          license_url: 'https://creativecommons.org/licenses/',
        },
      },
    ]);
  });

  it('images: [] tetap dianggap override (bukan kosong-undefined)', () => {
    expect(parseApproveCulinaryBody({ images: [] })).toEqual({ images: [] });
  });

  it('field asing ditolak (strict)', () => {
    expect(() => parseApproveCulinaryBody({ foo: 1 })).toThrow(ValidationError);
  });
});

describe('CulinaryContributionController.approve - empty body', () => {
  it('POST tanpa body (json() reject) tidak melempar; use-case dipanggil tanpa override', async () => {
    const approve = vi.fn().mockResolvedValue(undefined);
    const controller = new CulinaryContributionController({
      approve,
    } as never);

    const json = vi.fn().mockResolvedValue({ success: true, data: null });
    const c = {
      req: {
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
      },
      get: vi.fn((key: string) => (key === 'user' ? { user_id: 'ADMIN1' } : 'REQ1')),
      json,
    } as unknown as Context<{ Variables: AppVariables }>;

    await expect(controller.approve(c, 'C1')).resolves.toBeDefined();
    expect(approve).toHaveBeenCalledWith('C1', 'ADMIN1', 'REQ1', undefined);
  });
});
