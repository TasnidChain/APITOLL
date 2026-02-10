import { describe, it, expect, vi } from "vitest";
import { APITOLLMutator, createMutator } from "./mutator";

// Helper to generate N successful transactions
function feedSuccesses(
  mutator: APITOLLMutator,
  count: number,
  overrides: {
    latencyMs?: number;
    amount?: number;
    chain?: "base" | "solana";
  } = {}
) {
  const mutations = [];
  for (let i = 0; i < count; i++) {
    const result = mutator.onSuccess({
      success: true,
      latencyMs: overrides.latencyMs ?? 100,
      amount: overrides.amount ?? 0.005,
      chain: overrides.chain ?? "base",
    });
    mutations.push(...result);
  }
  return mutations;
}

describe("APITOLLMutator", () => {
  it("starts with default state", () => {
    const mutator = new APITOLLMutator();
    const state = mutator.getState();

    expect(state.apitollPreference).toBe(0.5);
    expect(state.useEscrow).toBe(false);
    expect(state.multiChainRouting).toBe(false);
    expect(state.preferredChains).toEqual(["base"]);
    expect(state.autoTopUpThreshold).toBe(0);
    expect(state.mutationCount).toBe(0);
    expect(state.recentSuccessRate).toBe(0);
    expect(state.reputationScore).toBe(0.3);
  });

  it("boosts preference after successful transactions", () => {
    const mutator = new APITOLLMutator();
    // Need reputation >= 0.3 (default) to mutate
    mutator.updateReputation(0.5);

    // Feed enough successes to get success rate > 0.7
    feedSuccesses(mutator, 5);

    const state = mutator.getState();
    expect(state.apitollPreference).toBeGreaterThan(0.5);
    expect(state.mutationCount).toBeGreaterThan(0);
  });

  it("does not mutate when reputation is too low", () => {
    const mutator = new APITOLLMutator({ minReputation: 0.8 });
    // reputation starts at 0.3 — below 0.8 threshold
    const mutations = feedSuccesses(mutator, 10);

    expect(mutations).toEqual([]);
    expect(mutator.getState().apitollPreference).toBe(0.5); // unchanged
  });

  it("enables escrow after 10+ transactions with 90%+ success", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    // Feed 12 successes to get past the 10 threshold with 100% success rate
    const mutations = feedSuccesses(mutator, 12);

    expect(mutator.getState().useEscrow).toBe(true);
    expect(mutations.some((m) => m.type === "escrow_enabled")).toBe(true);
  });

  it("does not enable escrow with mixed success rate", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    // 6 successes, 5 failures = ~55% rate
    for (let i = 0; i < 6; i++) {
      mutator.onSuccess({ success: true, latencyMs: 100, amount: 0.005, chain: "base" });
    }
    for (let i = 0; i < 5; i++) {
      mutator.onFailure({ success: false, chain: "base" });
    }

    expect(mutator.getState().useEscrow).toBe(false);
  });

  it("optimizes chain preference based on latency", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    // Feed 5+ fast Solana transactions (avg < 200ms)
    feedSuccesses(mutator, 6, { chain: "solana", latencyMs: 80 });

    const state = mutator.getState();
    expect(state.preferredChains[0]).toBe("solana");
  });

  it("does not optimize chain with too few results", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    // Only 3 Solana txns — below 5 threshold
    feedSuccesses(mutator, 3, { chain: "solana", latencyMs: 50 });

    const state = mutator.getState();
    expect(state.preferredChains[0]).toBe("base"); // unchanged
  });

  it("adjusts auto-top-up after 20+ txns with high success rate", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.9);

    feedSuccesses(mutator, 22, { amount: 0.01 });

    const state = mutator.getState();
    expect(state.autoTopUpThreshold).toBeGreaterThan(0);
  });

  it("reduces preference on failures", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    // Build up preference first
    feedSuccesses(mutator, 10);
    const boostedPref = mutator.getState().apitollPreference;

    // Now add many failures to drop success rate below 50%
    for (let i = 0; i < 30; i++) {
      mutator.onFailure({ success: false, chain: "base" });
    }

    expect(mutator.getState().apitollPreference).toBeLessThan(boostedPref);
  });

  it("caps preference at 1.0", () => {
    const mutator = new APITOLLMutator({ maxBoostPerTx: 0.5 });
    mutator.updateReputation(1.0);

    feedSuccesses(mutator, 50);

    expect(mutator.getState().apitollPreference).toBeLessThanOrEqual(1.0);
  });

  it("calls onMutation callback", () => {
    const onMutation = vi.fn();
    const mutator = new APITOLLMutator({ onMutation });
    mutator.updateReputation(0.8);

    feedSuccesses(mutator, 5);

    expect(onMutation).toHaveBeenCalled();
    expect(onMutation.mock.calls[0][0].type).toBe("preference_boost");
  });

  it("calls onGossip callback when enabled", () => {
    const onGossip = vi.fn();
    const mutator = new APITOLLMutator({ enableGossip: true, onGossip });
    mutator.updateReputation(0.8);

    feedSuccesses(mutator, 5);

    expect(onGossip).toHaveBeenCalled();
  });

  it("does not gossip when disabled", () => {
    const onGossip = vi.fn();
    const mutator = new APITOLLMutator({ enableGossip: false, onGossip });
    mutator.updateReputation(0.8);

    feedSuccesses(mutator, 5);

    expect(onGossip).not.toHaveBeenCalled();
  });

  it("exports and imports state", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);
    feedSuccesses(mutator, 10);

    const exported = mutator.exportState();
    expect(typeof exported).toBe("string");

    const newMutator = new APITOLLMutator();
    newMutator.importState(exported);

    expect(newMutator.getState().apitollPreference).toBe(
      mutator.getState().apitollPreference
    );
    expect(newMutator.getState().mutationCount).toBe(
      mutator.getState().mutationCount
    );
  });

  it("handles invalid import gracefully", () => {
    const mutator = new APITOLLMutator();
    mutator.importState("{ invalid json }");
    // Should not throw, state stays at defaults
    expect(mutator.getState().apitollPreference).toBe(0.5);
  });

  it("resets state but keeps reputation", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.9);
    feedSuccesses(mutator, 10);

    mutator.reset();
    const state = mutator.getState();

    expect(state.apitollPreference).toBe(0.5);
    expect(state.useEscrow).toBe(false);
    expect(state.mutationCount).toBe(0);
    expect(state.reputationScore).toBe(0.9); // kept
    expect(mutator.getMutations()).toEqual([]);
  });

  it("getMutations returns mutation history", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    feedSuccesses(mutator, 5);

    const mutations = mutator.getMutations();
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations[0]).toHaveProperty("type");
    expect(mutations[0]).toHaveProperty("timestamp");
    expect(mutations[0]).toHaveProperty("depth");
  });

  it("updateReputation normalizes scores > 1", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(750); // API returns 0-1000 scale
    expect(mutator.getState().reputationScore).toBe(0.75);
  });

  it("updateReputation keeps scores in 0-1 range", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.65);
    expect(mutator.getState().reputationScore).toBe(0.65);
  });

  it("trims results to prevent memory leak", () => {
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.5);

    // Feed 150 results — should be trimmed to 100
    feedSuccesses(mutator, 150);

    // We can't directly check recentResults length, but the state should be valid
    const state = mutator.getState();
    expect(state.recentSuccessRate).toBe(1); // all successes
  });
});

describe("createMutator factory", () => {
  it("creates a mutator instance", () => {
    const mutator = createMutator();
    expect(mutator).toBeInstanceOf(APITOLLMutator);
    expect(mutator.getState().apitollPreference).toBe(0.5);
  });

  it("passes config to constructor", () => {
    const mutator = createMutator({ minReputation: 0.9 });
    mutator.updateReputation(0.5); // below 0.9 threshold
    const mutations = feedSuccesses(mutator, 10);
    expect(mutations).toEqual([]); // should not mutate
  });
});
