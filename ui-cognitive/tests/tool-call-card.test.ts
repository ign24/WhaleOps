import { describe, expect, it } from "vitest";

import { isSpawnAgentShape, tryParsePythonDict } from "@/components/activity/tool-call-card";

describe("isSpawnAgentShape", () => {
  it("detects object with task string as spawn agent shape", () => {
    expect(isSpawnAgentShape({ task: "do something" })).toBe(true);
  });

  it("detects object with task, tools, and max_iterations", () => {
    expect(
      isSpawnAgentShape({
        task: "run pylint",
        tools: ["run_shell_command", "fs_tools__read_text_file"],
        max_iterations: 20,
      }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isSpawnAgentShape(null)).toBe(false);
  });

  it("rejects array", () => {
    expect(isSpawnAgentShape([])).toBe(false);
  });

  it("rejects object without task", () => {
    expect(isSpawnAgentShape({ tools: ["x"] })).toBe(false);
  });

  it("rejects string", () => {
    expect(isSpawnAgentShape("task string")).toBe(false);
  });
});

describe("tryParsePythonDict", () => {
  it("parses standard JSON", () => {
    const result = tryParsePythonDict('{"task": "do something", "max_iterations": 5}');
    expect(result).toEqual({ task: "do something", max_iterations: 5 });
  });

  it("parses Python dict with single quotes", () => {
    const result = tryParsePythonDict(
      "{'task': 'run pylint', 'tools': ['run_shell_command', 'run_pylint'], 'max_iterations': 20}",
    );
    expect(result).toEqual({
      task: "run pylint",
      tools: ["run_shell_command", "run_pylint"],
      max_iterations: 20,
    });
  });

  it("converts Python True/False/None", () => {
    const result = tryParsePythonDict("{'active': True, 'count': None, 'done': False}") as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.active).toBe(true);
    expect(result.count).toBeNull();
    expect(result.done).toBe(false);
  });

  it("returns null for invalid input", () => {
    expect(tryParsePythonDict("not a dict at all")).toBeNull();
  });
});
