import { useQuery } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { useRef } from "react";

/**
 * Like `useQuery`, but keeps showing the previous result while new arguments load,
 * so switching a period filter doesn't flash the whole page back to a skeleton.
 * Skipped, it has nothing, and forgets what it had.
 */
export function useStableQuery<Q extends FunctionReference<"query">>(query: Q, args: FunctionArgs<Q> | "skip") {
  const result = useQuery(query, args) as FunctionReturnType<Q> | undefined;
  const last = useRef<FunctionReturnType<Q> | undefined>(undefined);
  if (result !== undefined || args === "skip") last.current = result;
  return { data: result ?? last.current, isStale: result === undefined && last.current !== undefined };
}
