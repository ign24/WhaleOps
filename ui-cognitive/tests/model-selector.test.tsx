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
        model="step_3_5_flash"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    expect(screen.getByAltText("StepFun logo")).toBeTruthy();
  });

  it("shows vendor badge in dropdown model options", () => {
    render(
      <ModelSelectorChip
        model="glm_4_7"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));

    expect(screen.getByText("StepFun")).toBeTruthy();
    expect(screen.getByText("Z.ai")).toBeTruthy();
  });

  it("shows openness badges in dropdown options", () => {
    render(
      <ModelSelectorChip
        model="glm_4_7"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));
    expect(screen.getAllByText("Open Source").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Source Available").length).toBeGreaterThan(0);
  });

  it("does not ask for cost confirmation when selecting model", () => {
    const onModelChange = vi.fn();
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);

    render(
      <ModelSelectorChip
        model="glm_4_7"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={onModelChange}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));
    fireEvent.click(screen.getByRole("option", { name: /DeepSeek V3\.2/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onModelChange).toHaveBeenCalledWith("deepseek_v3");
    vi.unstubAllGlobals();
  });

  it("blocks selection when policy is block", () => {
    process.env.NEXT_PUBLIC_MODEL_POLICY_ENV = "production";

    render(
      <ModelSelectorChip
        model="glm_4_7"
        thinking={false}
        temperaturePreset="medium"
        onModelChange={vi.fn()}
        onThinkingToggle={vi.fn()}
        onTemperatureChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Cambiar modelo"));
    const blockedOption = screen.getByRole("option", { name: /Kimi K2\.5 Thinking/i });
    expect(blockedOption.getAttribute("disabled")).not.toBeNull();
  });
});
