// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatHelpCard } from "@/components/chat/chat-help-card";

describe("ChatHelpCard", () => {
  it("renders a professional welcome and technical tips", () => {
    render(<ChatHelpCard onPromptSelect={() => undefined} />);

    expect(screen.getByLabelText(/CGN-Agent — Bienvenida/i)).toBeTruthy();
    expect(screen.getByText(/Inteligencia de código/i)).toBeTruthy();
    expect(screen.getByText("Code Review Técnico")).toBeTruthy();
    expect(screen.getByText("QA y Testing")).toBeTruthy();
    expect(screen.getByText("Auditoría de Seguridad")).toBeTruthy();
    expect(screen.getByText("Documentación")).toBeTruthy();
    expect(screen.queryByText("Comandos disponibles")).toBeNull();
  });
});
