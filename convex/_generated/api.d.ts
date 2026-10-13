/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as feedback_kudosCommand from "../feedback/kudosCommand.js";
import type * as http from "../http.js";
import type * as slack_commands from "../slack/commands.js";
import type * as slack_events from "../slack/events.js";
import type * as slack_processEvent from "../slack/processEvent.js";
import type * as slack_receipts from "../slack/receipts.js";
import type * as slack_signature from "../slack/signature.js";
import type * as slack_webApi from "../slack/webApi.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "feedback/kudosCommand": typeof feedback_kudosCommand;
  http: typeof http;
  "slack/commands": typeof slack_commands;
  "slack/events": typeof slack_events;
  "slack/processEvent": typeof slack_processEvent;
  "slack/receipts": typeof slack_receipts;
  "slack/signature": typeof slack_signature;
  "slack/webApi": typeof slack_webApi;
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
