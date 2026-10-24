import type {
  UsahaReport,
  UsahaReportWithUsaha,
} from './usaha-report.entity';

export interface UsahaReportRepository {
  create(input: {
    usahaId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<UsahaReport>;
  findById(id: string): Promise<UsahaReport | null>;
  findOpenByUser(usahaId: string, userId: string): Promise<UsahaReport | null>;
  list(status?: string): Promise<UsahaReportWithUsaha[]>;
  resolve(input: {
    id: string;
    status: 'resolved' | 'dismissed';
    resolution: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void>;
}
