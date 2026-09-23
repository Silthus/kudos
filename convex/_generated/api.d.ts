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
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as discoveries from "../discoveries.js";
import type * as engine from "../engine.js";
import type * as http from "../http.js";
import type * as kudos from "../kudos.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_buckets from "../lib/buckets.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_parse from "../lib/parse.js";
import type * as lib_rollups from "../lib/rollups.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_slack from "../lib/slack.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_store from "../lib/store.js";
import type * as lib_time from "../lib/time.js";
import type * as me from "../me.js";
import type * as session from "../session.js";
import type * as slack from "../slack.js";
import type * as slackData from "../slackData.js";
import type * as store from "../store.js";
import type * as storeAdmin from "../storeAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  auth: typeof auth;
  crons: typeof crons;
  demo: typeof demo;
  discoveries: typeof discoveries;
  engine: typeof engine;
  http: typeof http;
  kudos: typeof kudos;
  leaderboard: typeof leaderboard;
  "lib/access": typeof lib_access;
  "lib/buckets": typeof lib_buckets;
  "lib/messages": typeof lib_messages;
  "lib/parse": typeof lib_parse;
  "lib/rollups": typeof lib_rollups;
  "lib/settings": typeof lib_settings;
  "lib/slack": typeof lib_slack;
  "lib/stats": typeof lib_stats;
  "lib/store": typeof lib_store;
  "lib/time": typeof lib_time;
  me: typeof me;
  session: typeof session;
  slack: typeof slack;
  slackData: typeof slackData;
  store: typeof store;
  storeAdmin: typeof storeAdmin;
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

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
