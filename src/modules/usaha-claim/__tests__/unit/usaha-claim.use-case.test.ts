import { describe, it, expect, vi } from "vitest";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/shared/errors/app-error";
import { UsahaClaimUseCases } from "../../application/usaha-claim.use-cases";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";

type Mock = Record<string, ReturnType<typeof vi.fn>>;

function makeClaims(over: Mock = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: "CLAIM1", status: "pending" }),
    findById: vi.fn().mockResolvedValue(null),
    findPendingByUser: vi.fn().mockResolvedValue(null),
    listByUser: vi.fn().mockResolvedValue([]),
    listByStatus: vi.fn().mockResolvedValue([]),
    listByStatusForUsaha: vi.fn().mockResolvedValue([]),
    countPendingByUser: vi.fn().mockResolvedValue(0),
    setStatus: vi.fn(),
    approveExclusive: vi.fn(),
    ...over,
  };
}

function makeUsaha(over: Mock = {}) {
  return {
    findBySlug: vi.fn().mockResolvedValue({
      id: "U1",
      name: "Warung Kopi",
      managerId: null,
    }),
    findById: vi.fn().mockResolvedValue({ id: "U1", name: "Warung Kopi" }),
    ...over,
  };
}

/** eslint-disable-next-line @typescript-eslint/no-explicit-any */
function build(claims: any, usaha: any, activity?: any) {
  return new UsahaClaimUseCases(
    claims,
    usaha,
    undefined,
    undefined,
    undefined,
    activity,
  );
}

describe("UsahaClaimUseCases - pengajuan klaim", () => {
  it("wajib login (anonim ditolak)", async () => {
    const uc = build(makeClaims(), makeUsaha());
    await expect(
      uc.submit(ANONIM_USER_ID, "warung-kopi", { contactEvidence: "0812" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("bukti kontak wajib diisi", async () => {
    const uc = build(makeClaims(), makeUsaha());
    await expect(
      uc.submit("USER1", "warung-kopi", { contactEvidence: "   " }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("usaha tidak ada -> 404", async () => {
    const usaha = makeUsaha({ findBySlug: vi.fn().mockResolvedValue(null) });
    const uc = build(makeClaims(), usaha);
    await expect(
      uc.submit("USER1", "tidak-ada", { contactEvidence: "0812" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pengelola aktif tidak bisa klaim lagi", async () => {
    const usaha = makeUsaha({
      findBySlug: vi.fn().mockResolvedValue({ id: "U1", managerId: "USER1" }),
    });
    const uc = build(makeClaims(), usaha);
    await expect(
      uc.submit("USER1", "warung-kopi", { contactEvidence: "0812" }),
    ).rejects.toMatchObject({ errorCode: "ALREADY_MANAGER" });
  });

  it("satu klaim pending per user per usaha", async () => {
    const claims = makeClaims({
      findPendingByUser: vi.fn().mockResolvedValue({ id: "CLAIM_LAMA" }),
    });
    const uc = build(claims, makeUsaha());
    await expect(
      uc.submit("USER1", "warung-kopi", { contactEvidence: "0812" }),
    ).rejects.toMatchObject({ errorCode: "CLAIM_PENDING" });
  });
});

describe("UsahaClaimUseCases - moderasi klaim", () => {
  const pending = {
    id: "CLAIM1",
    usahaId: "U1",
    userId: "USER1",
    status: "pending",
    contactEvidence: "0812",
  };

  it("approve memanggil approveExclusive (set manager + tolak pesaing)", async () => {
    const claims = makeClaims({ findById: vi.fn().mockResolvedValue(pending) });
    const uc = build(claims, makeUsaha());
    await uc.approve("CLAIM1", "ADMIN");
    expect(claims.approveExclusive).toHaveBeenCalledWith("CLAIM1", "ADMIN");
  });

  it("approve klaim yang sudah ditinjau -> 409", async () => {
    const claims = makeClaims({
      findById: vi.fn().mockResolvedValue({ ...pending, status: "approved" }),
    });
    const uc = build(claims, makeUsaha());
    await expect(uc.approve("CLAIM1", "ADMIN")).rejects.toMatchObject({
      errorCode: "NOT_PENDING",
    });
  });

  it("approve menulis jejak aktivitas usaha_published", async () => {
    const activity = { append: vi.fn().mockResolvedValue(undefined) };
    const claims = makeClaims({ findById: vi.fn().mockResolvedValue(pending) });
    const uc = build(claims, makeUsaha(), activity);
    await uc.approve("CLAIM1", "ADMIN");
    expect(activity.append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "usaha_published", targetId: "U1" }),
    );
  });

  it("reject menyimpan alasan + notifikasi", async () => {
    const claims = makeClaims({ findById: vi.fn().mockResolvedValue(pending) });
    const uc = build(claims, makeUsaha());
    await uc.reject("CLAIM1", "evidence_insufficient", "Bukti kurang", "ADMIN");
    expect(claims.setStatus).toHaveBeenCalledWith(
      "CLAIM1",
      "rejected",
      expect.objectContaining({ rejectReasonCode: "evidence_insufficient" }),
    );
  });

  it("cancel hanya saat pending", async () => {
    const claims = makeClaims({
      findById: vi.fn().mockResolvedValue({ ...pending, status: "approved" }),
    });
    const uc = build(claims, makeUsaha());
    await expect(uc.cancel("USER1", "CLAIM1")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("cancel klaim milik orang lain -> 404", async () => {
    const claims = makeClaims({
      findById: vi.fn().mockResolvedValue({ ...pending, userId: "USER2" }),
    });
    const uc = build(claims, makeUsaha());
    await expect(uc.cancel("USER1", "CLAIM1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
