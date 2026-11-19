import type {
  WordViewReport,
  WordViewsRepository,
} from '../../domain/repositories/word-views.repository';

export class RecordWordViewByIdUseCase {
  constructor(private readonly repo: WordViewsRepository) {}

  execute(wordId: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewById(wordId, viewerKey);
  }
}

export class RecordWordViewByLemmaUseCase {
  constructor(private readonly repo: WordViewsRepository) {}

  execute(lemma: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewByLemma(lemma, viewerKey);
  }
}

export class ListWordViewsUseCase {
  constructor(private readonly repo: WordViewsRepository) {}

  execute(days: number | null): Promise<Map<string, number>> {
    return this.repo.viewTotals(days);
  }
}

export class GetWordViewReportUseCase {
  constructor(private readonly repo: WordViewsRepository) {}

  execute(days: number): Promise<WordViewReport> {
    return this.repo.viewReport(days);
  }
}
