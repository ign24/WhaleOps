import { describe, it, expect } from "vitest";
import {
  getDefaultVisionModel,
  getModelCostMetadata,
  getModelDisplayName,
  getModelPolicyTag,
  getModelVendor,
  MODEL_REGISTRY,
  resolveModelKey,
} from "@/lib/model-registry";

describe("getDefaultVisionModel", () => {
  it("returns the first model with supportsVision: true", () => {
    const result = getDefaultVisionModel();
    expect(result).toBeDefined();
    expect(result!.supportsVision).toBe(true);
    expect(result!.key).toBe("gemma_4_31b_it");
  });

  it("contains all switchable backend models in frontend registry", () => {
    const keys = new Set(MODEL_REGISTRY.map((entry) => entry.key));
    expect(keys.has("devstral")).toBe(true);
    expect(keys.has("qwen_coder")).toBe(true);
    expect(keys.has("deepseek_v3")).toBe(true);
    expect(keys.has("glm_4_7")).toBe(true);
    expect(keys.has("step_3_5_flash")).toBe(true);
    expect(keys.has("kimi_reader")).toBe(true);
    expect(keys.has("kimi_thinking")).toBe(true);
    expect(keys.has("nemotron_super")).toBe(true);
    expect(keys.has("gemma_4_31b_it")).toBe(true);
  });
});

describe("resolveModelKey", () => {
  it("resolves backend provider model names to registry keys", () => {
    expect(resolveModelKey("moonshotai/kimi-k2-instruct-0905")).toBe("kimi_reader");
    expect(resolveModelKey("qwen/qwen3-coder-480b-a35b-instruct")).toBe("qwen_coder");
    expect(resolveModelKey("moonshotai/kimi-k2-thinking")).toBe("kimi_thinking");
    expect(resolveModelKey("z-ai/glm4.7")).toBe("glm_4_7");
    expect(resolveModelKey("stepfun-ai/step-3.5-flash")).toBe("step_3_5_flash");
    expect(resolveModelKey("google/gemma-4-31b-it")).toBe("gemma_4_31b_it");
  });

  it("resolves common aliases", () => {
    expect(resolveModelKey("kimi-k2")).toBe("kimi_reader");
    expect(resolveModelKey("kimi-k2.5")).toBe("kimi_reader");
    expect(resolveModelKey("kimi-k2-thinking")).toBe("kimi_thinking");
    expect(resolveModelKey("kimi-k2.5-thinking")).toBe("kimi_thinking");
    expect(resolveModelKey("deepseek-v3")).toBe("deepseek_v3");
  });
});

describe("getModelDisplayName", () => {
  it("returns canonical display names for known aliases", () => {
    expect(getModelDisplayName("moonshotai/kimi-k2-instruct-0905")).toBe("Kimi K2");
    expect(getModelDisplayName("moonshotai/kimi-k2-thinking")).toBe("Kimi K2.5 Thinking");
    expect(getModelDisplayName("z-ai/glm4.7")).toBe("GLM 4.7");
    expect(getModelDisplayName("stepfun-ai/step-3.5-flash")).toBe("Step 3.5 Flash");
  });

  it("returns null for nullish and preserves unknown model IDs", () => {
    expect(getModelDisplayName(null)).toBeNull();
    expect(getModelDisplayName(undefined)).toBeNull();
    expect(getModelDisplayName("custom/provider-model")).toBe("custom/provider-model");
  });
});

describe("getModelVendor", () => {
  it("returns vendor metadata for known models", () => {
    expect(getModelVendor("qwen_coder")?.name).toBe("Qwen");
    expect(getModelVendor("moonshotai/kimi-k2-instruct-0905")?.name).toBe("Moonshot AI");
    expect(getModelVendor("z-ai/glm4.7")?.name).toBe("Z.ai");
    expect(getModelVendor("stepfun-ai/step-3.5-flash")?.name).toBe("StepFun");
    expect(getModelVendor("gemma_4_31b_it")?.name).toBe("Google");
  });

  it("returns null for unknown models", () => {
    expect(getModelVendor("custom/provider-model")).toBeNull();
  });
});

describe("model cost metadata and policies", () => {
  it("returns canonical cost metadata for known models", () => {
    const meta = getModelCostMetadata("nemotron_super");
    expect(meta.costCategory).toBe("free");
    expect(meta.billingType).toBe("trial");
    expect(meta.riskLevel).toBe("low");
  });

  it("returns unknown/high defaults for unknown models", () => {
    const meta = getModelCostMetadata("custom/provider-model");
    expect(meta.costCategory).toBe("unknown");
    expect(meta.billingType).toBe("unknown");
    expect(meta.riskLevel).toBe("high");
  });

  it("enforces block/warn/allow policy by environment", () => {
    expect(getModelPolicyTag("kimi_thinking", "production")).toBe("block");
    expect(getModelPolicyTag("kimi_thinking", "staging")).toBe("warn");
    expect(getModelPolicyTag("nemotron_super", "development")).toBe("allow");
  });
});
