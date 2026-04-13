// @vitest-environment happy-dom

import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolderCard } from "@/components/activity/folder-card";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const makeTreeResponse = (path: string) => ({
  path,
  tree: [
    { name: "src", type: "dir" as const, children: [{ name: "index.ts", type: "file" as const, size: 512 }] },
    { name: "package.json", type: "file" as const, size: 1024 },
  ],
  changedFiles: [],
  totalFiles: 2,
  totalDirs: 1,
  truncated: false,
});

describe("FolderCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("always renders the card header", () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/api/workspace/roots") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ roots: [{ path: "/tmp/analysis", label: "sandbox" }] }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<FolderCard isLive={false} />);
    expect(screen.getByText("Sistema de archivos")).toBeTruthy();
  });

  it("shows error state when path is not accessible", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/api/workspace/roots") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ roots: [{ path: "/tmp/analysis", label: "sandbox" }] }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    render(<FolderCard isLive={false} />);

    await waitFor(() => {
      const msgs = screen.getAllByText(/No accesible/i);
      expect(msgs.length).toBeGreaterThan(0);
    });
  });

  it("renders tree when API returns valid data", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/api/workspace/roots") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            roots: [
              { path: "/tmp/analysis", label: "sandbox" },
              { path: "/app/workspace", label: "workspace" },
            ],
          }),
        });
      }

      const path = url.includes("/app/workspace") ? "/app/workspace" : "/tmp/analysis";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => makeTreeResponse(path),
      });
    });

    render(<FolderCard isLive={false} />);

    await waitFor(() => {
      expect(screen.getByText("/sandbox")).toBeTruthy();
    });
    expect(screen.getByText("/workspace")).toBeTruthy();
  });

  it("refresh button triggers re-fetch", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/workspace/roots") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ roots: [{ path: "/tmp/analysis", label: "sandbox" }] }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => makeTreeResponse("/tmp/analysis"),
      });
    });
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch);

    render(<FolderCard isLive={false} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const callsBefore = mockFetch.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
