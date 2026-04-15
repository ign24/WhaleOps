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
    expect(result!.key).toBe("qwen_3_5_397b_a17b");
  });

  it("contains all switchable backend models in frontend registry", () => {
    const keys = new Set(MODEL_REGISTRY.map((entry) => entry.key));
    expect(keys.has("qwen_3_5_122b_a10b")).toBe(true);
    expect(keys.has("qwen_3_5_397b_a17b")).toBe(true);
    expect(keys.has("nemotron_3_super_120b_a12b")).toBe(true);
    expect(keys.has("mistral_small_4_119b_2603")).toBe(true);
  });
});

describe("resolveModelKey", () => {
  it("resolves backend provider model names to registry keys", () => {
    expect(resolveModelKey("qwen/qwen3.5-122b-a10b")).toBe("qwen_3_5_122b_a10b");
    expect(resolveModelKey("qwen/qwen3.5-397b-a17b")).toBe("qwen_3_5_397b_a17b");
    expect(resolveModelKey("nvidia/nemotron-3-super-120b-a12b")).toBe("nemotron_3_super_120b_a12b");
    expect(resolveModelKey("mistralai/mistral-small-4-119b-2603")).toBe("mistral_small_4_119b_2603");
  });

  it("resolves legacy aliases to canonical keys", () => {
    expect(resolveModelKey("devstral")).toBe("mistral_small_4_119b_2603");
    expect(resolveModelKey("nemotron_super")).toBe("nemotron_3_super_120b_a12b");
    expect(resolveModelKey("qwen_coder")).toBe("qwen_3_5_122b_a10b");
  });
});

describe("getModelDisplayName", () => {
  it("returns canonical display names for known aliases", () => {
    expect(getModelDisplayName("qwen/qwen3.5-122b-a10b")).toBe("Qwen 3.5 122B (A10B)");
    expect(getModelDisplayName("nvidia/nemotron-3-super-120b-a12b")).toBe("Nemotron 3 Super 120B (A12B)");
    expect(getModelDisplayName("mistralai/mistral-small-4-119b-2603")).toBe("Mistral Small 4 119B");
  });

  it("returns null for nullish and preserves unknown model IDs", () => {
    expect(getModelDisplayName(null)).toBeNull();
    expect(getModelDisplayName(undefined)).toBeNull();
    expect(getModelDisplayName("custom/provider-model")).toBe("custom/provider-model");
  });
});

describe("getModelVendor", () => {
  it("returns vendor metadata for known models", () => {
    expect(getModelVendor("qwen_3_5_122b_a10b")?.name).toBe("Qwen");
    expect(getModelVendor("qwen/qwen3.5-397b-a17b")?.name).toBe("Qwen");
    expect(getModelVendor("nvidia/nemotron-3-super-120b-a12b")?.name).toBe("NVIDIA");
    expect(getModelVendor("mistralai/mistral-small-4-119b-2603")?.name).toBe("Mistral AI");
  });

  it("returns null for unknown models", () => {
    expect(getModelVendor("custom/provider-model")).toBeNull();
  });
});

describe("model cost metadata and policies", () => {
  it("returns canonical cost metadata for known models", () => {
    const meta = getModelCostMetadata("nemotron_3_super_120b_a12b");
    expect(meta.costCategory).toBe("medium");
    expect(meta.billingType).toBe("paid");
    expect(meta.riskLevel).toBe("medium");
  });

  it("returns unknown/high defaults for unknown models", () => {
    const meta = getModelCostMetadata("custom/provider-model");
    expect(meta.costCategory).toBe("unknown");
    expect(meta.billingType).toBe("unknown");
    expect(meta.riskLevel).toBe("high");
  });

  it("enforces block/warn/allow policy by environment", () => {
    expect(getModelPolicyTag("qwen_3_5_397b_a17b", "production")).toBe("block");
    expect(getModelPolicyTag("qwen_3_5_397b_a17b", "staging")).toBe("warn");
    expect(getModelPolicyTag("qwen_3_5_122b_a10b", "development")).toBe("allow");
  });
});
