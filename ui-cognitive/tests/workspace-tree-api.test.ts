import { describe, expect, it } from "vitest";
import { ALLOWED_ROOTS, isAllowedPath, parseGitStatus } from "@/lib/workspace-tree";

describe("isAllowedPath", () => {
  it("allows exact /tmp/analysis root", () => {
    expect(isAllowedPath("/tmp/analysis")).toBe(true);
  });

  it("allows path inside /tmp/analysis", () => {
    expect(isAllowedPath("/tmp/analysis/sqlmap")).toBe(true);
  });

  it("allows nested path inside /tmp/analysis", () => {
    expect(isAllowedPath("/tmp/analysis/myrepo/src/main.py")).toBe(true);
  });

  it("allows exact /app/workspace root", () => {
    expect(isAllowedPath("/app/workspace")).toBe(true);
  });

  it("allows path inside /app/workspace", () => {
    expect(isAllowedPath("/app/workspace/project")).toBe(true);
  });

  it("rejects /tmp (parent of allowed root)", () => {
    expect(isAllowedPath("/tmp")).toBe(false);
  });

  it("rejects /tmp/analysis_evil (prefix without boundary)", () => {
    expect(isAllowedPath("/tmp/analysis_evil")).toBe(false);
  });

  it("rejects path traversal attempt", () => {
    expect(isAllowedPath("/tmp/analysis/../etc/passwd")).toBe(false);
  });

  it("rejects /etc/passwd", () => {
    expect(isAllowedPath("/etc/passwd")).toBe(false);
  });

  it("rejects /home user directory", () => {
    expect(isAllowedPath("/home/user/.ssh/id_rsa")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isAllowedPath("")).toBe(false);
  });

  it("rejects root /", () => {
    expect(isAllowedPath("/")).toBe(false);
  });

  it("ALLOWED_ROOTS contains both sandbox roots", () => {
    expect(ALLOWED_ROOTS).toContain("/tmp/analysis");
    expect(ALLOWED_ROOTS).toContain("/app/workspace");
  });
});

describe("parseGitStatus", () => {
  it("parses modified file", () => {
    const result = parseGitStatus(" M src/main.py\n");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ status: "M", path: "src/main.py" });
  });

  it("parses untracked file", () => {
    const result = parseGitStatus("?? newfile.txt\n");
    expect(result[0]).toEqual({ status: "??", path: "newfile.txt" });
  });

  it("parses multiple lines", () => {
    const result = parseGitStatus(" M a.py\n?? b.txt\nD  c.py\n");
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty stdout", () => {
    expect(parseGitStatus("")).toHaveLength(0);
  });

  it("skips blank lines", () => {
    expect(parseGitStatus("\n\n M file.py\n\n")).toHaveLength(1);
  });

  it("caps at 100 entries", () => {
    const lines = Array.from({ length: 150 }, (_, i) => ` M file${i}.py`).join("\n");
    expect(parseGitStatus(lines)).toHaveLength(100);
  });
});
