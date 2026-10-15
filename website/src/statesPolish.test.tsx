import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aPage } from "./activityFixtures";
import type { ActivityRead } from "./activityRead";
import { shellFixtures, type MyActivity } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const member = shellFixtures.memberWithEveryPanelOpen;

beforeEach(() => {
  fakeSystemTheme(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-10-14T18:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function main() {
  return screen.getByRole("main");
}

function openActivity(path: string) {
  const asked: ((answer: MyActivity) => void)[] = [];
  const read: ActivityRead = () => new Promise((resolve) => asked.push(resolve));
  visit(path);
  renderApp(member, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { watch: (filter) => (filter === undefined ? undefined : aPage([], null)), read });
  return { answer: (answer: MyActivity) => act(async () => asked[0]!(answer)) };
}

describe("#481 3 V23: an empty timeline is Max's empty state, with one hedgehog, one sentence and one action to Slack", () => {
  it.each([
    { filter: "all", sentence: "Your activity shows here once you thank someone or reach a level." },
    { filter: "received", sentence: "Kudos you receive show here." },
    { filter: "given", sentence: "Kudos you give show here, with what each one earned." },
  ])("on $filter", async ({ filter, sentence }) => {
    const pages = openActivity(filter === "all" ? "/activity" : `/activity?filter=${filter}`);
    await pages.answer(aPage([], null));
    const empty = main().querySelector<HTMLElement>("[data-timeline-empty]")!;
    expect(empty).toHaveTextContent(sentence);
    const illustrations = [...empty.children].filter((child) => child.tagName.toLowerCase() === "svg");
    expect(illustrations).toHaveLength(1);
    expect(illustrations[0]).toHaveAttribute("aria-hidden", "true");
    expect(within(empty).queryByRole("img")).toBeNull();
    const action = within(empty).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" });
    expect(action).toHaveAttribute("href", member.chatUrl);
    expect(action).toHaveClass("quill-button--variant-outline");
    expect(main().querySelector(".quill-button--variant-primary")).toBeNull();
    expect(within(main()).getAllByRole("link", { name: /Thank someone in Slack/ })).toEqual([action]);
  });

  it("still takes focus as the landing place after Show new activity", async () => {
    const pages = openActivity("/activity");
    await pages.answer(aPage([], null));
    const empty = main().querySelector<HTMLElement>("[data-timeline-empty]")!;
    expect(empty).toHaveAttribute("tabindex", "-1");
  });
});

describe("#481 4: the story is centred on a wide screen", () => {
  it("centres the header and the timeline column, which keep their reading width", async () => {
    const pages = openActivity("/activity");
    await pages.answer(aPage([], null));
    const header = main().querySelector("header")!;
    expect(header).toHaveClass("mx-auto", "max-w-3xl");
    const column = main().querySelector("[data-timeline-empty]")!.parentElement!;
    expect(column).toHaveClass("mx-auto", "max-w-3xl");
  });
});

describe("#481 5: Max's pages share one shape for their one action", () => {
  it("styles the not-found page's way back as an outline button, like the error page's Try again", () => {
    visit("/profile");
    renderApp(member);
    const back = screen.getByRole("link", { name: "Back to your profile" });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toHaveClass("quill-button--variant-outline");
    expect(back).not.toHaveClass("underline");
  });
});
