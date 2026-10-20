import { describe, expect, it, vi } from 'vitest';
import { SubmitWebImportUseCase } from '../../application/use-cases/web-import.use-cases';
import type { WebImportRepository } from '../../domain/repositories/web-import.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

describe('SubmitWebImportUseCase', () => {
  it('validates input and attributes to web import system user', async () => {
    const mockRepo: Partial<WebImportRepository> = {
      create: vi.fn().mockImplementation((input) => Promise.resolve({
        id: input.id,
        submittedBy: input.submittedBy,
        officerName: input.officerName,
        sourceLabel: input.sourceLabel,
        supportName: input.supportName,
        supportType: input.supportType,
        supportAddress: input.supportAddress,
        supportTitle: input.supportTitle,
        supportDesc: input.supportDesc,
        status: 'pending_review',
        totalRows: input.details.length,
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    const mockAudit: Partial<AuditLogRepository> = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    const uc = new SubmitWebImportUseCase(
      mockRepo as WebImportRepository,
      mockAudit as AuditLogRepository,
    );

    const result = await uc.execute({
      officerName: 'Pak Budi',
      sourceLabel: 'Kamus Sambas p.10',
      rows: [
        { kata: 'makatn', terjemahan: 'makan' },
        { kata: 'tidor', terjemahan: 'tidur', type: 'kk' },
      ],
    });

    expect(result.status).toBe('pending_review');
    expect(result.totalRows).toBe(2);
    expect(result.officerName).toBe('Pak Budi');
    expect(mockRepo.create).toHaveBeenCalledOnce();
  });

  it('rejects submissions with no rows', async () => {
    const uc = new SubmitWebImportUseCase(
      {} as WebImportRepository,
      {} as AuditLogRepository,
    );

    await expect(
      uc.execute({
        officerName: 'Pak Budi',
        rows: [],
      }),
    ).rejects.toThrow('Minimal satu baris kata harus diisi');
  });

  it('rejects submissions with short officer name', async () => {
    const uc = new SubmitWebImportUseCase(
      {} as WebImportRepository,
      {} as AuditLogRepository,
    );

    await expect(
      uc.execute({
        officerName: 'A',
        rows: [{ kata: 'makatn', terjemahan: 'makan' }],
      }),
    ).rejects.toThrow('Nama petugas wajib diisi');
  });
});
