// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/activity/session-meta", () => ({
  deriveSessionMeta: vi.fn(),
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
}));

vi.mock("@/lib/model-registry", () => ({
  getModelDisplayName: vi.fn(),
  getModelVendor: vi.fn(() => null),
}));

vi.mock("@/components/activity/model-vendor-badge", () => ({
  ModelVendorBadge: () => null,
}));

import { deriveSessionMeta } from "@/components/activity/session-meta";
import { SessionInfo } from "@/components/activity/session-info";

const deriveSessionMetaMock = vi.mocked(deriveSessionMeta);

afterEach(() => {
  cleanup();
  deriveSessionMetaMock.mockReset();
});

describe("SessionInfo", () => {
  it("renders tool count and duration in same inline container", () => {
    deriveSessionMetaMock.mockReturnValue({
      toolCount: 5,
      totalDuration: 1000,
      isLive: false,
      model: null,
      errorCount: 0,
      completedCount: 0,
    });

    const { container } = render(<SessionInfo entries={[]} isLive={false} />);
    const statsContainer = container.querySelector(".divide-x");
    expect(statsContainer).not.toBeNull();
  });

  it("renders tool count stat visible in inline row", () => {
    deriveSessionMetaMock.mockReturnValue({
      toolCount: 7,
      totalDuration: 2000,
      isLive: false,
      model: null,
      errorCount: 0,
      completedCount: 0,
    });

    const { container } = render(<SessionInfo entries={[]} isLive={false} />);
    expect(container.textContent).toContain("7");
  });
});
