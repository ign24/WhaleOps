// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackgroundMotionToggle } from "@/components/layout/background-motion-toggle";
import { BACKGROUND_MOTION_STORAGE_KEY } from "@/lib/background-motion";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: unknown }) => <>{children}</>,
}));

describe("BackgroundMotionToggle", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("switches between animated and static background preference", () => {
    render(<BackgroundMotionToggle />);

    const toggleButton = screen.getByRole("button", { name: "Usar fondo estático" });
    expect(window.localStorage.getItem(BACKGROUND_MOTION_STORAGE_KEY)).toBeNull();
    expect(toggleButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggleButton);

    expect(window.localStorage.getItem(BACKGROUND_MOTION_STORAGE_KEY)).toBe("0");
    expect(screen.getByRole("button", { name: "Usar fondo animado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Usar fondo animado" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Usar fondo animado" }));

    expect(window.localStorage.getItem(BACKGROUND_MOTION_STORAGE_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: "Usar fondo estático" })).toBeTruthy();
  });
});
