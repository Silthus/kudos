import { ConvexError } from "convex/values";

/** What a failed mutation says to the person who tried: the server's own words, or `fallback`. */
export function errorText(e: unknown, fallback = "Something went wrong. Try again.") {
  return e instanceof ConvexError ? String(e.data) : fallback;
}
