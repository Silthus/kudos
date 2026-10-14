/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements_achievements from "../achievements/achievements.js";
import type * as achievements_achievementsFlag from "../achievements/achievementsFlag.js";
import type * as achievements_counting from "../achievements/counting.js";
import type * as achievements_flag from "../achievements/flag.js";
import type * as achievements_ladders from "../achievements/ladders.js";
import type * as achievements_measures from "../achievements/measures.js";
import type * as achievements_oldFriends from "../achievements/oldFriends.js";
import type * as achievements_replay from "../achievements/replay.js";
import type * as achievements_tiers from "../achievements/tiers.js";
import type * as analytics_boundary from "../analytics/boundary.js";
import type * as analytics_capture from "../analytics/capture.js";
import type * as analytics_drain from "../analytics/drain.js";
import type * as analytics_exceptions from "../analytics/exceptions.js";
import type * as analytics_failures from "../analytics/failures.js";
import type * as analytics_flags from "../analytics/flags.js";
import type * as analytics_isolatedUsage from "../analytics/isolatedUsage.js";
import type * as analytics_outbox from "../analytics/outbox.js";
import type * as analytics_projections from "../analytics/projections.js";
import type * as analytics_subscribers from "../analytics/subscribers.js";
import type * as analytics_sweep from "../analytics/sweep.js";
import type * as analytics_usage from "../analytics/usage.js";
import type * as auth from "../auth.js";
import type * as bus_events from "../bus/events.js";
import type * as bus_publish from "../bus/publish.js";
import type * as commands_commands from "../commands/commands.js";
import type * as companyProfiles_faces from "../companyProfiles/faces.js";
import type * as companyProfiles_sync from "../companyProfiles/sync.js";
import type * as crons from "../crons.js";
import type * as engine_allowance from "../engine/allowance.js";
import type * as engine_awards from "../engine/awards.js";
import type * as engine_engine from "../engine/engine.js";
import type * as engine_home from "../engine/home.js";
import type * as engine_messageEvent from "../engine/messageEvent.js";
import type * as engine_totals from "../engine/totals.js";
import type * as feedback_deepLinks from "../feedback/deepLinks.js";
import type * as feedback_home from "../feedback/home.js";
import type * as feedback_homes from "../feedback/homes.js";
import type * as feedback_indicator from "../feedback/indicator.js";
import type * as feedback_kudosCommand from "../feedback/kudosCommand.js";
import type * as feedback_leaderboard from "../feedback/leaderboard.js";
import type * as feedback_naming from "../feedback/naming.js";
import type * as feedback_notify from "../feedback/notify.js";
import type * as feedback_publicReplies from "../feedback/publicReplies.js";
import type * as feedback_replies from "../feedback/replies.js";
import type * as feedback_segments from "../feedback/segments.js";
import type * as feedback_tierNotices from "../feedback/tierNotices.js";
import type * as feedback_unlockFilter from "../feedback/unlockFilter.js";
import type * as feedback_welcome from "../feedback/welcome.js";
import type * as http from "../http.js";
import type * as leaderboard_backfill from "../leaderboard/backfill.js";
import type * as leaderboard_board from "../leaderboard/board.js";
import type * as leaderboard_flag from "../leaderboard/flag.js";
import type * as leaderboard_improvement from "../leaderboard/improvement.js";
import type * as leaderboard_improvementLine from "../leaderboard/improvementLine.js";
import type * as leaderboard_periods from "../leaderboard/periods.js";
import type * as leaderboard_totals from "../leaderboard/totals.js";
import type * as leaderboard_visibility from "../leaderboard/visibility.js";
import type * as parser_parser from "../parser/parser.js";
import type * as progression_backfill from "../progression/backfill.js";
import type * as progression_catalogue from "../progression/catalogue.js";
import type * as progression_effects from "../progression/effects.js";
import type * as progression_gate from "../progression/gate.js";
import type * as progression_levels from "../progression/levels.js";
import type * as progression_perks from "../progression/perks.js";
import type * as progression_progress from "../progression/progress.js";
import type * as progression_progression from "../progression/progression.js";
import type * as progression_purchases from "../progression/purchases.js";
import type * as progression_rewards from "../progression/rewards.js";
import type * as progression_settings from "../progression/settings.js";
import type * as progression_skillTree from "../progression/skillTree.js";
import type * as progression_skillTreeFlag from "../progression/skillTreeFlag.js";
import type * as progression_tree from "../progression/tree.js";
import type * as progression_xpLevels from "../progression/xpLevels.js";
import type * as quests_crates from "../quests/crates.js";
import type * as quests_finish from "../quests/finish.js";
import type * as quests_flag from "../quests/flag.js";
import type * as quests_join from "../quests/join.js";
import type * as quests_journey from "../quests/journey.js";
import type * as quests_journeyCopy from "../quests/journeyCopy.js";
import type * as quests_newWeek from "../quests/newWeek.js";
import type * as quests_open from "../quests/open.js";
import type * as quests_pool from "../quests/pool.js";
import type * as quests_progress from "../quests/progress.js";
import type * as quests_quests from "../quests/quests.js";
import type * as quests_questsFlag from "../quests/questsFlag.js";
import type * as quests_step from "../quests/step.js";
import type * as quests_week from "../quests/week.js";
import type * as quests_weekly from "../quests/weekly.js";
import type * as slack_appHome from "../slack/appHome.js";
import type * as slack_blocks from "../slack/blocks.js";
import type * as slack_commands from "../slack/commands.js";
import type * as slack_delivery from "../slack/delivery.js";
import type * as slack_directMessages from "../slack/directMessages.js";
import type * as slack_directory from "../slack/directory.js";
import type * as slack_events from "../slack/events.js";
import type * as slack_interactivity from "../slack/interactivity.js";
import type * as slack_normalize from "../slack/normalize.js";
import type * as slack_placedReactions from "../slack/placedReactions.js";
import type * as slack_processEvent from "../slack/processEvent.js";
import type * as slack_publicReplies from "../slack/publicReplies.js";
import type * as slack_rateLimits from "../slack/rateLimits.js";
import type * as slack_receipts from "../slack/receipts.js";
import type * as slack_signIn from "../slack/signIn.js";
import type * as slack_signature from "../slack/signature.js";
import type * as slack_verifyMember from "../slack/verifyMember.js";
import type * as slack_webApi from "../slack/webApi.js";
import type * as slack_welcome from "../slack/welcome.js";
import type * as slack_workspaceLink from "../slack/workspaceLink.js";
import type * as unlocks_feature from "../unlocks/feature.js";
import type * as unlocks_launch from "../unlocks/launch.js";
import type * as unlocks_schedule from "../unlocks/schedule.js";
import type * as unlocks_sweep from "../unlocks/sweep.js";
import type * as unlocks_unlocks from "../unlocks/unlocks.js";
import type * as website_abandonedHandshakes from "../website/abandonedHandshakes.js";
import type * as website_book from "../website/book.js";
import type * as website_clock from "../website/clock.js";
import type * as website_commands from "../website/commands.js";
import type * as website_faces from "../website/faces.js";
import type * as website_flag from "../website/flag.js";
import type * as website_hosting from "../website/hosting.js";
import type * as website_leaderboard from "../website/leaderboard.js";
import type * as website_link from "../website/link.js";
import type * as website_memberMutation from "../website/memberMutation.js";
import type * as website_memberQuery from "../website/memberQuery.js";
import type * as website_profile from "../website/profile.js";
import type * as website_quests from "../website/quests.js";
import type * as website_routes from "../website/routes.js";
import type * as website_seen from "../website/seen.js";
import type * as website_signIn from "../website/signIn.js";
import type * as website_skillTree from "../website/skillTree.js";
import type * as website_unlockPath from "../website/unlockPath.js";
import type * as welcome_welcome from "../welcome/welcome.js";
import type * as workspace_directory from "../workspace/directory.js";
import type * as workspace_settings from "../workspace/settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "achievements/achievements": typeof achievements_achievements;
  "achievements/achievementsFlag": typeof achievements_achievementsFlag;
  "achievements/counting": typeof achievements_counting;
  "achievements/flag": typeof achievements_flag;
  "achievements/ladders": typeof achievements_ladders;
  "achievements/measures": typeof achievements_measures;
  "achievements/oldFriends": typeof achievements_oldFriends;
  "achievements/replay": typeof achievements_replay;
  "achievements/tiers": typeof achievements_tiers;
  "analytics/boundary": typeof analytics_boundary;
  "analytics/capture": typeof analytics_capture;
  "analytics/drain": typeof analytics_drain;
  "analytics/exceptions": typeof analytics_exceptions;
  "analytics/failures": typeof analytics_failures;
  "analytics/flags": typeof analytics_flags;
  "analytics/isolatedUsage": typeof analytics_isolatedUsage;
  "analytics/outbox": typeof analytics_outbox;
  "analytics/projections": typeof analytics_projections;
  "analytics/subscribers": typeof analytics_subscribers;
  "analytics/sweep": typeof analytics_sweep;
  "analytics/usage": typeof analytics_usage;
  auth: typeof auth;
  "bus/events": typeof bus_events;
  "bus/publish": typeof bus_publish;
  "commands/commands": typeof commands_commands;
  "companyProfiles/faces": typeof companyProfiles_faces;
  "companyProfiles/sync": typeof companyProfiles_sync;
  crons: typeof crons;
  "engine/allowance": typeof engine_allowance;
  "engine/awards": typeof engine_awards;
  "engine/engine": typeof engine_engine;
  "engine/home": typeof engine_home;
  "engine/messageEvent": typeof engine_messageEvent;
  "engine/totals": typeof engine_totals;
  "feedback/deepLinks": typeof feedback_deepLinks;
  "feedback/home": typeof feedback_home;
  "feedback/homes": typeof feedback_homes;
  "feedback/indicator": typeof feedback_indicator;
  "feedback/kudosCommand": typeof feedback_kudosCommand;
  "feedback/leaderboard": typeof feedback_leaderboard;
  "feedback/naming": typeof feedback_naming;
  "feedback/notify": typeof feedback_notify;
  "feedback/publicReplies": typeof feedback_publicReplies;
  "feedback/replies": typeof feedback_replies;
  "feedback/segments": typeof feedback_segments;
  "feedback/tierNotices": typeof feedback_tierNotices;
  "feedback/unlockFilter": typeof feedback_unlockFilter;
  "feedback/welcome": typeof feedback_welcome;
  http: typeof http;
  "leaderboard/backfill": typeof leaderboard_backfill;
  "leaderboard/board": typeof leaderboard_board;
  "leaderboard/flag": typeof leaderboard_flag;
  "leaderboard/improvement": typeof leaderboard_improvement;
  "leaderboard/improvementLine": typeof leaderboard_improvementLine;
  "leaderboard/periods": typeof leaderboard_periods;
  "leaderboard/totals": typeof leaderboard_totals;
  "leaderboard/visibility": typeof leaderboard_visibility;
  "parser/parser": typeof parser_parser;
  "progression/backfill": typeof progression_backfill;
  "progression/catalogue": typeof progression_catalogue;
  "progression/effects": typeof progression_effects;
  "progression/gate": typeof progression_gate;
  "progression/levels": typeof progression_levels;
  "progression/perks": typeof progression_perks;
  "progression/progress": typeof progression_progress;
  "progression/progression": typeof progression_progression;
  "progression/purchases": typeof progression_purchases;
  "progression/rewards": typeof progression_rewards;
  "progression/settings": typeof progression_settings;
  "progression/skillTree": typeof progression_skillTree;
  "progression/skillTreeFlag": typeof progression_skillTreeFlag;
  "progression/tree": typeof progression_tree;
  "progression/xpLevels": typeof progression_xpLevels;
  "quests/crates": typeof quests_crates;
  "quests/finish": typeof quests_finish;
  "quests/flag": typeof quests_flag;
  "quests/join": typeof quests_join;
  "quests/journey": typeof quests_journey;
  "quests/journeyCopy": typeof quests_journeyCopy;
  "quests/newWeek": typeof quests_newWeek;
  "quests/open": typeof quests_open;
  "quests/pool": typeof quests_pool;
  "quests/progress": typeof quests_progress;
  "quests/quests": typeof quests_quests;
  "quests/questsFlag": typeof quests_questsFlag;
  "quests/step": typeof quests_step;
  "quests/week": typeof quests_week;
  "quests/weekly": typeof quests_weekly;
  "slack/appHome": typeof slack_appHome;
  "slack/blocks": typeof slack_blocks;
  "slack/commands": typeof slack_commands;
  "slack/delivery": typeof slack_delivery;
  "slack/directMessages": typeof slack_directMessages;
  "slack/directory": typeof slack_directory;
  "slack/events": typeof slack_events;
  "slack/interactivity": typeof slack_interactivity;
  "slack/normalize": typeof slack_normalize;
  "slack/placedReactions": typeof slack_placedReactions;
  "slack/processEvent": typeof slack_processEvent;
  "slack/publicReplies": typeof slack_publicReplies;
  "slack/rateLimits": typeof slack_rateLimits;
  "slack/receipts": typeof slack_receipts;
  "slack/signIn": typeof slack_signIn;
  "slack/signature": typeof slack_signature;
  "slack/verifyMember": typeof slack_verifyMember;
  "slack/webApi": typeof slack_webApi;
  "slack/welcome": typeof slack_welcome;
  "slack/workspaceLink": typeof slack_workspaceLink;
  "unlocks/feature": typeof unlocks_feature;
  "unlocks/launch": typeof unlocks_launch;
  "unlocks/schedule": typeof unlocks_schedule;
  "unlocks/sweep": typeof unlocks_sweep;
  "unlocks/unlocks": typeof unlocks_unlocks;
  "website/abandonedHandshakes": typeof website_abandonedHandshakes;
  "website/book": typeof website_book;
  "website/clock": typeof website_clock;
  "website/commands": typeof website_commands;
  "website/faces": typeof website_faces;
  "website/flag": typeof website_flag;
  "website/hosting": typeof website_hosting;
  "website/leaderboard": typeof website_leaderboard;
  "website/link": typeof website_link;
  "website/memberMutation": typeof website_memberMutation;
  "website/memberQuery": typeof website_memberQuery;
  "website/profile": typeof website_profile;
  "website/quests": typeof website_quests;
  "website/routes": typeof website_routes;
  "website/seen": typeof website_seen;
  "website/signIn": typeof website_signIn;
  "website/skillTree": typeof website_skillTree;
  "website/unlockPath": typeof website_unlockPath;
  "welcome/welcome": typeof welcome_welcome;
  "workspace/directory": typeof workspace_directory;
  "workspace/settings": typeof workspace_settings;
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
  posthog: import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
