/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bus_publish from "../bus/publish.js";
import type * as crons from "../crons.js";
import type * as engine_allowance from "../engine/allowance.js";
import type * as engine_awards from "../engine/awards.js";
import type * as engine_engine from "../engine/engine.js";
import type * as engine_messageEvent from "../engine/messageEvent.js";
import type * as feedback_indicator from "../feedback/indicator.js";
import type * as feedback_kudosCommand from "../feedback/kudosCommand.js";
import type * as feedback_replies from "../feedback/replies.js";
import type * as http from "../http.js";
import type * as parser_parser from "../parser/parser.js";
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
import type * as workspace_directory from "../workspace/directory.js";
import type * as workspace_settings from "../workspace/settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "bus/publish": typeof bus_publish;
  crons: typeof crons;
  "engine/allowance": typeof engine_allowance;
  "engine/awards": typeof engine_awards;
  "engine/engine": typeof engine_engine;
  "engine/messageEvent": typeof engine_messageEvent;
  "feedback/indicator": typeof feedback_indicator;
  "feedback/kudosCommand": typeof feedback_kudosCommand;
  "feedback/replies": typeof feedback_replies;
  http: typeof http;
  "parser/parser": typeof parser_parser;
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
