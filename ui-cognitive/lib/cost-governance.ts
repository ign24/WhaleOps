import { GatewayChatMessage, TokenUsage } from "@/types/chat";
import {
  ModelCostCategory,
  getModelCostMetadata,
  getModelPolicyEnvironment,
  getModelPolicyTag,
  resolveModelKey,
} from "@/lib/model-registry";

export type BudgetState = "ok" | "warning" | "limited";

export type GuardrailEvent = "none" | "warning" | "fallback" | "block";

export type BudgetAction = "fallback" | "block";

export type CostGovernanceConfig = {
  enabled: boolean;
  enforceSoftLimit: boolean;
  enforceHardLimit: boolean;
  softLimitUsd: number;
  hardLimitUsd: number;
  hardLimitAction: BudgetAction;
  fallbackModelKey: string;
  policyEnvironment: "development" | "staging" | "production";
};

export type CostEstimate = {
  amountUsd: number;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
};

type UsageTotals = {
  totalUsd: number;
  perModelUsd: Map<string, number>;
};

type PreflightInput = {
  userId: string;
  sessionKey: string;
  requestedModel: string;
  estimatedRequestUsd: number;
  config: CostGovernanceConfig;
};

export type PreflightResult = {
  allowed: boolean;
  effectiveModel: string;
  budgetState: BudgetState;
  guardrailEvent: GuardrailEvent;
  warningMessage: string | null;
  fallbackFromModel?: string;
  sessionTotalUsd: number;
  userTotalUsd: number;
};

export type CostSnapshot = {
  totalUsd: number;
  perModel: Array<{ model: string; totalUsd: number }>;
};

const DEFAULT_CONFIG: CostGovernanceConfig = {
  enabled: true,
  enforceSoftLimit: true,
  enforceHardLimit: true,
  softLimitUsd: 0.15,
  hardLimitUsd: 0.30,
  hardLimitAction: "fallback",
  fallbackModelKey: "qwen_3_5_122b_a10b",
  policyEnvironment: getModelPolicyEnvironment(process.env.MODEL_POLICY_ENV),
};

const MIN_BUDGET_LIMIT_USD = 0.00001;
const MIN_BUDGET_GAP_USD = 0.00001;

const MODEL_PRICING_PER_1K_TOKENS_USD: Record<string, { input: number; output: number }> = {
  qwen_3_5_122b_a10b: { input: 0.0080, output: 0.0200 },
  qwen_3_5_397b_a17b: { input: 0.0120, output: 0.0300 },
  nemotron_3_super_120b_a12b: { input: 0.0030, output: 0.0080 },
  mistral_small_4_119b_2603: { input: 0.0060, output: 0.0160 },
  nemotron_super_thinking: { input: 0.0030, output: 0.0080 },
};

const sessionBudgetStore = new Map<string, UsageTotals>();
const userBudgetStore = new Map<string, UsageTotals>();

const estimateTokensFromText = (text: string): number => {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
};

const estimatePromptTokens = (messages: GatewayChatMessage[]): number => {
  return messages.reduce((total, message) => {
    if (typeof message.content === "string") {
      return total + estimateTokensFromText(message.content);
    }

    const blocksText = message.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join(" ");

    return total + estimateTokensFromText(blocksText);
  }, 0);
};

const getPricingForModel = (model: string): { input: number; output: number } => {
  const canonical = resolveModelKey(model) ?? model;
  const pricing = MODEL_PRICING_PER_1K_TOKENS_USD[canonical];
  if (pricing) {
    return pricing;
  }

  const costMeta = getModelCostMetadata(canonical);
  if (costMeta.costCategory === "free") {
    return { input: 0, output: 0 };
  }

  return { input: 0.01, output: 0.02 };
};

const ensureUsageTotals = (store: Map<string, UsageTotals>, key: string): UsageTotals => {
  const existing = store.get(key);
  if (existing) {
    return existing;
  }

  const created: UsageTotals = {
    totalUsd: 0,
    perModelUsd: new Map<string, number>(),
  };
  store.set(key, created);
  return created;
};

const roundUsd = (value: number): number => Number(value.toFixed(6));

const classifyBudgetState = (totalUsd: number, config: CostGovernanceConfig): BudgetState => {
  if (totalUsd >= config.hardLimitUsd) {
    return "limited";
  }
  if (totalUsd >= config.softLimitUsd) {
    return "warning";
  }
  return "ok";
};

