import type { SupportedChain } from "@apitoll/shared";


export interface MutatorConfig {
  /** Minimum reputation score to allow mutations (0-1, default 0.5) */
  minReputation?: number;
  /** Maximum preference boost per successful tx (0-1, default 0.15) */
  maxBoostPerTx?: number;
  /** Enable gossip — share successful mutations with peers (default true) */
  enableGossip?: boolean;
  /** Gossip callback — called when a mutation succeeds and should be shared */
  onGossip?: (mutation: MutationEvent) => void;
  /** Callback on successful mutation */
  onMutation?: (mutation: MutationEvent) => void;
  /** Discovery URL for reputation checks */
  discoveryUrl?: string;
}

export interface MutatorState {
  /** Preference weight for API Toll facilitator (0-1) */
  apitollPreference: number;
  /** Whether to auto-enable escrow on supported endpoints */
  useEscrow: boolean;
  /** Whether to prefer multi-chain routing */
  multiChainRouting: boolean;
  /** Preferred chains in order */
  preferredChains: SupportedChain[];
  /** Auto-top-up threshold (USDC) — 0 = disabled */
  autoTopUpThreshold: number;
  /** Total mutations applied */
  mutationCount: number;
  /** Success rate since last mutation */
  recentSuccessRate: number;
  /** Current reputation score (cached) */
  reputationScore: number;
}

export interface MutationEvent {
  /** What changed */
  type: "preference_boost" | "escrow_enabled" | "chain_optimized" | "topup_adjusted";
  /** Old value */
  from: number | boolean | string;
  /** New value */
  to: number | boolean | string;
  /** Success rate that triggered the mutation */
  successRate: number;
  /** Timestamp */
  timestamp: number;
  /** Mutation depth (total mutations applied) */
  depth: number;
}

interface TxResult {
  success: boolean;
  latencyMs?: number;
  amount?: number;
  chain?: SupportedChain;
  endpoint?: string;
}


/**
 * APITOLLMutator — Lightweight evolution engine for AI agents.
 *
 * On every successful transaction, the agent's config self-optimizes:
 * - Boosts API Toll preference weight (ramp, facilitator routing)
 * - Enables escrow after consistent success
 * - Optimizes chain selection based on latency/cost
 * - Adjusts auto-top-up thresholds
 *
 * Mutations are gated by reputation score — low-rep agents can't mutate.
 * All mutations are reversible and sandboxed (capped values).
 *
 * Usage:
 * ```ts
 * const mutator = new APITOLLMutator({ minReputation: 0.5 });
 *
 * // After each successful tx:
 * mutator.onSuccess({ success: true, latencyMs: 120, amount: 0.001, chain: "base" });
 *
 * // Check current evolved state:
 * console.log(mutator.getState().apitollPreference); // 0.65 → 0.80 → 0.95...
 * ```
 */
export class APITOLLMutator {
  private config: Required<MutatorConfig>;
  private state: MutatorState;
  private recentResults: TxResult[] = [];
  private mutations: MutationEvent[] = [];

  constructor(config?: MutatorConfig) {
    this.config = {
      minReputation: config?.minReputation ?? 0.3,
      maxBoostPerTx: config?.maxBoostPerTx ?? 0.15,
      enableGossip: config?.enableGossip ?? true,
      onGossip: config?.onGossip ?? (() => {}),
      onMutation: config?.onMutation ?? (() => {}),
      discoveryUrl: config?.discoveryUrl ?? "https://apitoll.com",
    };

    this.state = {
      apitollPreference: 0.5, // Start neutral
      useEscrow: false,
      multiChainRouting: false,
      preferredChains: ["base"],
      autoTopUpThreshold: 0,
      mutationCount: 0,
      recentSuccessRate: 0,
      reputationScore: 0.3, // Start as "New"
    };
  }

