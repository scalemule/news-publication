import { describe, expect, it } from "vitest";
import { encodePendingPhoto, decodePendingPhoto } from "./story-review-photo";

describe("device-only photograph recovery", () => {
  it("stores no File/Blob and restores exact bytes, Unicode filename and replacement intent", async () => {
    const bytes = new Uint8Array([0, 255, 137, 80, 78, 71]);
    const original = {
      file: new File([bytes], "Family София 李 📰.png", { type: "image/png", lastModified: 1780000000000 }),
      replacement: { contribution_id: "original-photo", caption: "Original photograph" },
      expires: 1790000000000,
    };
    const encoded = await encodePendingPhoto(original);
    expect(encoded.file).not.toBeInstanceOf(Blob);
    const restored = decodePendingPhoto(structuredClone(encoded))!;
    expect(restored.file.name).toBe(original.file.name);
    expect(restored.file.type).toBe(original.file.type);
    expect(restored.file.lastModified).toBe(original.file.lastModified);
    expect(new Uint8Array(await restored.file.arrayBuffer())).toEqual(bytes);
    expect(restored.replacement).toEqual(original.replacement);
    expect(restored.expires).toBe(original.expires);
  });
  it("keeps selections written by earlier releases readable", () => {
    const original = { file: new File(["photo"], "family.jpg", { type: "image/jpeg" }), replacement: null, expires: 1790000000000 };
    expect(decodePendingPhoto(original)).toBe(original);
    expect(decodePendingPhoto(undefined)).toBeUndefined();
  });
});