export const readCostGovernanceConfig = (): CostGovernanceConfig => {
  const enabled = process.env.MODEL_COST_GUARDRAILS_ENABLED !== "0";
  const enforceSoftLimit = process.env.MODEL_COST_SOFT_LIMIT_ENABLED !== "0";
  const enforceHardLimit = process.env.MODEL_COST_HARD_LIMIT_ENABLED !== "0";

  const softLimitRaw = Number(process.env.MODEL_COST_SOFT_LIMIT_USD ?? DEFAULT_CONFIG.softLimitUsd);
  const hardLimitRaw = Number(process.env.MODEL_COST_HARD_LIMIT_USD ?? DEFAULT_CONFIG.hardLimitUsd);

  const hardLimitActionRaw = (process.env.MODEL_COST_HARD_ACTION ?? DEFAULT_CONFIG.hardLimitAction).toLowerCase();
  const hardLimitAction: BudgetAction = hardLimitActionRaw === "block" ? "block" : "fallback";

  const fallbackModelKey = process.env.MODEL_COST_FALLBACK_MODEL_KEY ?? DEFAULT_CONFIG.fallbackModelKey;
  const policyEnvironment = getModelPolicyEnvironment(process.env.MODEL_POLICY_ENV);

  const normalizedSoftLimit =
    Number.isFinite(softLimitRaw) && softLimitRaw > 0
      ? Math.max(MIN_BUDGET_LIMIT_USD, softLimitRaw)
      : DEFAULT_CONFIG.softLimitUsd;
  const normalizedHardCandidate =
    Number.isFinite(hardLimitRaw) && hardLimitRaw > 0
      ? Math.max(MIN_BUDGET_LIMIT_USD, hardLimitRaw)
      : DEFAULT_CONFIG.hardLimitUsd;
  const normalizedHardLimit = Math.max(normalizedHardCandidate, normalizedSoftLimit + MIN_BUDGET_GAP_USD);

  return {
    enabled,
    enforceSoftLimit,
    enforceHardLimit,
    softLimitUsd: normalizedSoftLimit,
    hardLimitUsd: normalizedHardLimit,
    hardLimitAction,
    fallbackModelKey,
    policyEnvironment,
  };
};

export const estimateRequestCost = (messages: GatewayChatMessage[], model: string): CostEstimate => {
  const estimatedPromptTokens = estimatePromptTokens(messages);
  const estimatedCompletionTokens = Math.max(64, Math.floor(estimatedPromptTokens * 0.35));
  const pricing = getPricingForModel(model);
  const amountUsd =
    (estimatedPromptTokens / 1000) * pricing.input +
    (estimatedCompletionTokens / 1000) * pricing.output;

  return {
    amountUsd: roundUsd(Math.max(0, amountUsd)),
    estimatedPromptTokens,
    estimatedCompletionTokens,
  };
};

export const evaluateBudgetPreflight = ({
  userId,
  sessionKey,
  requestedModel,
  estimatedRequestUsd,
  config,
}: PreflightInput): PreflightResult => {
  const sessionTotals = ensureUsageTotals(sessionBudgetStore, sessionKey);
  const userTotals = ensureUsageTotals(userBudgetStore, userId);
  const currentSessionTotal = sessionTotals.totalUsd;
  const currentUserTotal = userTotals.totalUsd;
  const projectedSessionTotal = currentSessionTotal + estimatedRequestUsd;

  const policyTag = getModelPolicyTag(requestedModel, config.policyEnvironment);
  if (policyTag === "block") {
    return {
      allowed: false,
      effectiveModel: requestedModel,
      budgetState: "limited",
      guardrailEvent: "block",
      warningMessage: "Modelo bloqueado por política de entorno.",
      sessionTotalUsd: roundUsd(currentSessionTotal),
      userTotalUsd: roundUsd(currentUserTotal),
    };
  }

  if (!config.enabled) {
    return {
      allowed: true,
      effectiveModel: requestedModel,
      budgetState: classifyBudgetState(projectedSessionTotal, config),
      guardrailEvent: policyTag === "warn" ? "warning" : "none",
      warningMessage: policyTag === "warn" ? "Modelo en modo advertencia por política de entorno." : null,
      sessionTotalUsd: roundUsd(currentSessionTotal),
      userTotalUsd: roundUsd(currentUserTotal),
    };
  }

  if (config.enforceHardLimit && projectedSessionTotal >= config.hardLimitUsd) {
    if (config.hardLimitAction === "block") {
      return {
        allowed: false,
        effectiveModel: requestedModel,
        budgetState: "limited",
        guardrailEvent: "block",
        warningMessage: "Límite duro de presupuesto alcanzado.",
        sessionTotalUsd: roundUsd(currentSessionTotal),
        userTotalUsd: roundUsd(currentUserTotal),
      };
    }

    const fallbackPolicy = getModelPolicyTag(config.fallbackModelKey, config.policyEnvironment);
    if (fallbackPolicy === "block") {
      return {
        allowed: false,
        effectiveModel: requestedModel,
        budgetState: "limited",
        guardrailEvent: "block",
        warningMessage: "Límite duro alcanzado y fallback inválido por política.",
        sessionTotalUsd: roundUsd(currentSessionTotal),
        userTotalUsd: roundUsd(currentUserTotal),
      };
    }

    return {
      allowed: true,
      effectiveModel: config.fallbackModelKey,
      budgetState: "limited",
      guardrailEvent: "fallback",
      warningMessage: "Límite duro alcanzado. Se aplicó modelo fallback.",
      fallbackFromModel: requestedModel,
      sessionTotalUsd: roundUsd(currentSessionTotal),
      userTotalUsd: roundUsd(currentUserTotal),
    };
  }

  if (config.enforceSoftLimit && projectedSessionTotal >= config.softLimitUsd) {
    return {
      allowed: true,
      effectiveModel: requestedModel,
      budgetState: "warning",
      guardrailEvent: "warning",
      warningMessage: "Presupuesto cercano al límite. Continuá con precaución.",
      sessionTotalUsd: roundUsd(currentSessionTotal),
      userTotalUsd: roundUsd(currentUserTotal),
    };
  }

  return {
    allowed: true,
    effectiveModel: requestedModel,
    budgetState: "ok",
    guardrailEvent: "none",
    warningMessage: policyTag === "warn" ? "Modelo con advertencia de costo/política." : null,
    sessionTotalUsd: roundUsd(currentSessionTotal),
    userTotalUsd: roundUsd(currentUserTotal),
  };
};

