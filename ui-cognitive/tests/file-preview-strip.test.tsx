// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilePreviewStrip } from "@/components/chat/file-preview-strip";

describe("FilePreviewStrip", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders filename and size for a code file", () => {
    render(
      <FilePreviewStrip
        fileName="auth.py"
        fileType="code"
        fileSizeLabel="4.2 KB"
        onRemove={() => {}}
      />,
    );

    expect(screen.getByText("auth.py")).toBeTruthy();
    expect(screen.getByText("4.2 KB")).toBeTruthy();
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <FilePreviewStrip
        fileName="schema.json"
        fileType="code"
        fileSizeLabel="1.1 KB"
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quitar archivo adjunto" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders image thumbnail when previewSrc is provided", () => {
    render(
      <FilePreviewStrip
        fileName="screenshot.png"
        fileType="image"
        fileSizeLabel="320 KB"
        previewSrc="data:image/png;base64,abc"
        onRemove={() => {}}
      />,
    );

    const img = screen.getByAltText("screenshot.png") as HTMLImageElement;
    expect(img.src).toContain("data:image/png;base64,abc");
  });
});
