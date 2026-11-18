import { BadRequestError, ValidationError } from '@/shared/errors/app-error';
import {
  CONTENT_LINK_CAP,
  canonicalizePair,
  isContentLinkKind,
  type ContentLinkEndpoint,
  type ContentLinkKind,
  type ContentLinkRef,
  type ResolvedContentLink,
} from '../domain/content-link';
import type { ContentLinkRepository } from '../domain/content-link.repository';
import { ResolveContentLinks } from './resolve-content-links';

function otherEndpoint(
  row: { aKind: ContentLinkKind; aId: string; bKind: ContentLinkKind; bId: string },
  anchor: ContentLinkEndpoint,
): ContentLinkEndpoint {
  if (row.aKind === anchor.kind && row.aId === anchor.id) {
    return { kind: row.bKind, id: row.bId };
  }
  return { kind: row.aKind, id: row.aId };
}

/** Baca kartu terkait untuk satu entitas (satu list edges + resolve batch). */
export class ListRelatedContentUseCase {
  constructor(
    private readonly repo: ContentLinkRepository,
    private readonly resolver: ResolveContentLinks,
  ) {}

  async execute(
    kind: ContentLinkKind,
    id: string,
  ): Promise<ResolvedContentLink[]> {
    const rows = await this.repo.listForEndpoint(kind, id);
    if (rows.length === 0) return [];
    const anchor: ContentLinkEndpoint = { kind, id };
    const endpoints = rows.map((row) => otherEndpoint(row, anchor));
    const resolved = await this.resolver.resolveEndpoints(endpoints);
    // Pertahankan urutan edge; drop yang tidak tayang.
    const byId = new Map(resolved.map((r) => [`${r.kind}:${r.id}`, r]));
    const out: ResolvedContentLink[] = [];
    for (const ep of endpoints) {
      const card = byId.get(`${ep.kind}:${ep.id}`);
      if (card) out.push(card);
    }
    return out;
  }
}

/**
 * Replace-set tautan untuk satu anchor.
 * Ref boleh id atau slug; yang tidak resolve / self / duplikat dibuang
 * dengan error jelas bila ada invalid kind atau cap terlewati.
 */
export class ReplaceContentLinksUseCase {
  constructor(
    private readonly repo: ContentLinkRepository,
    private readonly resolver: ResolveContentLinks,
  ) {}

  async execute(input: {
    anchor: ContentLinkEndpoint;
    related: ContentLinkRef[];
    createdBy: string | null;
  }): Promise<ResolvedContentLink[]> {
    const { anchor, related, createdBy } = input;

    if (!isContentLinkKind(anchor.kind)) {
      throw new ValidationError([
        { field: 'kind', message: 'Jenis konten tidak didukung' },
      ]);
    }
    if (related.length > CONTENT_LINK_CAP) {
      throw new ValidationError([
        {
          field: 'related',
          message: `Maksimal ${CONTENT_LINK_CAP} tautan terkait`,
        },
      ]);
    }

    for (const ref of related) {
      if (!isContentLinkKind(ref.kind)) {
        throw new ValidationError([
          { field: 'related', message: `Jenis ${ref.kind} tidak didukung` },
        ]);
      }
      if (!ref.id && !ref.slug) {
        throw new BadRequestError(
          'RELATED_REF_EMPTY',
          'Setiap tautan butuh id atau slug',
        );
      }
    }

    const resolvedTargets = await this.resolver.resolve(related);
    if (resolvedTargets.length !== related.length) {
      throw new BadRequestError(
        'RELATED_NOT_FOUND',
        'Satu atau lebih tautan tidak ditemukan atau belum tayang',
      );
    }

    const seen = new Set<string>();
    const pairs: Array<{ a: ContentLinkEndpoint; b: ContentLinkEndpoint }> = [];
    for (const target of resolvedTargets) {
      const key = `${target.kind}:${target.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pair = canonicalizePair(anchor, {
        kind: target.kind,
        id: target.id,
      });
      if (!pair) {
        throw new BadRequestError(
          'RELATED_SELF',
          'Konten tidak bisa ditautkan ke dirinya sendiri',
        );
      }
      pairs.push(pair);
    }

    if (pairs.length > CONTENT_LINK_CAP) {
      throw new ValidationError([
        {
          field: 'related',
          message: `Maksimal ${CONTENT_LINK_CAP} tautan terkait`,
        },
      ]);
    }

    await this.repo.replaceForAnchor({ anchor, pairs, createdBy });
    return resolvedTargets.filter((t, i, arr) => {
      const k = `${t.kind}:${t.id}`;
      return arr.findIndex((x) => `${x.kind}:${x.id}` === k) === i;
    });
  }
}
