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
import type * as attempts from "../attempts.js";
import type * as auth from "../auth.js";
import type * as boosts from "../boosts.js";
import type * as compare_candidates from "../compare/candidates.js";
import type * as compare_past from "../compare/past.js";
import type * as compare_team from "../compare/team.js";
import type * as compare_teammate from "../compare/teammate.js";
import type * as cosmetics from "../cosmetics.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as discoveries from "../discoveries.js";
import type * as engine from "../engine.js";
import type * as gains from "../gains.js";
import type * as game from "../game.js";
import type * as gardens from "../gardens.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as kudos from "../kudos.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_boosts from "../lib/boosts.js";
import type * as lib_buckets from "../lib/buckets.js";
import type * as lib_coins from "../lib/coins.js";
import type * as lib_compare from "../lib/compare.js";
import type * as lib_compareReads from "../lib/compareReads.js";
import type * as lib_cosmetics from "../lib/cosmetics.js";
import type * as lib_demoCalendar from "../lib/demoCalendar.js";
import type * as lib_demoGame from "../lib/demoGame.js";
import type * as lib_demoStore from "../lib/demoStore.js";
import type * as lib_gains from "../lib/gains.js";
import type * as lib_gameBlocks from "../lib/gameBlocks.js";
import type * as lib_garden from "../lib/garden.js";
import type * as lib_guidance from "../lib/guidance.js";
import type * as lib_items from "../lib/items.js";
import type * as lib_links from "../lib/links.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_parse from "../lib/parse.js";
import type * as lib_periods from "../lib/periods.js";
import type * as lib_questBlocks from "../lib/questBlocks.js";
import type * as lib_quests from "../lib/quests.js";
import type * as lib_random from "../lib/random.js";
import type * as lib_rebuild from "../lib/rebuild.js";
import type * as lib_rollups from "../lib/rollups.js";
import type * as lib_scaleSeed from "../lib/scaleSeed.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_skills from "../lib/skills.js";
import type * as lib_slack from "../lib/slack.js";
import type * as lib_sprees from "../lib/sprees.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_store from "../lib/store.js";
import type * as lib_success from "../lib/success.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_xp from "../lib/xp.js";
import type * as me from "../me.js";
import type * as quests from "../quests.js";
import type * as removal from "../removal.js";
import type * as rollups from "../rollups.js";
import type * as session from "../session.js";
import type * as skills from "../skills.js";
import type * as slack from "../slack.js";
import type * as slackData from "../slackData.js";
import type * as sprees from "../sprees.js";
import type * as store from "../store.js";
import type * as storeAdmin from "../storeAdmin.js";
import type * as superKudos from "../superKudos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  attempts: typeof attempts;
  auth: typeof auth;
  boosts: typeof boosts;
  "compare/candidates": typeof compare_candidates;
  "compare/past": typeof compare_past;
  "compare/team": typeof compare_team;
  "compare/teammate": typeof compare_teammate;
  cosmetics: typeof cosmetics;
  crons: typeof crons;
  demo: typeof demo;
  discoveries: typeof discoveries;
  engine: typeof engine;
  gains: typeof gains;
  game: typeof game;
  gardens: typeof gardens;
  http: typeof http;
  items: typeof items;
  kudos: typeof kudos;
  leaderboard: typeof leaderboard;
  "lib/access": typeof lib_access;
  "lib/boosts": typeof lib_boosts;
  "lib/buckets": typeof lib_buckets;
  "lib/coins": typeof lib_coins;
  "lib/compare": typeof lib_compare;
  "lib/compareReads": typeof lib_compareReads;
  "lib/cosmetics": typeof lib_cosmetics;
  "lib/demoCalendar": typeof lib_demoCalendar;
  "lib/demoGame": typeof lib_demoGame;
  "lib/demoStore": typeof lib_demoStore;
  "lib/gains": typeof lib_gains;
  "lib/gameBlocks": typeof lib_gameBlocks;
  "lib/garden": typeof lib_garden;
  "lib/guidance": typeof lib_guidance;
  "lib/items": typeof lib_items;
  "lib/links": typeof lib_links;
  "lib/messages": typeof lib_messages;
  "lib/parse": typeof lib_parse;
  "lib/periods": typeof lib_periods;
  "lib/questBlocks": typeof lib_questBlocks;
  "lib/quests": typeof lib_quests;
  "lib/random": typeof lib_random;
  "lib/rebuild": typeof lib_rebuild;
  "lib/rollups": typeof lib_rollups;
  "lib/scaleSeed": typeof lib_scaleSeed;
  "lib/settings": typeof lib_settings;
  "lib/skills": typeof lib_skills;
  "lib/slack": typeof lib_slack;
  "lib/sprees": typeof lib_sprees;
  "lib/stats": typeof lib_stats;
  "lib/store": typeof lib_store;
  "lib/success": typeof lib_success;
  "lib/time": typeof lib_time;
  "lib/xp": typeof lib_xp;
  me: typeof me;
  quests: typeof quests;
  removal: typeof removal;
  rollups: typeof rollups;
  session: typeof session;
  skills: typeof skills;
  slack: typeof slack;
  slackData: typeof slackData;
  sprees: typeof sprees;
  store: typeof store;
  storeAdmin: typeof storeAdmin;
  superKudos: typeof superKudos;
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
