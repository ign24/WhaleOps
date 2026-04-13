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
  // Tier S — coding-first, large
  {
    key: "devstral",
    displayName: "Devstral 123B",
    shortName: "Devstral",
    tier: "S",
    costCategory: "medium",
    billingType: "paid",
    opennessCategory: "source-available",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "allow", staging: "warn", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: ["analyze", "execute"],
  },
  {
    key: "qwen_coder",
    displayName: "Qwen3 Coder 480B",
    shortName: "Qwen Coder",
    tier: "S",
    costCategory: "high",
    billingType: "paid",
    opennessCategory: "open-source",
    riskLevel: "high",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "warn", staging: "warn", production: "block" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: [],
  },
  // Tier A — strong general/reasoning models with tool calling
  {
    key: "deepseek_v3",
    displayName: "DeepSeek V3.2",
    shortName: "DeepSeek V3",
    tier: "A",
    costCategory: "medium",
    billingType: "paid",
    opennessCategory: "open-source",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "allow", staging: "warn", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: [],
  },
  {
    key: "glm_4_7",
    displayName: "GLM 4.7",
    shortName: "GLM 4.7",
    tier: "A",
    costCategory: "medium",
    billingType: "paid",
    opennessCategory: "open-source",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "allow", staging: "warn", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: [],
  },
  {
    key: "step_3_5_flash",
    displayName: "Step 3.5 Flash",
    shortName: "Step 3.5",
    tier: "A",
    costCategory: "low",
    billingType: "paid",
    opennessCategory: "open-source",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "allow", staging: "allow", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: [],
  },
  {
    key: "kimi_thinking",
    displayName: "Kimi K2.5 Thinking",
    shortName: "Kimi Thinking",
    tier: "A",
    costCategory: "high",
    billingType: "paid",
    opennessCategory: "source-available",
    riskLevel: "high",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "warn", staging: "warn", production: "block" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: [],
  },
  {
    key: "kimi_reader",
    displayName: "Kimi K2",
    shortName: "Kimi",
    tier: "B",
    costCategory: "low",
    billingType: "paid",
    opennessCategory: "source-available",
    riskLevel: "medium",
    pricingRef: "https://build.nvidia.com/",
    policyTag: { development: "allow", staging: "allow", production: "warn" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: ["chat"],
  },
  {
    key: "nemotron_super",
    displayName: "Nemotron Super 49B",
    shortName: "Nemotron",
    tier: "A",
    costCategory: "free",
    billingType: "trial",
    opennessCategory: "open-weights",
    riskLevel: "low",
    pricingRef: "https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317",
    policyTag: { development: "allow", staging: "allow", production: "warn" },
    supportsThinking: true,
    isThinkingVariant: false,
    supportsVision: false,
    defaultForMode: [],
  },
  {
    key: "gemma_4_31b_it",
    displayName: "Gemma 4 31B IT",
    shortName: "Gemma 4",
    tier: "B",
    costCategory: "unknown",
    billingType: "unknown",
    opennessCategory: "open-source",
    riskLevel: "high",
    pricingRef: "https://build.nvidia.com/google/gemma-4-31b-it",
    policyTag: { development: "warn", staging: "warn", production: "block" },
    supportsThinking: false,
    isThinkingVariant: false,
    supportsVision: true,
    defaultForMode: ["chat"],
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
    return MODEL_REGISTRY.find((m) => m.key === "nemotron_super");
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
  devstral: "devstral",
  qwen_coder: "qwen_coder",
  deepseek_v3: "deepseek_v3",
  glm_4_7: "glm_4_7",
  step_3_5_flash: "step_3_5_flash",
  kimi_reader: "kimi_reader",
  kimi_thinking: "kimi_thinking",
  nemotron_super: "nemotron_super",
  nemotron_super_thinking: "nemotron_super",
  gemma_4_31b_it: "gemma_4_31b_it",

  // Provider model names (from backend config)
  "mistralai/devstral-2-123b-instruct-2512": "devstral",
  "qwen/qwen3-coder-480b-a35b-instruct": "qwen_coder",
  "deepseek-ai/deepseek-v3.2": "deepseek_v3",
  "z-ai/glm4.7": "glm_4_7",
  "stepfun-ai/step-3.5-flash": "step_3_5_flash",
  "moonshotai/kimi-k2-instruct-0905": "kimi_reader",
  "moonshotai/kimi-k2-thinking": "kimi_thinking",
  "nvidia/llama-3.3-nemotron-super-49b-v1": "nemotron_super",
  "google/gemma-4-31b-it": "gemma_4_31b_it",

  // Common human-readable aliases in events/tests/logs
  "kimi-k2": "kimi_reader",
  "kimi-k2.5": "kimi_reader",
  "kimi k2": "kimi_reader",
  "kimi k2.5": "kimi_reader",
  "kimi-k2-thinking": "kimi_thinking",
  "kimi-k2.5-thinking": "kimi_thinking",
  "kimi k2 thinking": "kimi_thinking",
  "kimi k2.5 thinking": "kimi_thinking",
  "deepseek-v3": "deepseek_v3",
  "deepseek-v3.2": "deepseek_v3",
  glm4_7: "glm_4_7",
  "glm-4.7": "glm_4_7",
  "glm 4.7": "glm_4_7",
  "step 3.5 flash": "step_3_5_flash",
  "step-3.5-flash": "step_3_5_flash",
};

const MODEL_VENDOR_BY_KEY: Record<string, ModelVendor> = {
  devstral: { name: "Mistral" },
  qwen_coder: { name: "Qwen" },
  deepseek_v3: { name: "DeepSeek" },
  glm_4_7: {
    name: "Z.ai",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Z.ai_%28company_logo%29.svg",
  },
  step_3_5_flash: {
    name: "StepFun",
    logoUrl: "https://platform.stepfun.ai/images/title-logo.png",
  },
  kimi_reader: { name: "Moonshot AI" },
  kimi_thinking: { name: "Moonshot AI" },
  nemotron_super: { name: "NVIDIA" },
  nemotron_super_thinking: { name: "NVIDIA" },
  gemma_4_31b_it: { name: "Google" },
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
