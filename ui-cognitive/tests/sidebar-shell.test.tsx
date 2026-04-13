// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({
    isCollapsed,
    onToggleCollapse,
  }: {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
  }) => (
    <div>
      <p data-testid="sidebar-collapsed">{String(Boolean(isCollapsed))}</p>
      <button type="button" onClick={onToggleCollapse}>
        Toggle collapse
      </button>
    </div>
  ),
}));

import { SidebarShell } from "@/components/layout/sidebar-shell";

describe("SidebarShell", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("restores persisted collapsed state and toggles safely", () => {
    window.localStorage.setItem("cgn.sidebar.collapsed", "1");

    render(
      <SidebarShell isAdmin={false}>
        <div>Child content</div>
      </SidebarShell>,
    );

    expect(screen.getByTestId("sidebar-collapsed").textContent).toBe("true");
    fireEvent.click(screen.getByText("Toggle collapse"));
    expect(screen.getByTestId("sidebar-collapsed").textContent).toBe("false");
    expect(window.localStorage.getItem("cgn.sidebar.collapsed")).toBe("0");
  });

  it("falls back to expanded mode when persisted value is invalid", () => {
    window.localStorage.setItem("cgn.sidebar.collapsed", "invalid");

    render(
      <SidebarShell isAdmin={false}>
        <div>Child content</div>
      </SidebarShell>,
    );

    expect(screen.getByTestId("sidebar-collapsed").textContent).toBe("false");
  });
});
