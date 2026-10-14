import type { FunctionArgs } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { MyRecentKudos } from "./shell";

export type Direction = FunctionArgs<typeof api.website.activity.getRecentKudos>["direction"];

export type RecentKudosRead = (direction: Direction) => MyRecentKudos | undefined;
