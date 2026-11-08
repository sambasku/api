import { describe, expect, it } from "vitest";
import {
  isReservedEventSlug,
  pickEventSlug,
} from "../../domain/event-slug";
import { createEventBodySchema } from "../../presentation/v1/validators/event.validator";

const validBody = {
  slug: "pawai-blocks",
  name: "Pawai Blocks",
  description: "Acara pawai.",
  category_id: "budaya-tradisi",
  starts_at: "2026-11-17T13:00:00.000Z",
  ends_at: "2026-11-17T16:00:00.000Z",
  location_text: "Lapangan Pemangkat",
};

describe("event slug reserved", () => {
  it("kontribusi dan usulan reserved, categories tidak", () => {
    expect(isReservedEventSlug("kontribusi")).toBe(true);
    expect(isReservedEventSlug("usulan")).toBe(true);
    expect(isReservedEventSlug("categories")).toBe(false);
    expect(isReservedEventSlug("kontribusi-2")).toBe(false);
  });

  it("pickEventSlug melewati reserved dan yang sudah terpakai", () => {
    expect(pickEventSlug(["kontribusi", "kontribusi-2"], new Set())).toBe(
      "kontribusi-2",
    );
    expect(
      pickEventSlug(["pawai", "pawai-2"], new Set(["pawai"])),
    ).toBe("pawai-2");
  });

  it("validator menolak slug halaman lain", () => {
    expect(createEventBodySchema.safeParse(validBody).success).toBe(true);
    const blocked = createEventBodySchema.safeParse({
      ...validBody,
      slug: "usulan",
    });
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.error.issues[0]?.message).toContain("halaman lain");
    }
  });
});
