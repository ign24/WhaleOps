// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/jobs-api", () => ({
  fetchJobs: vi.fn(),
  cancelJob: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { fetchJobs, cancelJob } from "@/lib/jobs-api";
import { JobsStatusIndicator } from "@/components/layout/jobs-status-indicator";

const fetchJobsMock = vi.mocked(fetchJobs);
const cancelJobMock = vi.mocked(cancelJob);

const MOCK_JOBS = [
  { id: "abc", description: "Daily scan", cron_expr: "0 9 * * *", next_run: "2026-04-14T09:00:00Z", status: "active" as const },
];

describe("JobsStatusIndicator", () => {
  beforeEach(() => {
    fetchJobsMock.mockReset();
    cancelJobMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows pulsing dot and count when jobs exist", async () => {
    fetchJobsMock.mockResolvedValue(MOCK_JOBS);

    render(<JobsStatusIndicator />);

    await waitFor(() => {
      const count = screen.getByTestId("jobs-count");
      expect(count.textContent).toBe("1");
    });
    const dot = screen.getByTestId("jobs-dot");
    expect(dot.getAttribute("data-pulsing")).toBe("true");
  });

  it("shows neutral dot with no count when no jobs", async () => {
    fetchJobsMock.mockResolvedValue([]);

    render(<JobsStatusIndicator />);

    await waitFor(() => {
      const dot = screen.getByTestId("jobs-dot");
      expect(dot.getAttribute("data-pulsing")).toBe("false");
    });
    expect(screen.queryByTestId("jobs-count")).toBeNull();
  });

  it("shows neutral state on fetch error", async () => {
    fetchJobsMock.mockRejectedValue(new Error("network error"));

    render(<JobsStatusIndicator />);

    await waitFor(() => {
      const dot = screen.getByTestId("jobs-dot");
      expect(dot.getAttribute("data-pulsing")).toBe("false");
    });
  });

  it("opens panel on click", async () => {
    fetchJobsMock.mockResolvedValue(MOCK_JOBS);
    const user = userEvent.setup();

    render(<JobsStatusIndicator />);
    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());

    await user.click(screen.getByTestId("jobs-trigger"));
    expect(screen.getByTestId("jobs-panel")).toBeTruthy();
  });

  it("shows job description in panel", async () => {
    fetchJobsMock.mockResolvedValue(MOCK_JOBS);
    const user = userEvent.setup();

    render(<JobsStatusIndicator />);
    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());

    await user.click(screen.getByTestId("jobs-trigger"));
    expect(screen.getByText("Daily scan")).toBeTruthy();
  });

  it("shows empty state in panel when no jobs", async () => {
    fetchJobsMock.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<JobsStatusIndicator />);
    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());

    await user.click(screen.getByTestId("jobs-trigger"));
    expect(screen.getByText(/no scheduled jobs/i)).toBeTruthy();
  });

  it("cancel button calls cancelJob", async () => {
    fetchJobsMock.mockResolvedValueOnce(MOCK_JOBS).mockResolvedValue([]);
    cancelJobMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<JobsStatusIndicator />);
    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByTestId("jobs-trigger"));
    await user.click(screen.getByTestId("cancel-job-abc"));

    await waitFor(() => expect(cancelJobMock).toHaveBeenCalledWith("abc"));
  });
});
