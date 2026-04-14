// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ActivityEntry } from "@/types/chat";

// ---- helpers ----------------------------------------------------------------

const makeEntry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "e1",
  label: "test",
  kind: "tool",
  status: "completed",
  startedAt: 1000,
  ...overrides,
});

afterEach(() => cleanup());

// ---- deriveOpsSnapshot tests ------------------------------------------------

describe("deriveOpsSnapshot", () => {
  // Import lazily so each describe block gets a fresh import after the module exists
  const getDerive = async () => {
    const mod = await import("@/components/activity/ops-session-context");
    return mod.deriveOpsSnapshot;
  };

  it("returns empty snapshot for empty entries", async () => {
    const derive = await getDerive();
    const snap = derive([]);
    expect(snap.isEmpty).toBe(true);
    expect(snap.containersReferenced).toHaveLength(0);
    expect(snap.logsFetched).toHaveLength(0);
    expect(snap.notesSaved).toHaveLength(0);
    expect(snap.schedulesCreated).toHaveLength(0);
  });

  it("returns empty snapshot when no ops tool calls present", async () => {
    const derive = await getDerive();
    const entries = [makeEntry({ kind: "agent", toolNameNormalized: "thinking" })];
    const snap = derive(entries);
    expect(snap.isEmpty).toBe(true);
  });

  it("extracts container_name from toolArgs into containersReferenced", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "nginx" } }),
    ];
    const snap = derive(entries);
    expect(snap.containersReferenced).toContain("nginx");
    expect(snap.isEmpty).toBe(false);
  });

  it("extracts container_id from toolArgs into containersReferenced", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_id: "abc123" } }),
    ];
    const snap = derive(entries);
    expect(snap.containersReferenced).toContain("abc123");
  });

  it("deduplicates container names", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "nginx" } }),
      makeEntry({ toolNameNormalized: "get_container_logs", toolArgs: { container_name: "nginx", lines: 50 } }),
    ];
    const snap = derive(entries);
    expect(snap.containersReferenced.filter((c) => c === "nginx")).toHaveLength(1);
  });

  it("extracts log fetch metadata from get_container_logs", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({
        toolNameNormalized: "get_container_logs",
        toolArgs: { container_name: "postgres", lines: 100 },
      }),
    ];
    const snap = derive(entries);
    expect(snap.logsFetched).toHaveLength(1);
    expect(snap.logsFetched[0]).toEqual({ container: "postgres", lines: 100 });
  });

  it("extracts note metadata from save_note", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({
        toolNameNormalized: "save_note",
        toolArgs: { note_type: "incident", container_name: "redis" },
      }),
    ];
    const snap = derive(entries);
    expect(snap.notesSaved).toHaveLength(1);
    expect(snap.notesSaved[0]).toEqual({ type: "incident", container: "redis" });
  });

  it("extracts schedule from schedule_task with action create", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({
        toolNameNormalized: "schedule_task",
        toolArgs: { action: "create", name: "health-check", cron: "*/5 * * * *" },
      }),
    ];
    const snap = derive(entries);
    expect(snap.schedulesCreated).toHaveLength(1);
    expect(snap.schedulesCreated[0]).toEqual({ name: "health-check", cron: "*/5 * * * *" });
  });

  it("does not add schedule for list/cancel actions", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({
        toolNameNormalized: "schedule_task",
        toolArgs: { action: "list" },
      }),
    ];
    const snap = derive(entries);
    expect(snap.schedulesCreated).toHaveLength(0);
  });

  it("marks isEmpty false when any section has items", async () => {
    const derive = await getDerive();
    const entries = [
      makeEntry({ toolNameNormalized: "list_containers", toolArgs: {} }),
    ];
    // list_containers may not add containers (no container_name arg) but just invoking it
    // contributes nothing — need a real container ref
    const entries2 = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "app" } }),
    ];
    const snap = derive(entries2);
    expect(snap.isEmpty).toBe(false);
  });
});

// ---- OpsSessionContext component tests --------------------------------------

describe("OpsSessionContext", () => {
  const getComponent = async () => {
    const mod = await import("@/components/activity/ops-session-context");
    return mod.OpsSessionContext;
  };

  it("renders nothing when snapshot is empty", async () => {
    const OpsSessionContext = await getComponent();
    const { container } = render(<OpsSessionContext entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders panel when containers are referenced", async () => {
    const OpsSessionContext = await getComponent();
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "nginx" } }),
    ];
    render(<OpsSessionContext entries={entries} />);
    expect(screen.getByText(/Contexto de operaciones/i)).toBeTruthy();
    expect(screen.getByText(/nginx/i)).toBeTruthy();
  });

  it("renders 'Containers consultados' section when containers present", async () => {
    const OpsSessionContext = await getComponent();
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "api" } }),
    ];
    render(<OpsSessionContext entries={entries} />);
    expect(screen.getByText(/Containers consultados/i)).toBeTruthy();
  });

  it("renders 'Logs obtenidos' section when logs fetched", async () => {
    const OpsSessionContext = await getComponent();
    const entries = [
      makeEntry({ toolNameNormalized: "get_container_logs", toolArgs: { container_name: "web", lines: 50 } }),
    ];
    render(<OpsSessionContext entries={entries} />);
    expect(screen.getByText(/Logs obtenidos/i)).toBeTruthy();
  });

  it("renders 'Notas guardadas' section when notes saved", async () => {
    const OpsSessionContext = await getComponent();
    const entries = [
      makeEntry({ toolNameNormalized: "save_note", toolArgs: { note_type: "warning", container_name: "db" } }),
    ];
    render(<OpsSessionContext entries={entries} />);
    expect(screen.getByText(/Notas guardadas/i)).toBeTruthy();
  });

  it("renders 'Tareas programadas' section when schedules created", async () => {
    const OpsSessionContext = await getComponent();
    const entries = [
      makeEntry({
        toolNameNormalized: "schedule_task",
        toolArgs: { action: "create", name: "ping", cron: "* * * * *" },
      }),
    ];
    render(<OpsSessionContext entries={entries} />);
    expect(screen.getByText(/Tareas programadas/i)).toBeTruthy();
  });

  it("starts expanded when total items <= 10", async () => {
    const OpsSessionContext = await getComponent();
    const entries = [
      makeEntry({ toolNameNormalized: "inspect_container", toolArgs: { container_name: "nginx" } }),
    ];
    render(<OpsSessionContext entries={entries} />);
    // content visible → container name appears
    expect(screen.getByText("nginx")).toBeTruthy();
  });

  it("starts collapsed when total items > 10", async () => {
    const OpsSessionContext = await getComponent();
    const entries = Array.from({ length: 11 }, (_, i) =>
      makeEntry({
        id: `e${i}`,
        toolNameNormalized: "inspect_container",
        toolArgs: { container_name: `container-${i}` },
      }),
    );
    render(<OpsSessionContext entries={entries} />);
    // collapsed → individual container names not visible
    expect(screen.queryByText("container-0")).toBeNull();
  });

  it("expands on toggle click", async () => {
    const OpsSessionContext = await getComponent();
    const entries = Array.from({ length: 11 }, (_, i) =>
      makeEntry({
        id: `e${i}`,
        toolNameNormalized: "inspect_container",
        toolArgs: { container_name: `box-${i}` },
      }),
    );
    render(<OpsSessionContext entries={entries} />);
    expect(screen.queryByText("box-0")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("box-0")).toBeTruthy();
  });
});
