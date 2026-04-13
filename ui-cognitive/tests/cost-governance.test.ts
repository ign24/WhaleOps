import { beforeEach, describe, expect, it } from "vitest";

import {
  estimateRequestCost,
  evaluateBudgetPreflight,
  readCostGovernanceConfig,
  resetCostGovernanceStores,
} from "@/lib/cost-governance";

describe("cost-governance", () => {
  beforeEach(() => {
    resetCostGovernanceStores();
  });

  it("estimates zero cost for free models", () => {
    const estimate = estimateRequestCost([{ role: "user", content: "hola" }], "nemotron_super");
    expect(estimate.amountUsd).toBe(0);
    expect(estimate.estimatedPromptTokens).toBeGreaterThan(0);
  });

  it("returns warning state when projected cost crosses soft limit", () => {
    const baseConfig = readCostGovernanceConfig();
    const result = evaluateBudgetPreflight({
      userId: "u-soft",
      sessionKey: "s-soft",
      requestedModel: "devstral",
      estimatedRequestUsd: 0.015,
      config: {
        ...baseConfig,
        softLimitUsd: 0.01,
        hardLimitUsd: 0.02,
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetState).toBe("warning");
    expect(result.guardrailEvent).toBe("warning");
  });

  it("returns fallback when hard limit is exceeded and action=fallback", () => {
    const baseConfig = readCostGovernanceConfig();
    const result = evaluateBudgetPreflight({
      userId: "u-hard",
      sessionKey: "s-hard",
      requestedModel: "devstral",
      estimatedRequestUsd: 10,
      config: {
        ...baseConfig,
        policyEnvironment: "development",
        softLimitUsd: 0.01,
        hardLimitUsd: 0.02,
        hardLimitAction: "fallback",
        fallbackModelKey: "nemotron_super",
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.guardrailEvent).toBe("fallback");
    expect(result.effectiveModel).toBe("nemotron_super");
    expect(result.fallbackFromModel).toBe("devstral");
  });
});