export const registerUsageCost = ({
  userId,
  sessionKey,
  model,
  usage,
}: {
  userId: string;
  sessionKey: string;
  model: string;
  usage: TokenUsage;
}): { sessionTotalUsd: number; userTotalUsd: number; requestCostUsd: number; budgetState: BudgetState } => {
  const pricing = getPricingForModel(model);
  const requestCostUsd =
    (usage.promptTokens / 1000) * pricing.input +
    (usage.completionTokens / 1000) * pricing.output;
  const roundedRequest = roundUsd(Math.max(0, requestCostUsd));

  const canonicalModel = resolveModelKey(model) ?? model;
  const sessionTotals = ensureUsageTotals(sessionBudgetStore, sessionKey);
  const userTotals = ensureUsageTotals(userBudgetStore, userId);

  sessionTotals.totalUsd = roundUsd(sessionTotals.totalUsd + roundedRequest);
  userTotals.totalUsd = roundUsd(userTotals.totalUsd + roundedRequest);

  sessionTotals.perModelUsd.set(
    canonicalModel,
    roundUsd((sessionTotals.perModelUsd.get(canonicalModel) ?? 0) + roundedRequest),
  );
  userTotals.perModelUsd.set(
    canonicalModel,
    roundUsd((userTotals.perModelUsd.get(canonicalModel) ?? 0) + roundedRequest),
  );

  const config = readCostGovernanceConfig();
  const budgetState = classifyBudgetState(sessionTotals.totalUsd, config);

  return {
    sessionTotalUsd: sessionTotals.totalUsd,
    userTotalUsd: userTotals.totalUsd,
    requestCostUsd: roundedRequest,
    budgetState,
  };
};

const toSnapshot = (totals: UsageTotals): CostSnapshot => {
  return {
    totalUsd: totals.totalUsd,
    perModel: Array.from(totals.perModelUsd.entries())
      .map(([model, totalUsd]) => ({ model, totalUsd }))
      .sort((a, b) => b.totalUsd - a.totalUsd),
  };
};

export const getSessionCostSnapshot = (sessionKey: string): CostSnapshot => {
  const totals = ensureUsageTotals(sessionBudgetStore, sessionKey);
  return toSnapshot(totals);
};

export const getUserCostSnapshot = (userId: string): CostSnapshot => {
  const totals = ensureUsageTotals(userBudgetStore, userId);
  return toSnapshot(totals);
};

export const resetCostGovernanceStores = (): void => {
  sessionBudgetStore.clear();
  userBudgetStore.clear();
};

export const classifyCostCategoryLabel = (costCategory: ModelCostCategory): "FREE" | "LOW" | "MED" | "HIGH" | "UNKNOWN" => {
  if (costCategory === "free") return "FREE";
  if (costCategory === "low") return "LOW";
  if (costCategory === "medium") return "MED";
  if (costCategory === "high") return "HIGH";
  return "UNKNOWN";
};
