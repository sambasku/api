import { describe, expect, it } from 'vitest';
import {
  buildImageKitSignedUrl,
  imageKitPathAfterEndpoint,
} from '../../infrastructure/imagekit-signed-url';

describe('imageKitPathAfterEndpoint', () => {
  it('potong endpoint dengan trailing slash', () => {
    expect(
      imageKitPathAfterEndpoint(
        'https://ik.imagekit.io/akun/baleho/payment-proofs/a.jpg',
        'https://ik.imagekit.io/akun/',
      ),
    ).toBe('baleho/payment-proofs/a.jpg');
  });

  it('tolak URL di luar endpoint', () => {
    expect(() =>
      imageKitPathAfterEndpoint(
        'https://cdn.example.com/x.jpg',
        'https://ik.imagekit.io/akun',
      ),
    ).toThrow(/IMAGEKIT_URL_ENDPOINT/);
  });
});

describe('buildImageKitSignedUrl', () => {
  it('menambah ik-t dan ik-s deterministik', async () => {
    const url = await buildImageKitSignedUrl({
      url: 'https://ik.imagekit.io/akun/baleho/payment-proofs/a.jpg',
      urlEndpoint: 'https://ik.imagekit.io/akun',
      privateKey: 'private_test_key',
      expiresInSeconds: 60,
      nowSec: 1_700_000_000,
    });
    expect(url).toMatch(
      /^https:\/\/ik\.imagekit\.io\/akun\/baleho\/payment-proofs\/a\.jpg\?ik-t=1700000060&ik-s=[0-9a-f]{40}$/,
    );
  });
});
