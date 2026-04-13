// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeleteConfirmModal } from "@/components/workspace/delete-confirm-modal";

// ---------------------------------------------------------------------------
// Task 4.1 — Renders target info and PIN input structure
// ---------------------------------------------------------------------------

const defaultProps = {
  token: "test-token-uuid-1234",
  targetPath: "/app/workspace/django",
  sizeMb: 142,
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
  onExpired: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  defaultProps.onSuccess.mockReset();
  defaultProps.onCancel.mockReset();
  defaultProps.onExpired.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("DeleteConfirmModal — structure", () => {
  it("renders the target path", () => {
    render(<DeleteConfirmModal {...defaultProps} />);
    expect(screen.getByText(/\/app\/workspace\/django/)).toBeTruthy();
  });

  it("renders size in MB", () => {
    render(<DeleteConfirmModal {...defaultProps} />);
    expect(screen.getByText(/142/)).toBeTruthy();
  });

  it("renders a masked PIN input", () => {
    render(<DeleteConfirmModal {...defaultProps} />);
    const input = screen.getByTestId("pin-input");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).type).toBe("password");
    expect((input as HTMLInputElement).autocomplete).toBe("off");
  });

  it("renders Cancel and Confirm buttons", () => {
    render(<DeleteConfirmModal {...defaultProps} />);
    expect(screen.getByTestId("cancel-btn")).toBeTruthy();
    expect(screen.getByTestId("confirm-btn")).toBeTruthy();
  });

  it("Cancel fires no fetch request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<DeleteConfirmModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId("cancel-btn"));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("Confirm POSTs to /api/workspace/delete/confirm", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "deleted", size_freed_mb: 142 }), { status: 200 }),
    );
    render(<DeleteConfirmModal {...defaultProps} />);

    await userEvent.type(screen.getByTestId("pin-input"), "correct-pin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/workspace/delete/confirm",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("correct-pin"),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Task 4.2 — State transitions
// ---------------------------------------------------------------------------

describe("DeleteConfirmModal — state transitions", () => {
  it("wrong PIN keeps modal open with error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_pin" }), { status: 403 }),
    );
    render(<DeleteConfirmModal {...defaultProps} />);

    await userEvent.type(screen.getByTestId("pin-input"), "wrongpin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("pin-error")).toBeTruthy();
      expect(screen.getByTestId("pin-error").textContent).toMatch(/incorrecto/i);
    });
    // Modal still open
    expect(screen.getByTestId("pin-input")).toBeTruthy();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it("wrong PIN clears the PIN input", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_pin" }), { status: 403 }),
    );
    render(<DeleteConfirmModal {...defaultProps} />);

    await userEvent.type(screen.getByTestId("pin-input"), "wrongpin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect((screen.getByTestId("pin-input") as HTMLInputElement).value).toBe("");
    });
  });

  it("token_expired calls onExpired and closes modal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "token_expired" }), { status: 410 }),
    );
    render(<DeleteConfirmModal {...defaultProps} />);

    await userEvent.type(screen.getByTestId("pin-input"), "anypin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(defaultProps.onExpired).toHaveBeenCalledOnce();
    });
  });

  it("success calls onSuccess with size_freed_mb", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "deleted", size_freed_mb: 142 }), { status: 200 }),
    );
    render(<DeleteConfirmModal {...defaultProps} />);

    await userEvent.type(screen.getByTestId("pin-input"), "correctpin");
    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ size_freed_mb: 142 }),
      );
    });
  });
});
