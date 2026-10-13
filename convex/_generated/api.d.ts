/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics_boundary from "../analytics/boundary.js";
import type * as analytics_capture from "../analytics/capture.js";
import type * as analytics_drain from "../analytics/drain.js";
import type * as analytics_exceptions from "../analytics/exceptions.js";
import type * as analytics_outbox from "../analytics/outbox.js";
import type * as analytics_projections from "../analytics/projections.js";
import type * as analytics_subscribers from "../analytics/subscribers.js";
import type * as analytics_sweep from "../analytics/sweep.js";
import type * as bus_events from "../bus/events.js";
import type * as bus_publish from "../bus/publish.js";
import type * as crons from "../crons.js";
import type * as engine_allowance from "../engine/allowance.js";
import type * as engine_awards from "../engine/awards.js";
import type * as engine_engine from "../engine/engine.js";
import type * as engine_home from "../engine/home.js";
import type * as engine_messageEvent from "../engine/messageEvent.js";
import type * as engine_totals from "../engine/totals.js";
import type * as feedback_home from "../feedback/home.js";
import type * as feedback_indicator from "../feedback/indicator.js";
import type * as feedback_kudosCommand from "../feedback/kudosCommand.js";
import type * as feedback_naming from "../feedback/naming.js";
import type * as feedback_replies from "../feedback/replies.js";
import type * as feedback_welcome from "../feedback/welcome.js";
import type * as http from "../http.js";
import type * as parser_parser from "../parser/parser.js";
import type * as slack_appHome from "../slack/appHome.js";
import type * as slack_commands from "../slack/commands.js";
import type * as slack_delivery from "../slack/delivery.js";
import type * as slack_directory from "../slack/directory.js";
import type * as slack_events from "../slack/events.js";
import type * as slack_normalize from "../slack/normalize.js";
import type * as slack_placedReactions from "../slack/placedReactions.js";
import type * as slack_processEvent from "../slack/processEvent.js";
import type * as slack_rateLimits from "../slack/rateLimits.js";
import type * as slack_receipts from "../slack/receipts.js";
import type * as slack_signature from "../slack/signature.js";
import type * as slack_webApi from "../slack/webApi.js";
import type * as slack_welcome from "../slack/welcome.js";
import type * as welcome_welcome from "../welcome/welcome.js";
import type * as workspace_directory from "../workspace/directory.js";
import type * as workspace_settings from "../workspace/settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "analytics/boundary": typeof analytics_boundary;
  "analytics/capture": typeof analytics_capture;
  "analytics/drain": typeof analytics_drain;
  "analytics/exceptions": typeof analytics_exceptions;
  "analytics/outbox": typeof analytics_outbox;
  "analytics/projections": typeof analytics_projections;
  "analytics/subscribers": typeof analytics_subscribers;
  "analytics/sweep": typeof analytics_sweep;
  "bus/events": typeof bus_events;
  "bus/publish": typeof bus_publish;
  crons: typeof crons;
  "engine/allowance": typeof engine_allowance;
  "engine/awards": typeof engine_awards;
  "engine/engine": typeof engine_engine;
  "engine/home": typeof engine_home;
  "engine/messageEvent": typeof engine_messageEvent;
  "engine/totals": typeof engine_totals;
  "feedback/home": typeof feedback_home;
  "feedback/indicator": typeof feedback_indicator;
  "feedback/kudosCommand": typeof feedback_kudosCommand;
  "feedback/naming": typeof feedback_naming;
  "feedback/replies": typeof feedback_replies;
  "feedback/welcome": typeof feedback_welcome;
  http: typeof http;
  "parser/parser": typeof parser_parser;
  "slack/appHome": typeof slack_appHome;
  "slack/commands": typeof slack_commands;
  "slack/delivery": typeof slack_delivery;
  "slack/directory": typeof slack_directory;
  "slack/events": typeof slack_events;
  "slack/normalize": typeof slack_normalize;
  "slack/placedReactions": typeof slack_placedReactions;
  "slack/processEvent": typeof slack_processEvent;
  "slack/rateLimits": typeof slack_rateLimits;
  "slack/receipts": typeof slack_receipts;
  "slack/signature": typeof slack_signature;
  "slack/webApi": typeof slack_webApi;
  "slack/welcome": typeof slack_welcome;
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

export declare const components: {};
