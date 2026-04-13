import { describe, expect, it } from "vitest";

import { deriveSessionMeta, humanizeActivityLabel } from "@/components/activity/session-meta";
import { ActivityEntry } from "@/types/chat";

const buildEntry = (partial: Partial<ActivityEntry>): ActivityEntry => ({
  id: partial.id ?? "entry-1",
  label: partial.label ?? "tool",
  kind: partial.kind ?? "tool",
  status: partial.status ?? "completed",
  startedAt: partial.startedAt ?? 1_700_000_000_000,
  completedAt: partial.completedAt,
  model: partial.model,
  detail: partial.detail,
  toolArgs: partial.toolArgs,
  toolResult: partial.toolResult,
  stepId: partial.stepId,
  parentStepId: partial.parentStepId,
});

describe("deriveSessionMeta", () => {
  it("calculates tool count and aggregate duration", () => {
    const entries: ActivityEntry[] = [
      buildEntry({ id: "1", kind: "tool", startedAt: 1000, completedAt: 1600 }),
      buildEntry({ id: "2", kind: "agent", startedAt: 2000, completedAt: 2400 }),
      buildEntry({ id: "3", kind: "tool", startedAt: 3000, completedAt: 4500 }),
    ];

    const meta = deriveSessionMeta(entries, false);
    expect(meta.toolCount).toBe(2);
    expect(meta.totalDuration).toBe(2500);
  });

  it("tracks running and failed tool states", () => {
    const entries: ActivityEntry[] = [
      buildEntry({ id: "1", kind: "tool", status: "running" }),
      buildEntry({ id: "2", kind: "tool", status: "pending" }),
      buildEntry({ id: "3", kind: "tool", status: "failed" }),
      buildEntry({ id: "4", kind: "agent", status: "running" }),
    ];

    const meta = deriveSessionMeta(entries, true);
    expect(meta.activeToolCount).toBe(2);
    expect(meta.failedCount).toBe(1);
    expect(meta.isLive).toBe(true);
  });

  it("extracts latest available model", () => {
    const entries: ActivityEntry[] = [
      buildEntry({ id: "1", kind: "agent", model: undefined }),
      buildEntry({ id: "2", kind: "tool", model: "deepseek-v3" }),
      buildEntry({ id: "3", kind: "tool", model: "kimi-k2-thinking" }),
    ];

    const meta = deriveSessionMeta(entries, false);
    expect(meta.model).toBe("kimi-k2-thinking");
  });
});

describe("humanizeActivityLabel", () => {
  it("traduce read_text_file a español", () => {
    expect(humanizeActivityLabel("read_text_file")).toBe("Leer archivo");
  });

  it("traduce read text file con espacios a español", () => {
    expect(humanizeActivityLabel("Read text file")).toBe("Leer archivo");
  });

  it("traduce etiquetas con prefijo de herramienta", () => {
    expect(humanizeActivityLabel("fs_tools__read_text_file")).toBe("Leer archivo");
  });
});
