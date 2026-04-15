export type ModelTier = "S" | "A" | "B";

export type ModelCostCategory = "free" | "low" | "medium" | "high" | "unknown";

export type ModelBillingType = "trial" | "paid" | "self-hosted" | "unknown";

export type ModelOpennessCategory = "open-source" | "open-weights" | "source-available";

export type ModelRiskLevel = "low" | "medium" | "high";

export type ModelPolicyTag = "allow" | "warn" | "block";

export type ModelPolicyEnvironment = "development" | "staging" | "production";

export type ModelEntry = {
  key: string;
  displayName: string;
  shortName: string;
  tier: ModelTier;
  costCategory: ModelCostCategory;
  billingType: ModelBillingType;
  opennessCategory: ModelOpennessCategory;
  riskLevel: ModelRiskLevel;
  pricingRef?: string;
  policyTag?: Partial<Record<ModelPolicyEnvironment, ModelPolicyTag>>;
  supportsThinking: boolean;
  isThinkingVariant: boolean;
  supportsVision: boolean;
  defaultForMode: string[];
};

export type ModelCostMetadata = {
  costCategory: ModelCostCategory;
  billingType: ModelBillingType;
  riskLevel: ModelRiskLevel;
  pricingRef: string | null;
};

export type ModelOpennessMetadata = {
  opennessCategory: ModelOpennessCategory;
};

export type ModelVendor = {
  name: string;
  logoUrl?: string;
};

