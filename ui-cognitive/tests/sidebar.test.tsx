// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const setErrorMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/main",
  useRouter: () => ({
    push: pushMock,
  }),
}));

const sessionWithCreator = {
  sessionKey: "main",
  title: "Main",
  updatedAt: "2026-03-09T20:00:00.000Z",
  createdBy: { id: "u1", name: "Test User" },
};

const sessionSystem = {
  sessionKey: "legacy",
  title: "Legacy",
  updatedAt: "2026-03-09T19:00:00.000Z",
  createdBy: { id: "system", name: "Sistema" },
};

vi.mock("@/hooks/use-sessions", () => ({
  useSessions: () => ({
    sessions: [sessionWithCreator, sessionSystem],
    isLoading: false,
    error: null,
    setError: setErrorMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/layout/mcp-servers", () => ({
  McpServers: () => null,
}));

import { Sidebar } from "@/components/layout/sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    refreshMock.mockReset();
    setErrorMock.mockReset();
    confirmMock.mockReset();
    vi.restoreAllMocks();
    vi.stubGlobal("confirm", confirmMock);
  });

  it("renders available sessions", () => {
    render(<Sidebar isAdmin={false} />);
    expect(screen.getByText("Main")).toBeTruthy();
  });


  it("calls toggle callback when collapse button is clicked", () => {
    const toggleMock = vi.fn();
    render(<Sidebar isAdmin={false} onToggleCollapse={toggleMock} />);

    const collapseButton = screen.getByRole("button", { name: /Colapsar sidebar/i });
    expect(collapseButton.getAttribute("aria-label")).toBe("Colapsar sidebar");

    fireEvent.click(collapseButton);
    expect(toggleMock).toHaveBeenCalledOnce();
  });

  it("keeps explicit action hints for collapse control in compact mode", () => {
    render(<Sidebar isAdmin={false} isCollapsed onToggleCollapse={() => undefined} />);

    expect(screen.getByRole("button", { name: /Expandir sidebar/i }).getAttribute("aria-label")).toBe("Expandir sidebar");
    expect(screen.getByRole("button", { name: /Nueva conversación/i }).getAttribute("aria-label")).toBe(
      "Nueva conversación",
    );
    expect(screen.getByRole("link", { name: "Main" })).toBeTruthy();
  });

  it("creates a conversation immediately and navigates", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("new12345-uuid");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<Sidebar isAdmin={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Nueva conversación/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/chat/new12345?bootstrap=new");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows immediate pending feedback and disables create control", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("new12345-uuid");

    render(<Sidebar isAdmin={false} />);

    const createButton = screen.getByRole("button", { name: /Nueva conversación/i });
    fireEvent.click(createButton);

    expect(screen.getByRole("button", { name: /Creando conversación/i }).hasAttribute("disabled")).toBe(true);
  });

  it("prevents duplicate new conversation clicks while pending", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("new12345-uuid");

    render(<Sidebar isAdmin={false} />);

    const createButton = screen.getByRole("button", { name: /Nueva conversación/i });
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("emits ordered create milestones on new conversation click", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("new12345-uuid");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<Sidebar isAdmin={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Nueva conversación/i }));

    const milestoneEvents = dispatchSpy.mock.calls
      .map(([event]) => event)
      .filter((event): event is CustomEvent => event instanceof CustomEvent && event.type === "cgn:new-conversation-latency")
      .map((event) => (event.detail as { milestone?: string }).milestone);

    expect(milestoneEvents).toEqual(["create_click", "feedback_visible"]);
  });

  it("cancels delete when confirmation is rejected", async () => {
    confirmMock.mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<Sidebar isAdmin={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Main/i }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledOnce();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
