import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requireOrgAccess } from "./helpers";

// ═══════════════════════════════════════════════════
// Alert Evaluation Engine
// Runs on a cron to check all active alert rules
// ═══════════════════════════════════════════════════

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export const evaluateAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active alert rules
    const allRules = await ctx.db.query("alertRules").collect();
    const activeRules = allRules.filter((r) => r.isActive);

    const now = Date.now();

    for (const rule of activeRules.slice(0, 100)) {
      // Cooldown check — skip if fired recently
      if (rule.lastTriggered && (now - rule.lastTriggered) < COOLDOWN_MS) {
        continue;
      }

      const threshold = rule.thresholdJson;
      let triggered = false;
      let message = "";
      let currentValue = 0;
      let thresholdValue = 0;

      try {
        if (rule.ruleType === "budget_threshold" || rule.ruleType === "budget_exceeded") {
          // Get agents for this org
          const agents = rule.agentId
            ? [await ctx.db.get(rule.agentId)].filter(Boolean)
            : await ctx.db
                .query("agents")
                .withIndex("by_org", (q) => q.eq("orgId", rule.orgId))
                .collect();

          // Get budget policies for these agents
          const policies = await ctx.db
            .query("policies")
            .withIndex("by_org", (q) => q.eq("orgId", rule.orgId))
            .collect();
          const budgetPolicies = policies.filter(
            (p) => p.policyType === "budget" && p.isActive
          );

          for (const agent of agents) {
            if (!agent) continue;

            // Calculate today's spend
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const transactions = await ctx.db
              .query("transactions")
              .withIndex("by_agent_id", (q) => q.eq("agentId", agent._id))
              .collect();
            const todaySpend = transactions
              .filter((t) => t.requestedAt >= todayStart.getTime() && t.status === "settled")
              .reduce((sum, t) => sum + t.amount, 0);

            // Find applicable budget limit
            const agentPolicy = budgetPolicies.find(
              (p) => p.agentId === agent._id || !p.agentId
            );
            const dailyLimit = (agentPolicy?.rulesJson as { dailyLimit?: number })?.dailyLimit;

            if (!dailyLimit) continue;

            if (rule.ruleType === "budget_threshold") {
              const pct = threshold.percentage ?? 80;
              const triggerAt = dailyLimit * (pct / 100);
              if (todaySpend >= triggerAt) {
                triggered = true;
                currentValue = todaySpend;
                thresholdValue = triggerAt;
                message = `Agent "${agent.name}" has spent $${todaySpend.toFixed(4)} (${Math.round((todaySpend / dailyLimit) * 100)}% of $${dailyLimit} daily limit)`;
                break;
              }
            } else if (rule.ruleType === "budget_exceeded") {
              if (todaySpend > dailyLimit) {
                triggered = true;
                currentValue = todaySpend;
                thresholdValue = dailyLimit;
                message = `Agent "${agent.name}" EXCEEDED daily budget: $${todaySpend.toFixed(4)} > $${dailyLimit} limit`;
                break;
              }
            }
          }
        } else if (rule.ruleType === "low_balance") {
          const agents = rule.agentId
            ? [await ctx.db.get(rule.agentId)].filter(Boolean)
            : await ctx.db
                .query("agents")
                .withIndex("by_org", (q) => q.eq("orgId", rule.orgId))
                .collect();

          const balanceThreshold = threshold.amount ?? 1;

          for (const agent of agents) {
            if (!agent) continue;
            if (agent.balance < balanceThreshold) {
              triggered = true;
              currentValue = agent.balance;
              thresholdValue = balanceThreshold;
              message = `Agent "${agent.name}" balance low: $${agent.balance.toFixed(4)} < $${balanceThreshold} threshold`;
              break;
            }
          }
        } else if (rule.ruleType === "high_failure_rate") {
          const windowMs = (threshold.windowMinutes ?? 60) * 60 * 1000;
          const rateThreshold = threshold.rate ?? 20; // Default 20% failure rate

          const agents = rule.agentId
            ? [await ctx.db.get(rule.agentId)].filter(Boolean)
            : await ctx.db
                .query("agents")
                .withIndex("by_org", (q) => q.eq("orgId", rule.orgId))
                .collect();

          for (const agent of agents) {
            if (!agent) continue;
            const transactions = await ctx.db
              .query("transactions")
              .withIndex("by_agent_id", (q) => q.eq("agentId", agent._id))
              .collect();
            const recentTxs = transactions.filter(
              (t) => t.requestedAt >= (now - windowMs)
            );
            const settled = recentTxs.filter((t) => t.status === "settled").length;
            const failed = recentTxs.filter((t) => t.status === "failed").length;
            const total = settled + failed;

            if (total >= 5) {
              const failureRate = (failed / total) * 100;
              if (failureRate >= rateThreshold) {
                triggered = true;
                currentValue = failureRate;
                thresholdValue = rateThreshold;
                message = `Agent "${agent.name}" failure rate ${failureRate.toFixed(1)}% exceeds ${rateThreshold}% threshold (${failed}/${total} failed in last ${threshold.windowMinutes ?? 60}min)`;
                break;
              }
            }
          }
        } else if (rule.ruleType === "anomalous_spend") {
          const agents = rule.agentId
            ? [await ctx.db.get(rule.agentId)].filter(Boolean)
            : await ctx.db
                .query("agents")
                .withIndex("by_org", (q) => q.eq("orgId", rule.orgId))
                .collect();

          for (const agent of agents) {
            if (!agent) continue;
            const transactions = await ctx.db
              .query("transactions")
              .withIndex("by_agent_id", (q) => q.eq("agentId", agent._id))
              .collect();

            // Calculate today's spend
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todaySpend = transactions
              .filter((t) => t.requestedAt >= todayStart.getTime() && t.status === "settled")
              .reduce((sum, t) => sum + t.amount, 0);

            // Calculate 7-day average daily spend
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            const weekTxs = transactions.filter(
              (t) => t.requestedAt >= sevenDaysAgo && t.requestedAt < todayStart.getTime() && t.status === "settled"
            );
            const weekSpend = weekTxs.reduce((sum, t) => sum + t.amount, 0);
            const avgDailySpend = weekSpend / 7;

            if (avgDailySpend > 0 && todaySpend > avgDailySpend * 3) {
              triggered = true;
              currentValue = todaySpend;
              thresholdValue = avgDailySpend * 3;
              message = `Agent "${agent.name}" anomalous spend: $${todaySpend.toFixed(4)} today vs $${avgDailySpend.toFixed(4)} avg/day (${(todaySpend / avgDailySpend).toFixed(1)}x)`;
              break;
            }
          }
        }

        if (triggered) {
          // Insert alert event
          await ctx.db.insert("alertEvents", {
            alertRuleId: rule._id,
            orgId: rule.orgId,
            agentId: rule.agentId,
            ruleType: rule.ruleType,
            message,
            currentValue,
            thresholdValue,
            webhookDelivered: false,
            createdAt: now,
          });

          // Update lastTriggered on the rule
          await ctx.db.patch(rule._id, { lastTriggered: now });
        }
      } catch {
        // Skip failed evaluations — don't crash the cron
        continue;
      }
    }
  },
});

// ═══════════════════════════════════════════════════
// List Alert Events for an Org
// ═══════════════════════════════════════════════════

export const listAlertEvents = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("alertEvents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit);
  },
});
