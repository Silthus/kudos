import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { WORKSPACE_PARAM } from "../../convex/lib/links";
import type { ReadyViewer } from "./viewer";

/**
 * Follows a link from Slack that names its workspace (`?ws=<team id>`, `convex/lib/links.ts`):
 * switches to that workspace when it's one of the viewer's own (like the switcher does), then
 * drops the parameter, keeping the rest of the URL. A workspace the viewer isn't in, or a switch
 * that fails, just leaves them where they are: the link still opens its page, and nothing tells
 * them whether that workspace exists.
 *
 * True until the URL is settled, so the pages only render in the workspace the link is for: the
 * one used last may not even have the page (e.g. its store is closed) and would redirect away.
 */
export function useLinkedWorkspace(viewer: ReadyViewer | null): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const switchWorkspace = useMutation(api.session.switchWorkspace);
  // The switch asked for, and whether it has finished (either way).
  const [done, setDone] = useState<Id<"members"> | null>(null);
  const asked = useRef<Id<"members"> | null>(null);

  const team = new URLSearchParams(location.search).get(WORKSPACE_PARAM);
  const target = viewer && team !== null ? viewer.workspaces.find((w) => w.slackTeamId === team) : undefined;
  // A finished switch settles the link even if the viewer doesn't show it (another tab switched
  // back in between): Convex has updated the queries by the time the mutation resolves.
  const switchTo = target && !target.current && done !== target.memberId ? target.memberId : null;
  const settled = viewer !== null && team !== null && switchTo === null;

  useEffect(() => {
    if (switchTo === null || asked.current === switchTo) return;
    asked.current = switchTo;
    const finish = () => setDone(switchTo);
    switchWorkspace({ memberId: switchTo }).then(finish, finish);
  }, [switchTo, switchWorkspace]);

  useEffect(() => {
    if (!settled) return;
    const params = new URLSearchParams(location.search);
    params.delete(WORKSPACE_PARAM);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true });
  }, [settled, location, navigate]);

  return viewer !== null && team !== null;
}
