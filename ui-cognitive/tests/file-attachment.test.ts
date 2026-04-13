import { describe, expect, it } from "vitest";

import { validateAttachment, formatFileSize } from "@/lib/file-attachment";

describe("validateAttachment", () => {
  it("accepts a .py file under 100 KB", () => {
    const result = validateAttachment({ name: "auth.py", size: 1024 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type).toBe("code");
  });

  it("accepts a .ts file under 100 KB", () => {
    const result = validateAttachment({ name: "component.ts", size: 50 * 1024 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type).toBe("code");
  });

  it("accepts a dockerfile (no extension)", () => {
    const result = validateAttachment({ name: "Dockerfile", size: 512 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type).toBe("code");
  });

  it("rejects a .py file over 100 KB", () => {
    const result = validateAttachment({ name: "big.py", size: 101 * 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("100 KB");
  });

  it("accepts a .png image under 2 MB", () => {
    const result = validateAttachment({ name: "screenshot.png", size: 500 * 1024 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type).toBe("image");
  });

  it("rejects a .png image over 2 MB", () => {
    const result = validateAttachment({ name: "huge.png", size: 3 * 1024 * 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2 MB");
  });

  it("rejects an unsupported file type", () => {
    const result = validateAttachment({ name: "archive.zip", size: 1024 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(".zip");
  });

  it("rejects a .exe file", () => {
    const result = validateAttachment({ name: "setup.exe", size: 1024 });
    expect(result.ok).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
