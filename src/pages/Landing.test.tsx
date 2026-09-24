// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { describeElement, escapesFromScrollers, widensSideways } from "@/testing/layout";

vi.mock("convex/react", () => ({ useQuery: () => ({ demoEnabled: true }) }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }) }));

const { Landing } = await import("./Landing");
const { NotInstalled } = await import("./NotInstalled");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(page: ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter>{page}</MemoryRouter>));
  return host;
}

test("on a phone the landing page never scrolls sideways", () => {
  const host = render(<Landing />);
  expect(host.textContent).toContain("Every reply is a roll of the dice");
  expect(widensSideways(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
});

test("on a phone the not-installed page never scrolls sideways", () => {
  const host = render(<NotInstalled name="Maximiliane Featherstonehaugh" />);
  expect(host.textContent).toContain("Almost there, Maximiliane!");
  expect(widensSideways(host).map(describeElement)).toEqual([]);
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
});
