import type {
  CulinaryReport,
  CulinaryReportWithTarget,
} from './culinary-report.entity';

export interface CulinaryReportRepository {
  create(input: {
    targetType: 'cuisine' | 'place';
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<CulinaryReport>;
  findById(id: string): Promise<CulinaryReport | null>;
  findOpenByUser(
    targetType: 'cuisine' | 'place',
    targetId: string,
    userId: string,
  ): Promise<CulinaryReport | null>;
  list(status?: string): Promise<CulinaryReportWithTarget[]>;
  resolve(input: {
    id: string;
    status: 'resolved' | 'dismissed';
    resolution: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void>;
}
