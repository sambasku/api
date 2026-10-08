import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env", () => ({
  env: { KAPSO_API_KEY: "test-key", KAPSO_PHONE_NUMBER_ID: "999" },
}));

import {
  KapsoWaSender,
  KAPSO_WA_DEFAULT_BASE_URL,
} from "../../infrastructure/kapso-wa.sender";

describe("KapsoWaSender", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression #WA-404: base URL Kapso wajib berversi (v24.0).
  // Path lama /meta/whatsapp tanpa versi -> 404 HTML dari Kapso.
  it("default base URL memakai API berversi v24.0", () => {
    expect(KAPSO_WA_DEFAULT_BASE_URL).toBe(
      "https://api.kapso.ai/meta/whatsapp/v24.0",
    );
  });

  it("POST ke {base}/{phoneNumberId}/messages", async () => {
    const sender = new KapsoWaSender({
      baseUrl: "https://api.kapso.ai/meta/whatsapp/v24.0",
      phoneNumberId: "123",
    });

    await sender.send({ to: "628111", channel: "text", bodyText: "halo" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.kapso.ai/meta/whatsapp/v24.0/123/messages",
      expect.anything(),
    );
  });
});
