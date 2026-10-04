import { describe, expect, it } from 'vitest';
import { derivePrimaryRole, ROLE_RANK } from '../../domain/entities/user.entity';

describe('derivePrimaryRole', () => {
  it('role tertinggi menang di semua urutan array', () => {
    expect(derivePrimaryRole(['contributor', 'admin', 'editor'])).toBe('admin');
    expect(derivePrimaryRole(['editor', 'root', 'reviewer'])).toBe('root');
    expect(derivePrimaryRole(['reviewer'])).toBe('reviewer');
    expect(derivePrimaryRole(['contributor'])).toBe('contributor');
  });

  it('array kosong fallback contributor (paling terbatas)', () => {
    expect(derivePrimaryRole([])).toBe('contributor');
  });

  it('ROLE_RANK: root > admin > reviewer > editor > contributor', () => {
    expect(ROLE_RANK.root).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.reviewer);
    expect(ROLE_RANK.reviewer).toBeGreaterThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeGreaterThan(ROLE_RANK.contributor);
  });
});
