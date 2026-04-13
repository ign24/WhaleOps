// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/model-registry", () => ({
  getModelVendor: vi.fn(),
}));

import { getModelVendor } from "@/lib/model-registry";
import { ModelVendorBadge } from "@/components/activity/model-vendor-badge";

const getModelVendorMock = vi.mocked(getModelVendor);

afterEach(() => {
  cleanup();
  getModelVendorMock.mockReset();
});

describe("ModelVendorBadge", () => {
  it("renders null when vendor not found", () => {
    getModelVendorMock.mockReturnValue(null);
    const { container } = render(<ModelVendorBadge model="unknown-model" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders badge with tinted background class", () => {
    getModelVendorMock.mockReturnValue({ name: "Anthropic" });
    const { container } = render(<ModelVendorBadge model="claude-3" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.className).toContain("bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]");
  });

  it("renders badge with tinted border class", () => {
    getModelVendorMock.mockReturnValue({ name: "Anthropic" });
    const { container } = render(<ModelVendorBadge model="claude-3" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("border-[color-mix(in_srgb,var(--primary)_20%,transparent)]");
  });

  it("renders vendor name text", () => {
    getModelVendorMock.mockReturnValue({ name: "Mistral" });
    const { container } = render(<ModelVendorBadge model="devstral" />);
    expect(container.textContent).toContain("Mistral");
  });
});
