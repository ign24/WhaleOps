// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TerminalBlock } from "@/components/activity/terminal-block";

afterEach(() => cleanup());

describe("TerminalBlock", () => {
  it("shows command text", () => {
    const { container } = render(
      <TerminalBlock command="git status" output={null} returnCodeSummary={undefined} />,
    );
    const cmd = container.querySelector("[data-testid='terminal-command']");
    expect(cmd).not.toBeNull();
    expect(cmd!.textContent).toContain("git status");
  });

  it("renders success badge when returnCodeSummary contains rc=0", () => {
    const { container } = render(
      <TerminalBlock command="ls" output={null} returnCodeSummary="rc=0 (success)" />,
    );
    const badge = container.querySelector("[class*='var(--success)']");
    expect(badge).not.toBeNull();
  });

  it("renders error badge when returnCodeSummary is non-zero", () => {
    const { container } = render(
      <TerminalBlock command="ls" output={null} returnCodeSummary="rc=1 (error)" />,
    );
    const badge = container.querySelector("[class*='var(--error)']");
    expect(badge).not.toBeNull();
  });

  it("renders no return-code badge when returnCodeSummary is absent", () => {
    const { container } = render(
      <TerminalBlock command="ls" output={null} returnCodeSummary={undefined} />,
    );
    // badge spans have both rounded-full AND border AND font-mono
    const badges = Array.from(container.querySelectorAll("span.rounded-full")).filter(
      (el) => el.className.includes("font-mono"),
    );
    expect(badges.length).toBe(0);
  });

  it("does not show <pre> by default (collapsed)", () => {
    const { container } = render(
      <TerminalBlock command="ls" output="file.txt" returnCodeSummary={undefined} />,
    );
    const pre = container.querySelector("pre");
    expect(pre).toBeNull();
  });

  it("shows output in <pre> after clicking expand area", () => {
    const { container } = render(
      <TerminalBlock command="ls" output="file.txt\ndir/" returnCodeSummary={undefined} />,
    );
    const expandArea = container.querySelector("[role='button']");
    expect(expandArea).not.toBeNull();
    fireEvent.click(expandArea!);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain("file.txt");
  });

  it("collapses output on second click", () => {
    const { container } = render(
      <TerminalBlock command="ls" output="file.txt" returnCodeSummary={undefined} />,
    );
    const expandArea = container.querySelector("[role='button']");
    fireEvent.click(expandArea!);
    expect(container.querySelector("pre")).not.toBeNull();
    fireEvent.click(expandArea!);
    expect(container.querySelector("pre")).toBeNull();
  });

  it("extracts content field from JSON toolResult", () => {
    const jsonOutput = JSON.stringify({ content: "on branch main", status: "ok" });
    const { container } = render(
      <TerminalBlock command="git status" output={jsonOutput} returnCodeSummary={undefined} />,
    );
    const expandArea = container.querySelector("[role='button']");
    fireEvent.click(expandArea!);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain("on branch main");
    expect(pre!.textContent).not.toContain('"content"');
  });

  it("renders macOS-style window dots", () => {
    const { container } = render(
      <TerminalBlock command="echo hi" output={null} returnCodeSummary={undefined} />,
    );
    const dots = container.querySelectorAll(".rounded-full");
    // 3 traffic-light dots
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it("renders nothing when all props are empty", () => {
    const { container } = render(
      <TerminalBlock command={null} output={null} returnCodeSummary={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
