import { createContext, useContext } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type ViewerResult = FunctionReturnType<typeof api.session.viewer>;
export type ReadyViewer = Extract<ViewerResult, { status: "ready" }>;

export const ViewerContext = createContext<ReadyViewer | null>(null);

export function useViewer(): ReadyViewer {
  const v = useContext(ViewerContext);
  if (!v) throw new Error("useViewer must be used inside a signed-in route");
  return v;
}

/** Where Slack webhooks and the static site live. Cloud deployments derive it from the Convex URL. */
export function siteUrl() {
  const convexUrl = (import.meta.env.VITE_CONVEX_URL as string).replace(/\/$/, "");
  if (convexUrl.endsWith(".convex.cloud")) return convexUrl.replace(/\.convex\.cloud$/, ".convex.site");
  return ((import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? convexUrl).replace(/\/$/, "");
}
