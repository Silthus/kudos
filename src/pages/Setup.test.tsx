// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { describeElement, escapesFromScrollers, widensSideways } from "@/testing/layout";

const status = { siteUrl: "https://kudos.example.convex.site", slackClientId: true, slackClientSecret: false, slackSigningSecret: false, demoEnabled: true };
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => (getFunctionName(fn) === "session:setupStatus" ? status : undefined),
}));
const manifest = { display_information: { name: "Kudos" }, settings: { event_subscriptions: { request_url: `${status.siteUrl}/slack/events` } } };
vi.stubGlobal("fetch", () => Promise.resolve({ json: () => Promise.resolve(manifest) }));

const { Setup } = await import("./Setup");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

async function render() {
  const host = document.createElement("div");
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <MemoryRouter>
        <Setup />
      </MemoryRouter>,
    ),
  );
  return host;
}

test("on a phone the install commands scroll inside their card, and nothing on the page widens it", async () => {
  const host = await render();
  const commands = [...host.querySelectorAll("pre")].map((pre) => pre.textContent ?? "");
  expect(commands.some((text) => text.includes("SLACK_SIGNING_SECRET=<signing secret>")), "the env commands are shown").toBe(true);
  expect(commands.some((text) => text.includes("/slack/events")), "the loaded manifest is shown").toBe(true);
  expect(widensSideways(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
});