export const MODEL_REGISTRY: ModelEntry[] = [
  {
    key: "qwen_3_5_122b_a10b",
    displayName: "Qwen 3.5 122B (A10B)",
    shortName: "Qwen 122B",
    tier: "S",
    costCategory: "high",
    billingType: "paid",
    opennessCategory: "open-weights",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/qwen/qwen3.5-122b-a10b",
    policyTag: { development: "allow", staging: "warn", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: ["ops", "chat"],
  },
  {
    key: "qwen_3_5_397b_a17b",
    displayName: "Qwen 3.5 397B (A17B)",
    shortName: "Qwen 397B",
    tier: "S",
    costCategory: "high",
    billingType: "paid",
    opennessCategory: "open-weights",
    riskLevel: "high",
    pricingRef: "https://build.nvidia.com/qwen/qwen3.5-397b-a17b",
    policyTag: { development: "warn", staging: "warn", production: "block" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: true,
    defaultForMode: ["ops", "chat"],
  },
  {
    key: "nemotron_3_super_120b_a12b",
    displayName: "Nemotron 3 Super 120B (A12B)",
    shortName: "Nemotron 120B",
    tier: "A",
    costCategory: "medium",
    billingType: "paid",
    opennessCategory: "open-weights",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b",
    policyTag: { development: "allow", staging: "warn", production: "warn" },
    supportsThinking: true,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: ["ops"],
  },
  {
    key: "mistral_small_4_119b_2603",
    displayName: "Mistral Small 4 119B",
    shortName: "Mistral 119B",
    tier: "A",
    costCategory: "medium",
    billingType: "paid",
    opennessCategory: "source-available",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/mistralai/mistral-small-4-119b-2603",
    policyTag: { development: "allow", staging: "warn", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: true,
    defaultForMode: ["ops", "chat"],
  },
];

// Internal key for the thinking variant — not shown in the picker list
export const NEMOTRON_THINKING_KEY = "nemotron_super_thinking";

/**
 * Returns the thinking variant key if the model supports thinking, else null.
 */
export function getThinkingVariant(key: string): string | null {
  const entry = MODEL_REGISTRY.find((m) => m.key === key);
  return entry?.supportsThinking ? NEMOTRON_THINKING_KEY : null;
}

/**
 * Returns the first vision-capable model in the registry, or undefined if none.
 */
export function getDefaultVisionModel(): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.supportsVision);
}

/**
 * Returns the display entry for a given model key (including thinking variant).
 */
export function getModelEntry(key: string): ModelEntry | undefined {
  if (key === NEMOTRON_THINKING_KEY) {
    return MODEL_REGISTRY.find((m) => m.key === "nemotron_3_super_120b_a12b");
  }
  return MODEL_REGISTRY.find((m) => m.key === key);
}

const DEFAULT_UNKNOWN_COST_METADATA: ModelCostMetadata = {
  costCategory: "unknown",
  billingType: "unknown",
  riskLevel: "high",
  pricingRef: null,
};

const normalizeCostMetadata = (entry: Pick<ModelEntry, "costCategory" | "billingType" | "riskLevel" | "pricingRef">): ModelCostMetadata => {
  const costCategory = entry.costCategory ?? DEFAULT_UNKNOWN_COST_METADATA.costCategory;
  const billingType = entry.billingType ?? DEFAULT_UNKNOWN_COST_METADATA.billingType;
  const riskLevel = entry.riskLevel ?? DEFAULT_UNKNOWN_COST_METADATA.riskLevel;
  const pricingRef = typeof entry.pricingRef === "string" && entry.pricingRef.trim().length > 0 ? entry.pricingRef : null;

  return { costCategory, billingType, riskLevel, pricingRef };
};

export function getModelOpennessMetadata(model: string | null | undefined): ModelOpennessMetadata {
  if (typeof model !== "string") {
    return { opennessCategory: "source-available" };
  }

  const canonicalKey = resolveModelKey(model);
  if (!canonicalKey) {
    return { opennessCategory: "source-available" };
  }

  const entry = getModelEntry(canonicalKey);
  if (!entry) {
    return { opennessCategory: "source-available" };
  }

  return { opennessCategory: entry.opennessCategory };
}

export function getModelCostMetadata(model: string | null | undefined): ModelCostMetadata {
  if (typeof model !== "string") {
    return DEFAULT_UNKNOWN_COST_METADATA;
  }

  const canonicalKey = resolveModelKey(model);
  if (!canonicalKey) {
    return DEFAULT_UNKNOWN_COST_METADATA;
  }

  const entry = getModelEntry(canonicalKey);
  if (!entry) {
    return DEFAULT_UNKNOWN_COST_METADATA;
  }

  return normalizeCostMetadata(entry);
}

export function getModelPolicyEnvironment(runtimeEnv?: string): ModelPolicyEnvironment {
  const raw = (runtimeEnv ?? process.env.NEXT_PUBLIC_MODEL_POLICY_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
  if (raw.includes("prod")) {
    return "production";
  }
  if (raw.includes("stag")) {
    return "staging";
  }
  return "development";
}

export function getModelPolicyTag(model: string | null | undefined, runtimeEnv?: string): ModelPolicyTag {
  const env = getModelPolicyEnvironment(runtimeEnv);
  const canonicalKey = typeof model === "string" ? resolveModelKey(model) : undefined;
  if (!canonicalKey) {
    return env === "production" ? "block" : "warn";
  }

  const entry = getModelEntry(canonicalKey);
  if (!entry) {
    return env === "production" ? "block" : "warn";
  }

  const explicitTag = entry.policyTag?.[env];
  if (explicitTag) {
    return explicitTag;
  }

  if (entry.riskLevel === "high") {
    return env === "production" ? "block" : "warn";
  }

  return env === "development" ? "allow" : "warn";
}

const MODEL_KEY_ALIASES: Record<string, string> = {
  // Internal keys
  qwen_3_5_122b_a10b: "qwen_3_5_122b_a10b",
  qwen_3_5_397b_a17b: "qwen_3_5_397b_a17b",
  nemotron_3_super_120b_a12b: "nemotron_3_super_120b_a12b",
  mistral_small_4_119b_2603: "mistral_small_4_119b_2603",
  nemotron_super_thinking: "nemotron_3_super_120b_a12b",

  // Legacy internal keys
  devstral: "mistral_small_4_119b_2603",
  qwen_coder: "qwen_3_5_122b_a10b",
  deepseek_v3: "qwen_3_5_122b_a10b",
  glm_4_7: "qwen_3_5_122b_a10b",
  step_3_5_flash: "qwen_3_5_122b_a10b",
  kimi_reader: "qwen_3_5_122b_a10b",
  kimi_thinking: "qwen_3_5_397b_a17b",
  nemotron_super: "nemotron_3_super_120b_a12b",
  gemma_4_31b_it: "qwen_3_5_397b_a17b",

  // Provider model names (from backend config)
  "qwen/qwen3.5-122b-a10b": "qwen_3_5_122b_a10b",
  "qwen/qwen3.5-397b-a17b": "qwen_3_5_397b_a17b",
  "nvidia/nemotron-3-super-120b-a12b": "nemotron_3_super_120b_a12b",
  "mistralai/mistral-small-4-119b-2603": "mistral_small_4_119b_2603",

  // Common human-readable aliases in events/tests/logs
  "qwen 3.5 122b": "qwen_3_5_122b_a10b",
  "qwen 3.5 397b": "qwen_3_5_397b_a17b",
  "nemotron 3 super 120b": "nemotron_3_super_120b_a12b",
  "mistral small 4": "mistral_small_4_119b_2603",
};

const MODEL_VENDOR_BY_KEY: Record<string, ModelVendor> = {
  qwen_3_5_122b_a10b: {
    name: "Qwen",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Alibaba_cloud_logo.svg",
  },
  qwen_3_5_397b_a17b: {
    name: "Qwen",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Alibaba_cloud_logo.svg",
  },
  nemotron_3_super_120b_a12b: { name: "NVIDIA" },
  mistral_small_4_119b_2603: { name: "Mistral AI" },
};

/**
 * Maps raw model identifiers (provider IDs, aliases, or internal keys)
 * to a canonical registry key when possible.
 */
export function resolveModelKey(model: string): string | undefined {
  const trimmed = model.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const lowered = trimmed.toLowerCase();
  const normalized = lowered.replace(/\s+/g, " ");

  return MODEL_KEY_ALIASES[trimmed] ?? MODEL_KEY_ALIASES[lowered] ?? MODEL_KEY_ALIASES[normalized];
}

/**
 * Returns a user-facing model label for any known identifier.
 */
export function getModelDisplayName(model: string | null | undefined): string | null {
  if (typeof model !== "string") {
    return null;
  }

  const canonicalKey = resolveModelKey(model);
  if (!canonicalKey) {
    return model.trim().length > 0 ? model : null;
  }

  return getModelEntry(canonicalKey)?.displayName ?? model;
}

/**
 * Returns vendor metadata (name and optional logo URL) for known model identifiers.
 */
export function getModelVendor(model: string | null | undefined): ModelVendor | null {
  if (typeof model !== "string") {
    return null;
  }

  const canonicalKey = resolveModelKey(model);
  if (!canonicalKey) {
    return null;
  }

  return MODEL_VENDOR_BY_KEY[canonicalKey] ?? null;
}
