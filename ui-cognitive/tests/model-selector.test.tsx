// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModelSelectorChip } from "@/components/chat/model-selector";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_MODEL_POLICY_ENV = "development";
});

describe("ModelSelectorChip vendor badges", () => {
  it("shows vendor logo in chip for selected model", () => {
    render(
      <ModelSelectorChip
        model="qwen_3_5_122b_a10b"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Qwen logo")).toBeTruthy();
  });

  it("shows vendor badge in dropdown model options", () => {
    render(
        <ModelSelectorChip
        model="qwen_3_5_122b_a10b"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));

    expect(screen.getAllByText("Qwen").length).toBeGreaterThan(0);
    expect(screen.getByText("NVIDIA")).toBeTruthy();
    expect(screen.getByText("Mistral AI")).toBeTruthy();
  });

  it("shows openness badges in dropdown options", () => {
    render(
        <ModelSelectorChip
        model="qwen_3_5_122b_a10b"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));
    expect(screen.getAllByText("Pesos abiertos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fuente disponible").length).toBeGreaterThan(0);
  });

  it("does not ask for cost confirmation when selecting model", () => {
    const onModelChange = vi.fn();
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);

    render(
        <ModelSelectorChip
        model="qwen_3_5_122b_a10b"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={onModelChange}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));
    fireEvent.click(screen.getByRole("option", { name: /Nemotron 3 Super 120B/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onModelChange).toHaveBeenCalledWith("nemotron_3_super_120b_a12b");
    vi.unstubAllGlobals();
  });

  it("blocks selection when policy is block", () => {
    process.env.NEXT_PUBLIC_MODEL_POLICY_ENV = "production";

    render(
        <ModelSelectorChip
        model="qwen_3_5_122b_a10b"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));
    const blockedOption = screen.getByRole("option", { name: /Qwen 3\.5 397B/i });
    expect(blockedOption.getAttribute("disabled")).not.toBeNull();
  });
});
