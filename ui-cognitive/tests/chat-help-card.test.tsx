// @vitest-environment happy-dom

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatHelpCard } from "@/components/chat/chat-help-card";

afterEach(() => cleanup());

describe("ChatHelpCard — ops capabilities", () => {
  it("renders Docker container status capability card", () => {
    render(<ChatHelpCard onPromptSelect={() => undefined} />);
    expect(screen.getByText("Estado de containers")).toBeTruthy();
  });

  it("renders schedule_task capability card", () => {
    render(<ChatHelpCard onPromptSelect={() => undefined} />);
    expect(screen.getByText("Tareas programadas")).toBeTruthy();
  });

  it("renders save_note/get_notes capability card", () => {
    render(<ChatHelpCard onPromptSelect={() => undefined} />);
    expect(screen.getByText("Registro de incidentes")).toBeTruthy();
  });

  it("clicking schedule_task card calls onPromptSelect with correct prompt", () => {
    const onPromptSelect = vi.fn();
    render(<ChatHelpCard onPromptSelect={onPromptSelect} />);
    const card = screen.getByRole("button", { name: /Usar capacidad: Tareas programadas/i });
    fireEvent.click(card);
    expect(onPromptSelect).toHaveBeenCalledWith("Listá las tareas programadas activas");
  });

  it("clicking notes card calls onPromptSelect with correct prompt", () => {
    const onPromptSelect = vi.fn();
    render(<ChatHelpCard onPromptSelect={onPromptSelect} />);
    const card = screen.getByRole("button", { name: /Usar capacidad: Registro de incidentes/i });
    fireEvent.click(card);
    expect(onPromptSelect).toHaveBeenCalledWith("¿Qué problemas recurrentes tiene este host?");
  });
});
