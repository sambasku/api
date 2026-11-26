import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env", () => ({
  env: { NODE_ENV: "test" as string },
}));

import { env } from "@/shared/config/env";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";
import { formatExplorationGroupMessage } from "../../application/ports/exploration-group-notifier.port";
import { OpenWaExplorationGroupNotifier } from "../../infrastructure/openwa-exploration-group.notifier";

const enabledSettings = { getValue: vi.fn().mockResolvedValue("true") };

const CONFIG = {
  baseUrl: "https://wa.example.com/",
  apiKey: "operator-key",
  sessionId: "38d3dfa7-08c9-47f1-9490-f6ffe0124620",
  groupJid: "120363429405087787@g.us",
};

describe("formatExplorationGroupMessage", () => {
  it("menyusun kabar usulan baru", () => {
    expect(
      formatExplorationGroupMessage({
        jenis: "Usaha",
        name: "Warung Contoh",
        from: "@warga",
      }),
    ).toBe(
      "Usulan baru masuk.\nJenis: Usaha\nNama: Warung Contoh\nDari: @warga",
    );
  });

  it("menandai kirim ulang", () => {
    expect(
      formatExplorationGroupMessage({
        jenis: "Acara",
        name: "  ",
        from: "Anonim",
        resubmit: true,
      }),
    ).toBe("Usulan dikirim ulang.\nJenis: Acara\nNama: tanpa nama\nDari: Anonim");
  });

  it("menandai env Staging di footer italic", () => {
    expect(
      formatExplorationGroupMessage({
        jenis: "Pengajuan verifikator",
        name: "Budi",
        from: "@budi",
        envTag: "Staging",
      }),
    ).toBe(
      "Usulan baru masuk.\nJenis: Pengajuan verifikator\nNama: Budi\nDari: @budi\n\n_Dikirim dari Staging._",
    );
  });
});

describe("OpenWaExplorationGroupNotifier", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    env.NODE_ENV = "test";
  });

  it("melewati kirim bila env belum lengkap", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const logs = { record: vi.fn() };
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById: vi.fn() },
      logs,
      enabledSettings,
      { baseUrl: "https://wa.example.com" },
    );

    await notifier.notify({
      jenis: "Usaha",
      name: "Warung",
      userId: "USER1",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs.record).not.toHaveBeenCalled();
  });

  it("POST send-text ke grup dan mencatat sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const logs = { record: vi.fn().mockResolvedValue(undefined) };
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById: vi.fn().mockResolvedValue({ username: "warga" }) },
      logs,
      enabledSettings,
      CONFIG,
    );

    await notifier.notify({
      jenis: "Usaha",
      name: "Warung Contoh",
      userId: "USER1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wa.example.com/api/sessions/38d3dfa7-08c9-47f1-9490-f6ffe0124620/messages/send-text",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chatId: "120363429405087787@g.us",
          text: "Usulan baru masuk.\nJenis: Usaha\nNama: Warung Contoh\nDari: @warga",
        }),
      }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(
      "operator-key",
    );
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openwa",
        eventKey: "exploration_proposal_submitted",
        toPhone: "120363429405087787@g.us",
        channel: "text",
        status: "sent",
      }),
    );
  });

  it("staging: sisip (Staging) di teks grup", async () => {
    env.NODE_ENV = "staging";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById: vi.fn().mockResolvedValue({ username: "warga" }) },
      { record: vi.fn().mockResolvedValue(undefined) },
      enabledSettings,
      CONFIG,
    );

    await notifier.notify({
      jenis: "Pengajuan verifikator",
      name: "Budi",
      userId: "USER1",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { text: string };
    expect(body.text.endsWith("\n\n_Dikirim dari Staging._")).toBe(true);
  });

  it("notice.text dipakai apa adanya, event key custom, footer Staging", async () => {
    env.NODE_ENV = "staging";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const findById = vi.fn();
    const logs = { record: vi.fn().mockResolvedValue(undefined) };
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById },
      logs,
      enabledSettings,
      CONFIG,
    );

    await notifier.notify({
      jenis: "Chat",
      name: "PING!!!",
      userId: "USER1",
      eventKey: "chat_ping",
      text: "PING!!! dari @budi di chat SambasKu. Yuk ngobrol.",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { text: string };
    expect(body.text).toBe(
      "PING!!! dari @budi di chat SambasKu. Yuk ngobrol.\n\n_Dikirim dari Staging._",
    );
    expect(findById).not.toHaveBeenCalled();
    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: "chat_ping", status: "sent" }),
    );
  });

  it.each([
    ["false", "false"],
    ["baris hilang", null],
    ["nilai bukan true", "1"],
  ])("flag %s: tidak kirim, tidak log, tidak lookup user", async (_label, value) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const findById = vi.fn();
    const logs = { record: vi.fn() };
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById },
      logs,
      { getValue: vi.fn().mockResolvedValue(value) },
      CONFIG,
    );

    await expect(
      notifier.notify({ jenis: "Usaha", name: "Warung", userId: "USER1" }),
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(logs.record).not.toHaveBeenCalled();
  });

  it("error baca flag: fail-closed, tidak melempar, tidak kirim", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById: vi.fn() },
      { record: vi.fn() },
      { getValue: vi.fn().mockRejectedValue(new Error("db down")) },
      CONFIG,
    );

    await expect(
      notifier.notify({ jenis: "Usaha", name: "Warung", userId: "USER1" }),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("anonim tidak memanggil lookup user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201 }));
    const findById = vi.fn();
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById },
      { record: vi.fn().mockResolvedValue(undefined) },
      enabledSettings,
      CONFIG,
    );

    await notifier.notify({
      jenis: "Wisata",
      name: "Pantai",
      userId: ANONIM_USER_ID,
    });

    expect(findById).not.toHaveBeenCalled();
  });

  it("HTTP gagal dicatat dan tidak melempar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "gateway down",
      }),
    );
    const logs = { record: vi.fn().mockResolvedValue(undefined) };
    const notifier = new OpenWaExplorationGroupNotifier(
      { findById: vi.fn().mockResolvedValue(null) },
      logs,
      enabledSettings,
      CONFIG,
    );

    await expect(
      notifier.notify({ jenis: "Kuliner", name: "Bubur", userId: "USER1" }),
    ).resolves.toBeUndefined();

    expect(logs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "OpenWA gagal (HTTP 503): gateway down",
      }),
    );
  });
});
