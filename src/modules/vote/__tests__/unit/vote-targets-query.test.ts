import { describe, it, expect } from 'vitest';
import { targetsQuerySchema } from '@/modules/vote/presentation/v1/validators/vote.validator';

const id = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

describe('targetsQuerySchema', () => {
  it('menerima pantun dan balasan pantun (regresi #367)', () => {
    const parsed = targetsQuerySchema.parse({
      targets: `pantun:${id('01PANTUN')},pantun_reply:${id('01REPLY')}`,
    });
    expect(parsed.targets).toEqual([
      { entityType: 'pantun', entityId: id('01PANTUN') },
      { entityType: 'pantun_reply', entityId: id('01REPLY') },
    ]);
  });

  it('tetap menerima tipe lama (word, meaning, comment)', () => {
    const parsed = targetsQuerySchema.parse({
      targets: `word:${id('01W')},meaning:${id('01M')},comment:${id('01C')}`,
    });
    expect(parsed.targets.map((t) => t.entityType)).toEqual(['word', 'meaning', 'comment']);
  });

  it('menolak tipe yang tidak ada di enum', () => {
    expect(() =>
      targetsQuerySchema.parse({ targets: `bogus:${id('01X')}` }),
    ).toThrow();
  });

  it('menolak id yang bukan 26 karakter', () => {
    expect(() => targetsQuerySchema.parse({ targets: 'pantun:pendek' })).toThrow();
  });
});
