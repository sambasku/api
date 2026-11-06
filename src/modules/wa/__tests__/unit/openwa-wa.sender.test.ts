import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env", () => ({
  env: {},
}));

import { OpenWaSender } from "../../infrastructure/openwa-wa.sender";

const CONFIG = {
  baseUrl: "https://wa.example.com/",
  apiKey: "operator-key",
  sessionId: "38d3dfa7-08c9-47f1-9490-f6ffe0124620",
  groupJid: "120363429405087787@g.us",
};

describe("OpenWaSender", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mengirim teks ke nomor sebagai @c.us", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const sender = new OpenWaSender(CONFIG);

    await sender.send({
      channel: "text",
      to: "6281234567890",
      bodyText: "Halo",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wa.example.com/api/sessions/38d3dfa7-08c9-47f1-9490-f6ffe0124620/messages/send-text",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chatId: "6281234567890@c.us", text: "Halo" }),
      }),
    );
  });

  it("menolak pesan kosong", async () => {
    const sender = new OpenWaSender(CONFIG);
    await expect(
      sender.send({ channel: "text", to: "6281234567890", bodyText: "  " }),
    ).rejects.toThrow("Isi pesan WA kosong");
  });
});
