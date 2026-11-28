import { describe, it, expect } from 'vitest';
import {
  addMonthsToPeriode,
  dueDate,
  generatePeriodes,
  isOverdue,
  isPeriodeInSchedule,
  nextPeriodeAfterLunas,
  periodeStatus,
  sisaPokok,
  todayJakarta,
} from '../../domain/cashflow-rules';

describe('cashflow-rules', () => {
  describe('periode', () => {
    it('menambah bulan lintas tahun', () => {
      expect(addMonthsToPeriode('2026-12', 1)).toBe('2027-01');
      expect(addMonthsToPeriode('2026-01', 12)).toBe('2027-01');
    });
  });

  describe('generatePeriodes', () => {
    it('bulanan: setiap bulan sampai periode batas', () => {
      const periodes = generatePeriodes(
        { recurrence: 'bulanan', periodeMulai: '2026-10', berhentiPer: null },
        '2027-01',
      );
      expect(periodes).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    });

    it('tahunan: setiap 12 bulan mengikuti bulan periodeMulai', () => {
      const periodes = generatePeriodes(
        { recurrence: 'tahunan', periodeMulai: '2026-03', berhentiPer: null },
        '2028-06',
      );
      expect(periodes).toEqual(['2026-03', '2027-03', '2028-03']);
    });

    it('sekali: hanya periode pertama', () => {
      expect(
        generatePeriodes({ recurrence: 'sekali', periodeMulai: '2026-05', berhentiPer: null }, '2030-01'),
      ).toEqual(['2026-05']);
    });

    it('berhenti_per menghentikan periode setelah bulan itu', () => {
      const periodes = generatePeriodes(
        { recurrence: 'bulanan', periodeMulai: '2026-10', berhentiPer: '2026-12-05' },
        '2027-06',
      );
      expect(periodes).toEqual(['2026-10', '2026-11', '2026-12']);
    });

    it('periode belum dimulai menghasilkan daftar kosong', () => {
      expect(
        generatePeriodes({ recurrence: 'bulanan', periodeMulai: '2027-01', berhentiPer: null }, '2026-12'),
      ).toEqual([]);
    });
  });

  describe('isPeriodeInSchedule', () => {
    it('menolak periode di luar jadwal dan format salah', () => {
      const schedule = { recurrence: 'bulanan' as const, periodeMulai: '2026-10', berhentiPer: null };
      expect(isPeriodeInSchedule(schedule, '2026-11')).toBe(true);
      expect(isPeriodeInSchedule(schedule, '2026-09')).toBe(false);
      expect(isPeriodeInSchedule(schedule, '2026-13')).toBe(false);
    });
  });

  describe('dueDate', () => {
    it('tanggal 31 di bulan Februari dibulatkan ke akhir bulan', () => {
      expect(dueDate('2027-02', 31)).toBe('2027-02-28');
      expect(dueDate('2028-02', 31)).toBe('2028-02-29');
    });

    it('tanggal biasa tetap', () => {
      expect(dueDate('2026-12', 5)).toBe('2026-12-05');
    });
  });

  describe('periodeStatus', () => {
    it('cicilan: sebagian lalu lunas dari total pembayaran', () => {
      expect(periodeStatus(0, 300_000)).toBe('belum');
      expect(periodeStatus(200_000, 300_000)).toBe('sebagian');
      expect(periodeStatus(300_000, 300_000)).toBe('lunas');
      expect(periodeStatus(350_000, 300_000)).toBe('lunas');
    });
  });

  describe('nextPeriodeAfterLunas', () => {
    it('periode setelah lunas terakhir, atau periode pertama jika belum ada yang lunas', () => {
      const periodes = ['2026-10', '2026-11', '2026-12', '2027-01'];
      expect(nextPeriodeAfterLunas(periodes, new Set())).toBe('2026-10');
      expect(nextPeriodeAfterLunas(periodes, new Set(['2026-10', '2026-11']))).toBe('2026-12');
      expect(nextPeriodeAfterLunas(periodes, new Set(periodes))).toBeNull();
    });

    it('koreksi pembayaran memundurkan jadwal', () => {
      const periodes = ['2026-10', '2026-11', '2026-12'];
      expect(nextPeriodeAfterLunas(periodes, new Set(['2026-10', '2026-11']))).toBe('2026-12');
      expect(nextPeriodeAfterLunas(periodes, new Set(['2026-10']))).toBe('2026-11');
    });
  });

  describe('isOverdue', () => {
    it('terlewat hanya jika jatuh tempo lewat dan belum lunas', () => {
      expect(isOverdue('2026-12-05', '2026-12-10', 'belum')).toBe(true);
      expect(isOverdue('2026-12-05', '2026-12-10', 'sebagian')).toBe(true);
      expect(isOverdue('2026-12-05', '2026-12-10', 'lunas')).toBe(false);
      expect(isOverdue('2026-12-15', '2026-12-10', 'belum')).toBe(false);
    });
  });

  describe('sisaPokok', () => {
    it('tidak pernah negatif', () => {
      expect(sisaPokok(150_000, 50_000)).toBe(100_000);
      expect(sisaPokok(150_000, 150_000)).toBe(0);
      expect(sisaPokok(150_000, 200_000)).toBe(0);
    });
  });

  describe('todayJakarta', () => {
    it('memakai tanggal Asia/Jakarta, bukan UTC', () => {
      // 2026-11-27 18:30 UTC = 2026-11-28 01:30 WIB
      expect(todayJakarta(new Date('2026-11-27T18:30:00Z'))).toBe('2026-11-28');
    });
  });
});
