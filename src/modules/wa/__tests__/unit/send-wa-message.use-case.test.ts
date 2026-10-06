import { describe, expect, it, vi } from 'vitest';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { WaTemplateParam } from '../../domain/entities/wa-message.entity';
import type {
  WaMessageLogRepository,
  WaTemplateRepository,
  WaUsageRepository,
} from '../../domain/repositories/wa-message.repository';
import type { WaSenderPort } from '../../application/ports/wa-sender.port';
import {
  SendWaMessageUseCase,
  renderWaBody,
  toPositionalParams,
} from '../../application/use-cases/send-wa-message.use-case';
import { currentPeriodStart } from '../../infrastructure/wa-message.repository.impl';

const TPL_PARAMS: WaTemplateParam[] = [
  { name: 'displayName', description: 'Nama' },
  { name: 'reasonRejected', description: 'Alasan' },
  { name: 'ctaUrl', description: 'Link grup' },
];

function makeDeps(overrides: {
  sender?: Partial<WaSenderPort>;
  usage?: { usedCount: number; limitCount: number };
  template?: { enabled: boolean } | null;
  configured?: boolean;
} = {}) {
  const sender = {
    provider: 'kapso',
    isConfigured: () => overrides.configured ?? true,
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides.sender,
  } as unknown as WaSenderPort & { isConfigured: () => boolean };
  const usageRepo = {
    getActive: vi.fn().mockResolvedValue({
      provider: 'kapso',
      usedCount: overrides.usage?.usedCount ?? 0,
      limitCount: overrides.usage?.limitCount ?? 2000,
      warnThresholdPercent: 80,
      periodStart: new Date(),
      updatedAt: null,
      updatedBy: null,
    }),
    increment: vi.fn().mockResolvedValue(undefined),
    setUsage: vi.fn().mockResolvedValue(undefined),
  } as unknown as WaUsageRepository;
  const logRepo = {
    record: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  } as unknown as WaMessageLogRepository;
  const templateRepo = {
    list: vi.fn().mockResolvedValue([]),
    getByKey: vi.fn().mockResolvedValue(
      overrides.template === null
        ? null
        : {
            id: 'tpl1',
            eventKey: 'verifier_application_rejected',
            enabled: overrides.template?.enabled ?? true,
            metaTemplateName: 'verifier_rejected',
            metaTemplateLanguage: 'id',
            body: 'Hai {{displayName}}, {{reasonRejected}}. Gabung: {{ctaUrl}}',
            params: TPL_PARAMS,
            updatedAt: null,
            updatedBy: null,
          },
    ),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as WaTemplateRepository;
  const settingsRepo = {
    getByKeys: vi.fn().mockResolvedValue([
      { key: 'wa.verifier_enabled', value: 'true' },
      { key: 'wa.group_cta_url', value: 'https://chat.whatsapp.com/abc' },
    ]),
  } as unknown as AppSettingsRepository;

  return {
    sender,
    usageRepo,
    logRepo,
    templateRepo,
    settingsRepo,
    useCase: new SendWaMessageUseCase([{ sender }], usageRepo, logRepo, templateRepo, settingsRepo),
  };
}

describe('renderWaBody', () => {
  it('mengganti placeholder bernama', () => {
    expect(renderWaBody('Hai {{displayName}}, alasan: {{reasonRejected}}', {
      displayName: 'Siti',
      reasonRejected: 'Screenshot kurang',
    })).toBe('Hai Siti, alasan: Screenshot kurang');
  });

  it('membiarkan placeholder tak dikenal', () => {
    expect(renderWaBody('Hai {{namaLain}}', {})).toBe('Hai {{namaLain}}');
  });
});

describe('toPositionalParams', () => {
  it('urutan mengikuti params template, missing jadi string kosong', () => {
    expect(toPositionalParams(TPL_PARAMS, { displayName: 'Siti', ctaUrl: 'https://x' })).toEqual([
      'Siti',
      '',
      'https://x',
    ]);
  });
});

describe('SendWaMessageUseCase', () => {
  const cmd = {
    eventKey: 'verifier_application_rejected',
    toPhone: '6281234567890',
    channel: 'template' as const,
    template: {
      eventKey: 'verifier_application_rejected',
      params: { displayName: 'Siti', reasonRejected: 'kurang bukti', ctaUrl: 'https://wa.link/x' },
    },
  };

  it('sukses: kirim + increment usage + log sent', async () => {
    const { useCase, sender, usageRepo, logRepo } = makeDeps();
    const result = await useCase.execute(cmd);
    expect(result.sent).toBe(true);
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'template',
        templateName: 'verifier_rejected',
        positionalParams: ['Siti', 'kurang bukti', 'https://wa.link/x'],
      }),
    );
    expect(usageRepo.increment).toHaveBeenCalledWith('kapso', 1);
    expect(logRepo.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
  });

  it('quota habis: tidak kirim, log failed', async () => {
    const { useCase, sender, logRepo } = makeDeps({ usage: { usedCount: 2000, limitCount: 2000 } });
    const result = await useCase.execute(cmd);
    expect(result.sent).toBe(false);
    expect(sender.send).not.toHaveBeenCalled();
    expect(logRepo.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('template nonaktif: skip tanpa kirim', async () => {
    const { useCase, sender, usageRepo } = makeDeps({ template: { enabled: false } });
    const result = await useCase.execute(cmd);
    expect(result.sent).toBe(false);
    expect(sender.send).not.toHaveBeenCalled();
    expect(usageRepo.increment).not.toHaveBeenCalled();
  });

  it('env belum dikonfigurasi: skip', async () => {
    const { useCase, sender } = makeDeps({ configured: false });
    const result = await useCase.execute(cmd);
    expect(result.sent).toBe(false);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('nomor invalid: skip tanpa kirim (semua jalur, bukan hanya test)', async () => {
    const { useCase, sender, usageRepo } = makeDeps();
    const result = await useCase.execute({ ...cmd, toPhone: '08123' });
    expect(result.sent).toBe(false);
    expect(sender.send).not.toHaveBeenCalled();
    expect(usageRepo.increment).not.toHaveBeenCalled();
  });

  it('param wajib kosong: skip tanpa buang quota', async () => {
    const { useCase, sender } = makeDeps();
    const result = await useCase.execute({
      ...cmd,
      template: { eventKey: cmd.template.eventKey, params: { displayName: 'Siti', reasonRejected: '', ctaUrl: 'x' } },
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain('reasonRejected');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('param total > 1024 char: skip (batas Meta)', async () => {
    const { useCase, sender } = makeDeps();
    const result = await useCase.execute({
      ...cmd,
      template: {
        eventKey: cmd.template.eventKey,
        params: { displayName: 'a'.repeat(600), reasonRejected: 'b'.repeat(500), ctaUrl: 'https://x' },
      },
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain('1024');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('test send: nomor invalid ditolak', async () => {
    const { useCase } = makeDeps();
    await expect(useCase.sendTest('08123', 'teks', 'tpl')).rejects.toThrow();
  });

  it('readWaSettings: baca flag + fallback cta default', async () => {
    const { useCase, settingsRepo } = makeDeps();
    (settingsRepo.getByKeys as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'wa.verifier_enabled', value: 'false' },
    ]);
    const s = await useCase.readWaSettings();
    expect(s.enabled).toBe(false);
    expect(s.ctaUrl).toContain('chat.whatsapp.com');
  });
});

describe('currentPeriodStart (reset bulanan WIB)', () => {
  it('tanggal 1 jam 23 WIB → periode tanggal 1 bulan itu', () => {
    // 2026-11-01 16:00 UTC = 2026-11-01 23:00 WIB
    const p = currentPeriodStart(new Date('2026-11-01T16:00:00Z'));
    expect(p.toISOString()).toBe('2026-10-31T17:00:00.000Z'); // 1 Nov 00:00 WIB
  });

  it('tengah bulan → periode tanggal 1 bulan berjalan', () => {
    const p = currentPeriodStart(new Date('2026-11-15T03:00:00Z'));
    expect(p.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });
});