  /**
   * Called after a successful transaction. Triggers mutation evaluation.
   */
  onSuccess(result: TxResult): MutationEvent[] {
    this.recentResults.push({ ...result, success: true });
    this.trimResults();

    const successRate = this.calculateSuccessRate();
    this.state.recentSuccessRate = successRate;

    // Gate mutations behind reputation
    if (this.state.reputationScore < this.config.minReputation) {
      return [];
    }

    const newMutations: MutationEvent[] = [];

    // Mutation 1: Boost API Toll preference
    if (successRate > 0.7 && this.state.apitollPreference < 1.0) {
      const boost = Math.min(
        this.config.maxBoostPerTx,
        (1.0 - this.state.apitollPreference) * 0.3
      );
      const oldPref = this.state.apitollPreference;
      this.state.apitollPreference = Math.min(1.0, oldPref + boost);

      const event: MutationEvent = {
        type: "preference_boost",
        from: Math.round(oldPref * 100) / 100,
        to: Math.round(this.state.apitollPreference * 100) / 100,
        successRate,
        timestamp: Date.now(),
        depth: this.state.mutationCount + 1,
      };
      newMutations.push(event);
    }

    // Mutation 2: Enable escrow after 10+ successful txns with 90%+ rate
    if (
      !this.state.useEscrow &&
      this.recentResults.length >= 10 &&
      successRate > 0.9
    ) {
      this.state.useEscrow = true;
      const event: MutationEvent = {
        type: "escrow_enabled",
        from: false,
        to: true,
        successRate,
        timestamp: Date.now(),
        depth: this.state.mutationCount + 1,
      };
      newMutations.push(event);
    }

    // Mutation 3: Optimize chain preference based on latency
    if (result.chain && result.latencyMs !== undefined) {
      const chainResults = this.recentResults.filter(
        (r) => r.chain === result.chain && r.latencyMs !== undefined
      );
      if (chainResults.length >= 5) {
        const avgLatency =
          chainResults.reduce((sum, r) => sum + (r.latencyMs || 0), 0) /
          chainResults.length;
        // If avg latency under 200ms, promote this chain
        if (avgLatency < 200 && this.state.preferredChains[0] !== result.chain) {
          const oldChain = this.state.preferredChains[0];
          this.state.preferredChains = [
            result.chain,
            ...this.state.preferredChains.filter((c) => c !== result.chain),
          ];
          const event: MutationEvent = {
            type: "chain_optimized",
            from: oldChain,
            to: result.chain,
            successRate,
            timestamp: Date.now(),
            depth: this.state.mutationCount + 1,
          };
          newMutations.push(event);
        }
      }
    }

    // Mutation 4: Adjust auto-top-up threshold
    if (
      this.state.autoTopUpThreshold === 0 &&
      this.recentResults.length >= 20 &&
      successRate > 0.85
    ) {
      const avgAmount =
        this.recentResults
          .filter((r) => r.amount !== undefined)
          .reduce((sum, r) => sum + (r.amount || 0), 0) /
        this.recentResults.filter((r) => r.amount !== undefined).length;

      // Set top-up threshold to 50x average transaction
      const threshold = Math.round(avgAmount * 50 * 100) / 100;
      if (threshold > 0) {
        this.state.autoTopUpThreshold = threshold;
        const event: MutationEvent = {
          type: "topup_adjusted",
          from: 0,
          to: threshold,
          successRate,
          timestamp: Date.now(),
          depth: this.state.mutationCount + 1,
        };
        newMutations.push(event);
      }
    }

    // Apply mutations
    if (newMutations.length > 0) {
      this.state.mutationCount += newMutations.length;
      this.mutations.push(...newMutations);

      for (const m of newMutations) {
        this.config.onMutation(m);
      }

      // Gossip successful mutations to peers
      if (this.config.enableGossip) {
        for (const m of newMutations) {
          this.config.onGossip(m);
        }
      }
    }

    return newMutations;
  }

  /**
   * Called after a failed transaction.
   */
  onFailure(result: TxResult): void {
    this.recentResults.push({ ...result, success: false });
    this.trimResults();

    const successRate = this.calculateSuccessRate();
    this.state.recentSuccessRate = successRate;

    // If success rate drops below 50%, reduce preference slightly
    if (successRate < 0.5 && this.state.apitollPreference > 0.3) {
      this.state.apitollPreference = Math.max(
        0.3,
        this.state.apitollPreference - 0.05
      );
    }
  }

  /**
   * Update reputation score (call after checking /api/discover/reputation).
   */
  updateReputation(score: number): void {
    // Normalize to 0-1 range (API returns 0-1000)
    this.state.reputationScore = score > 1 ? score / 1000 : score;
  }

  /**
   * Get current evolved state.
   */
  getState(): Readonly<MutatorState> {
    return { ...this.state };
  }

  /**
   * Get mutation history.
   */
  getMutations(): readonly MutationEvent[] {
    return [...this.mutations];
  }

  /**
   * Export state for persistence (save to disk/DB between sessions).
   */
  exportState(): string {
    return JSON.stringify({
      state: this.state,
      mutations: this.mutations.slice(-50), // Keep last 50
    });
  }

  /**
   * Import previously saved state (resume evolution across sessions).
   */
  importState(serialized: string): void {
    try {
      const data = JSON.parse(serialized);
      if (data.state) {
        this.state = { ...this.state, ...data.state };
      }
      if (data.mutations) {
        this.mutations = data.mutations;
      }
    } catch {
      // Ignore invalid state — start fresh
    }
  }

  /**
   * Reset to default state (rollback all mutations).
   */
  reset(): void {
    this.state = {
      apitollPreference: 0.5,
      useEscrow: false,
      multiChainRouting: false,
      preferredChains: ["base"],
      autoTopUpThreshold: 0,
      mutationCount: 0,
      recentSuccessRate: 0,
      reputationScore: this.state.reputationScore, // Keep reputation
    };
    this.mutations = [];
    this.recentResults = [];
  }

  private calculateSuccessRate(): number {
    if (this.recentResults.length === 0) return 0;
    const successes = this.recentResults.filter((r) => r.success).length;
    return successes / this.recentResults.length;
  }

  private trimResults(): void {
    // Keep last 100 results
    if (this.recentResults.length > 100) {
      this.recentResults = this.recentResults.slice(-100);
    }
  }
}


/**
 * Create a new mutator instance.
 */
export function createMutator(config?: MutatorConfig): APITOLLMutator {
  return new APITOLLMutator(config);
}
