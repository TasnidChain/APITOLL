/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agents from "../agents.js";
import type * as alertEvaluator from "../alertEvaluator.js";
import type * as alertRules from "../alertRules.js";
import type * as analytics from "../analytics.js";
import type * as billing from "../billing.js";
import type * as categories from "../categories.js";
import type * as compliance from "../compliance.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deposits from "../deposits.js";
import type * as disputes from "../disputes.js";
import type * as escrow from "../escrow.js";
import type * as evolution from "../evolution.js";
import type * as facilitator from "../facilitator.js";
import type * as gossip from "../gossip.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as nodeActions from "../nodeActions.js";
import type * as organizations from "../organizations.js";
import type * as platformRevenue from "../platformRevenue.js";
import type * as policies from "../policies.js";
import type * as rateLimit from "../rateLimit.js";
import type * as referrals from "../referrals.js";
import type * as reputation from "../reputation.js";
import type * as sellerReputation from "../sellerReputation.js";
import type * as sellers from "../sellers.js";
import type * as toolFavorites from "../toolFavorites.js";
import type * as toolReviews from "../toolReviews.js";
import type * as tools from "../tools.js";
import type * as transactions from "../transactions.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agents: typeof agents;
  alertEvaluator: typeof alertEvaluator;
  alertRules: typeof alertRules;
  analytics: typeof analytics;
  billing: typeof billing;
  categories: typeof categories;
  compliance: typeof compliance;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deposits: typeof deposits;
  disputes: typeof disputes;
  escrow: typeof escrow;
  evolution: typeof evolution;
  facilitator: typeof facilitator;
  gossip: typeof gossip;
  helpers: typeof helpers;
  http: typeof http;
  nodeActions: typeof nodeActions;
  organizations: typeof organizations;
  platformRevenue: typeof platformRevenue;
  policies: typeof policies;
  rateLimit: typeof rateLimit;
  referrals: typeof referrals;
  reputation: typeof reputation;
  sellerReputation: typeof sellerReputation;
  sellers: typeof sellers;
  toolFavorites: typeof toolFavorites;
  toolReviews: typeof toolReviews;
  tools: typeof tools;
  transactions: typeof transactions;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
