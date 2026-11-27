import { describe, expect, it } from 'vitest';
import {
  isTrustedJinyeImage,
  jinyeImageProvider,
} from '../../application/utils/jinye-image-trust';

const GH_URL =
  'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/jinye/01HABCDEF.jpg';
const IK = 'https://ik.imagekit.io/sambasku';

describe('isTrustedJinyeImage', () => {
  it('terima file GitHub hasil upload Jinye', () => {
    expect(
      isTrustedJinyeImage({ url: GH_URL, providerFileId: 'assets/jinye/01HABCDEF.jpg' }, IK),
    ).toBe(true);
  });

  it('tolak path di luar assets/jinye', () => {
    expect(
      isTrustedJinyeImage(
        {
          url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/words/x.jpg',
          providerFileId: 'assets/words/x.jpg',
        },
        IK,
      ),
    ).toBe(false);
  });

  it('tolak url GitHub yang tidak cocok dengan providerFileId', () => {
    expect(
      isTrustedJinyeImage({ url: GH_URL, providerFileId: 'assets/jinye/OTHER.jpg' }, IK),
    ).toBe(false);
  });

  it('tolak host sembarang di url meski path assets/jinye', () => {
    expect(
      isTrustedJinyeImage(
        {
          url: 'https://evil.example/assets/jinye/01HABCDEF.jpg',
          providerFileId: 'assets/jinye/01HABCDEF.jpg',
        },
        IK,
      ),
    ).toBe(false);
  });

  it('tolak query string tambahan di url GitHub', () => {
    expect(
      isTrustedJinyeImage(
        { url: `${GH_URL}?x=1`, providerFileId: 'assets/jinye/01HABCDEF.jpg' },
        IK,
      ),
    ).toBe(false);
  });

  it('terima ImageKit lama hanya dari host endpoint kita', () => {
    expect(
      isTrustedJinyeImage({ url: `${IK}/jinye/a.jpg`, providerFileId: 'fileKitA' }, IK),
    ).toBe(true);
    expect(
      isTrustedJinyeImage(
        { url: 'https://169.254.169.254/latest/meta-data', providerFileId: 'fileKitA' },
        IK,
      ),
    ).toBe(false);
  });

  it('tolak ImageKit bila endpoint tidak dikonfigurasi', () => {
    expect(
      isTrustedJinyeImage({ url: `${IK}/jinye/a.jpg`, providerFileId: 'fileKitA' }, undefined),
    ).toBe(false);
  });
});

describe('jinyeImageProvider', () => {
  it('assets/ = github, selain itu imagekit', () => {
    expect(jinyeImageProvider('assets/jinye/x.jpg')).toBe('github');
    expect(jinyeImageProvider('65abc')).toBe('imagekit');
  });
});
