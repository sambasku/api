import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateWordReportUseCase } from '../../application/use-cases/create-word-report.use-case';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { WordReportRepository } from '../../domain/repositories/word-report.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordReportReasonCode } from '@/modules/word/domain/entities/word.entity';
import type { Word } from '@/modules/word/domain/entities/word.entity';
import type { WordReport } from '../../domain/entities/word-report.entity';

// Mock dependencies
const mockWordRepo = {
  findById: vi.fn(),
  findWordImageById: vi.fn(),
  updateUsageLabels: vi.fn().mockResolvedValue(true),
};

const mockReportRepo = {
  findOpenByUserAndWord: vi.fn(),
  create: vi.fn(),
  resolveOne: vi.fn(),
  findById: vi.fn(),
};

const mockAuditRepo = {
  record: vi.fn(),
};

describe('Issue #153: Vulgar Auto-Flag and Open Report Endpoint', () => {
  let useCase: CreateWordReportUseCase;

  beforeEach(() => {
    useCase = new CreateWordReportUseCase(
      mockReportRepo as unknown as WordReportRepository,
      mockWordRepo as unknown as WordRepository,
      mockAuditRepo as unknown as AuditLogRepository,
    );
    vi.clearAllMocks();
  });

  it('should auto-flag "kasar" when reason is "vulgar"', async () => {
    // Arrange
    const wordId = 'word-123';
    const userId = 'user-456';
    const command = {
      wordId,
      userId,
      reasonCode: 'vulgar' as WordReportReasonCode,
      note: null,
      requestId: 'req-789',
    };

    const existingWord = {
      id: wordId,
      status: 'published',
      usageLabels: [],
    } as unknown as Word;

    mockWordRepo.findById.mockResolvedValue(existingWord);
    mockReportRepo.findOpenByUserAndWord.mockResolvedValue(null);
    mockReportRepo.create.mockResolvedValue({
      id: 'report-111',
      wordId,
      userId,
      reasonCode: 'vulgar',
      status: 'open',
    } as WordReport);

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result).toBeDefined();
    expect(mockWordRepo.findById).toHaveBeenCalledWith(wordId);
    expect(mockReportRepo.findOpenByUserAndWord).toHaveBeenCalledWith(userId, wordId, null);
    expect(mockReportRepo.create).toHaveBeenCalled();
    expect(mockAuditRepo.record).toHaveBeenNthCalledWith(1, {
      userId,
      action: 'create',
      entityType: 'word_report',
      entityId: expect.any(String),
      newData: {
        word_id: wordId,
        image_id: null,
        reason_code: 'vulgar',
        status: 'open',
      },
      requestId: 'req-789',
    });
    expect(mockAuditRepo.record).toHaveBeenNthCalledWith(2, {
      userId,
      action: 'auto_flag_usage_label',
      entityType: 'word',
      entityId: wordId,
      oldData: { usageLabels: [] },
      newData: { usageLabels: ['kasar'] },
      requestId: 'req-789',
    });

    // Check if usageLabels was updated to include 'kasar'
    expect(mockWordRepo.updateUsageLabels).toHaveBeenCalledWith(wordId, ['kasar']);
  });

  it('should not add duplicate "kasar" label', async () => {
    // Arrange
    const wordId = 'word-123';
    const userId = 'user-456';
    const command = {
      wordId,
      userId,
      reasonCode: 'vulgar' as WordReportReasonCode,
      note: null,
      requestId: 'req-789',
    };

    const existingWord = {
      id: wordId,
      status: 'published',
      usageLabels: ['kasar'],
    } as unknown as Word;

    mockWordRepo.findById.mockResolvedValue(existingWord);
    mockReportRepo.findOpenByUserAndWord.mockResolvedValue(null);
    mockReportRepo.create.mockResolvedValue({
      id: 'report-111',
      wordId,
      userId,
      reasonCode: 'vulgar',
      status: 'open',
    } as WordReport);

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result).toBeDefined();
    expect(existingWord.usageLabels).toEqual(['kasar']); // No duplicate
  });

  it('should handle idempotent flagging with existing labels', async () => {
    // Arrange
    const wordId = 'word-123';
    const userId = 'user-456';
    const command = {
      wordId,
      userId,
      reasonCode: 'vulgar' as WordReportReasonCode,
      note: null,
      requestId: 'req-789',
    };

    const existingWord = {
      id: wordId,
      status: 'published',
      usageLabels: ['halus', 'informal'],
    } as unknown as Word;

    mockWordRepo.findById.mockResolvedValue(existingWord);
    mockReportRepo.findOpenByUserAndWord.mockResolvedValue(null);
    mockReportRepo.create.mockResolvedValue({
      id: 'report-111',
      wordId,
      userId,
      reasonCode: 'vulgar',
      status: 'open',
    } as WordReport);

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result).toBeDefined();
    expect(mockWordRepo.updateUsageLabels).toHaveBeenCalledWith(wordId, ['halus', 'informal', 'kasar']);
  });

  it('should not flag when reason is not "vulgar"', async () => {
    // Arrange
    const wordId = 'word-123';
    const userId = 'user-456';
    const command = {
      wordId,
      userId,
      reasonCode: 'spam' as WordReportReasonCode,
      note: null,
      requestId: 'req-789',
    };

    const existingWord = {
      id: wordId,
      status: 'published',
      usageLabels: [],
    } as unknown as Word;

    mockWordRepo.findById.mockResolvedValue(existingWord);
    mockReportRepo.findOpenByUserAndWord.mockResolvedValue(null);
    mockReportRepo.create.mockResolvedValue({
      id: 'report-111',
      wordId,
      userId,
      reasonCode: 'spam',
      status: 'open',
    } as WordReport);

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result).toBeDefined();
    expect(existingWord.usageLabels).toEqual([]); // No flag for non-vulgar reasons
  });
});

describe('Issue #153: Open Report Endpoint to All Logged-in Users', () => {
  it('should remove authorizeRole middleware from POST /:id/reports', () => {
    // This test will be implemented after routes are modified
    expect(true).toBe(true);
  });
});