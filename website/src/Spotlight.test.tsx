import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardRead } from "./boardRead";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures, type MySpotlight } from "./shell";
import { spotlightFixtures } from "./spotlightFixtures";
import type { SpotlightDraw } from "./spotlightRead";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const { pairing, onboarding, offsite } = spotlightFixtures;

beforeEach(() => {
  fakeSystemTheme(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T18:00:00"));
  window.history.replaceState(null, "", "/leaderboard");
});

afterEach(() => {
  vi.useRealTimers();
});

type Answer = MySpotlight | Error;

type Script = { seed: Answer; after?: Record<string, Answer> };

function drawing(script: Script) {
  return vi.fn<SpotlightDraw>(async (ask) => {
    const answer = "seed" in ask ? script.seed : script.after?.[ask.after];
    if (answer === undefined) throw new Error(`The script has no answer after ${JSON.stringify(ask)}.`);
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

function boardWith(draw: SpotlightDraw, readBoard: BoardRead = fixedLeaderboard(leaderboardFixtures.midBoard)) {
  return renderApp(shellFixtures.memberWithTheBoard, readBoard, undefined, undefined, undefined, undefined, undefined, undefined, undefined, draw);
}

function skipsFrom(after: string, count: number, then: Answer, prefix = "skip"): Record<string, Answer> {
  const chain: Record<string, Answer> = {};
  let from = after;
  for (let skip = 1; skip <= count; skip++) {
    const cursor = `${prefix}${skip}`;
    chain[from] = { kind: "skipped", after: cursor };
    from = cursor;
  }
  chain[from] = then;
  return chain;
}

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function nextButton() {
  return within(spotlight()).getByRole("button", { name: "Next" });
}

function messageArea() {
  const area = spotlight().querySelector("[data-testid='kudos-message-words']")?.closest("blockquote")?.parentElement;
  if (!area) throw new Error("The spotlight shows no message.");
  return area;
}

function distinctAfters(draw: ReturnType<typeof drawing>) {
  return [...new Set(afterAsks(draw).map(({ after }) => after))];
}

function notice() {
  return within(spotlight()).getByRole("status");
}

function afterAsks(draw: ReturnType<typeof drawing>) {
  return draw.mock.calls.map(([ask]) => ask).filter((ask): ask is { after: string } => "after" in ask);
}

function spotlight() {
  return screen.getByRole("region", { name: "A thank-you from your workspace" });
}

async function findSpotlight() {
  return screen.findByRole("region", { name: "A thank-you from your workspace" });
}

function querySpotlight() {
  return screen.queryByRole("region", { name: "A thank-you from your workspace" });
}

function sidePanelNames() {
  return within(screen.getByRole("main"))
    .getAllByRole("region")
    .map((region) => region.getAttribute("aria-labelledby"))
    .filter((id) => id !== "board-title" && id !== "everyone-board-title")
    .map((id) => document.getElementById(id ?? "")?.textContent?.trim());
}

describe("WS219 WS220: the board's mount draws one thank-you and shows it at the top of the side column", () => {
  it("reads getSpotlight with one seed and shows the giver, every recipient, the words and the date", async () => {
    const draw = drawing({ seed: pairing });
    boardWith(draw);
    const panel = await findSpotlight();
    expect(draw).toHaveBeenLastCalledWith({ seed: expect.any(Number) });
    expect(within(panel).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
    expect(within(panel).getByTestId("kudos-message-words")).toHaveTextContent("Thanks for pairing on the release checklist, it saved us a whole afternoon 🎉");
    expect(within(panel).getByText("12 Oct")).toHaveAttribute("datetime", new Date(pairing.at).toISOString());
  });

  it("sits above the board's other side panels", async () => {
    boardWith(drawing({ seed: pairing }));
    await findSpotlight();
    expect(sidePanelNames()).toEqual(["A thank-you from your workspace", "Only you see these", "How it counts"]);
  });

  it("shows the whole message with live links and Edited, and every recipient as supplied", async () => {
    boardWith(drawing({ seed: onboarding }));
    const panel = await findSpotlight();
    expect(within(panel).getByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(within(panel).getByRole("link", { name: "the doc (opens in a new tab)" })).toHaveAttribute("href", "https://example.com/onboarding");
    expect(within(panel).getByText("Edited")).toBeVisible();
  });

  it("names four people as two and 2 others, and dates a kudos from another year with its year", async () => {
    boardWith(drawing({ seed: offsite }));
    const panel = await findSpotlight();
    expect(within(panel).getByText("Eli Brandt thanked Ada Lindqvist, Bo Okafor and 2 others")).toBeVisible();
    expect(within(panel).getByText("3 Dec 2025")).toBeVisible();
  });

  it("opens the kudos in Slack in a new tab, naming whose kudos it is", async () => {
    boardWith(drawing({ seed: pairing }));
    const link = within(await findSpotlight()).getByRole("link", { name: "Open in Slack: the kudos from Ada Lindqvist (opens in a new tab)" });
    expect(link).toHaveAttribute("href", pairing.permalink);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows no Slack link while the permalink is null", async () => {
    boardWith(drawing({ seed: onboarding }));
    expect(within(await findSpotlight()).queryByRole("link", { name: /Open in Slack/ })).toBeNull();
  });

  it("shows no XP, rank, count or Said why", async () => {
    boardWith(drawing({ seed: pairing }));
    const text = (await findSpotlight()).textContent ?? "";
    expect(text).not.toMatch(/XP|#\d|kudos each|Said why/);
  });

  it("follows skipped answers at once with their own after, showing nothing in between", async () => {
    const draw = drawing({ seed: { kind: "skipped", after: "skip1" }, after: skipsFrom("skip1", 2, pairing, "more") });
    boardWith(draw);
    const panel = await findSpotlight();
    expect(within(panel).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
    expect(distinctAfters(draw)).toEqual(["skip1", "more1", "more2"]);
  });

  it("draws nothing again while the board changes period", async () => {
    const draw = drawing({ seed: pairing });
    const { user } = boardWith(draw);
    await findSpotlight();
    const draws = draw.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(draw).toHaveBeenCalledTimes(draws);
    expect(within(spotlight()).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
  });
});

describe("WS221: Next draws after the shown kudos, and the panel never changes by itself", () => {
  it("reads after the shown kudos and shows the next one", async () => {
    const draw = drawing({ seed: pairing, after: { [pairing.after]: onboarding } });
    const { user } = boardWith(draw);
    await findSpotlight();
    await user.click(nextButton());
    expect(await within(spotlight()).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(draw).toHaveBeenLastCalledWith({ after: pairing.after });
  });

  it("makes the message area a polite atomic live region only after the first press", async () => {
    const { user } = boardWith(drawing({ seed: pairing, after: { [pairing.after]: onboarding } }));
    await findSpotlight();
    expect(messageArea()).not.toHaveAttribute("aria-live");
    await user.click(nextButton());
    await within(spotlight()).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt");
    expect(messageArea()).toHaveAttribute("aria-live", "polite");
    expect(messageArea()).toHaveAttribute("aria-atomic", "true");
    expect(messageArea()).toHaveTextContent("Cleo Marchetti thanked Dev Rao and Eli Brandt");
  });

  it("holds the shown kudos and marks Next aria-disabled while the next answer loads", async () => {
    const pending = deferred<MySpotlight>();
    const draw = vi.fn<SpotlightDraw>(async (ask) => ("seed" in ask ? pairing : pending.promise));
    const { user } = boardWith(draw);
    await findSpotlight();
    await user.click(nextButton());
    expect(nextButton()).toHaveAttribute("aria-disabled", "true");
    expect(within(spotlight()).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
    await user.click(nextButton());
    expect(draw).toHaveBeenCalledTimes(draw.mock.calls.filter(([ask]) => "seed" in ask).length + 1);
    await act(async () => pending.resolve(onboarding));
    expect(nextButton()).not.toHaveAttribute("aria-disabled");
    expect(within(spotlight()).getByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
  });

  it("says That's the only one so far when the answer's after is the shown one", async () => {
    const { user } = boardWith(drawing({ seed: pairing, after: { [pairing.after]: pairing } }));
    await findSpotlight();
    await user.click(nextButton());
    await waitFor(() => expect(notice()).toHaveTextContent("That's the only one so far."));
    expect(messageArea()).not.toHaveTextContent("That's the only one so far.");
    expect(within(spotlight()).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
  });

  it("says a repeated outcome again on every press, as a new line in the status", async () => {
    const { user } = boardWith(drawing({ seed: pairing, after: { [pairing.after]: pairing } }));
    await findSpotlight();
    await user.click(nextButton());
    await waitFor(() => expect(notice()).toHaveTextContent("That's the only one so far."));
    const firstLine = notice().firstElementChild;
    await user.click(nextButton());
    await waitFor(() => expect(notice().firstElementChild).not.toBe(firstLine));
    expect(notice()).toHaveTextContent("That's the only one so far.");
  });

  it("follows skipped answers after Next, then shows the kudos past them", async () => {
    const draw = drawing({ seed: pairing, after: skipsFrom(pairing.after, 3, onboarding) });
    const { user } = boardWith(draw);
    await findSpotlight();
    draw.mockClear();
    await user.click(nextButton());
    expect(await within(spotlight()).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(afterAsks(draw)).toEqual([{ after: pairing.after }, { after: "skip1" }, { after: "skip2" }, { after: "skip3" }]);
  });

  it("stops after ten skipped answers, keeps the kudos, and resumes from the last skip on the next press", async () => {
    const draw = drawing({ seed: pairing, after: skipsFrom(pairing.after, 12, onboarding) });
    const { user } = boardWith(draw);
    await findSpotlight();
    draw.mockClear();
    await user.click(nextButton());
    await waitFor(() => expect(notice()).toHaveTextContent("Couldn't find another thank-you. Try again."));
    expect(messageArea()).not.toHaveTextContent("Couldn't find another thank-you.");
    expect(within(spotlight()).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
    expect(draw).toHaveBeenCalledTimes(10);
    draw.mockClear();
    await user.click(nextButton());
    expect(await within(spotlight()).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(afterAsks(draw)).toEqual([{ after: "skip10" }, { after: "skip11" }, { after: "skip12" }]);
    expect(notice()).toHaveTextContent("");
  });

  it("keeps the kudos after a failed draw, says so, and reads after the shown kudos again on the next press", async () => {
    let failing = true;
    const draw = vi.fn<SpotlightDraw>(async (ask) => {
      if ("seed" in ask) return pairing;
      if (failing) throw new Error("socket closed");
      return onboarding;
    });
    const { user } = boardWith(draw);
    await findSpotlight();
    await user.click(nextButton());
    await waitFor(() => expect(notice()).toHaveTextContent("Couldn't find another thank-you. Try again."));
    expect(within(spotlight()).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
    failing = false;
    await user.click(nextButton());
    expect(await within(spotlight()).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(draw).toHaveBeenLastCalledWith({ after: pairing.after });
  });

  it("never re-renders the panel with another kudos without a press", async () => {
    const draw = drawing({ seed: pairing, after: { [pairing.after]: onboarding } });
    const { rerender } = boardWith(draw);
    await findSpotlight();
    const draws = draw.mock.calls.length;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(draw).toHaveBeenCalledTimes(draws);
    expect(rerender).toBeDefined();
    expect(within(spotlight()).getByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
  });
});

describe("WS219: a draw that fails on the board's mount", () => {
  it("shows Max's line and a Try again that draws a fresh seed after an error", async () => {
    let failing = true;
    const draw = vi.fn<SpotlightDraw>(async () => {
      if (failing) throw new Error("socket closed");
      return pairing;
    });
    const { user } = boardWith(draw);
    const panel = await findSpotlight();
    expect(within(panel).getByText("Couldn't find a thank-you just now.")).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Next" })).toBeNull();
    failing = false;
    draw.mockClear();
    await user.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(await within(spotlight()).findByText("Ada Lindqvist thanked Bo Okafor")).toBeVisible();
    expect(draw).toHaveBeenCalledExactlyOnceWith({ seed: expect.any(Number) });
  });

  it("stops after ten skipped answers, and Try again resumes from the last skip", async () => {
    const draw = drawing({ seed: { kind: "skipped", after: "skip1" }, after: skipsFrom("skip1", 11, offsite, "more") });
    const { user } = boardWith(draw);
    const panel = await findSpotlight();
    expect(within(panel).getByText("Couldn't find a thank-you just now.")).toBeVisible();
    draw.mockClear();
    await user.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(await within(spotlight()).findByText("Eli Brandt thanked Ada Lindqvist, Bo Okafor and 2 others")).toBeVisible();
    expect(draw.mock.calls.map(([ask]) => ask)).toEqual([{ after: "more9" }, { after: "more10" }, { after: "more11" }]);
  });
});

describe("WS219: an attempt whose mount ended stops reading", () => {
  it("follows no skipped answer that arrives after the board unmounts", async () => {
    const late = deferred<MySpotlight>();
    const draw = vi.fn<SpotlightDraw>(async (ask) => ("seed" in ask ? late.promise : { kind: "skipped", after: `${ask.after}+` }));
    const { user } = boardWith(draw);
    await user.click(within(screen.getByRole("navigation", { name: "Screens" })).getByRole("link", { name: "Profile" }));
    await act(async () => late.resolve({ kind: "skipped", after: "skip1" }));
    expect(afterAsks(draw)).toEqual([]);
  });
});

describe("WS222 WS201: the empty spotlight, and none while the read answers not-found", () => {
  it("shows Max's line and no Next while the draw answers empty", async () => {
    boardWith(drawing({ seed: { kind: "empty" } }));
    const panel = await findSpotlight();
    expect(within(panel).getByText("Thank-yous from public channels show here.")).toBeVisible();
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  it("shows no panel and leaves no gap while the draw answers not-found", async () => {
    const draw = drawing({ seed: { kind: "not-found" } });
    boardWith(draw);
    await waitFor(() => expect(draw).toHaveBeenCalled());
    await act(async () => undefined);
    expect(querySpotlight()).toBeNull();
    expect(sidePanelNames()).toEqual(["Only you see these", "How it counts"]);
  });

  it.each<{ state: string; visitor: typeof shellFixtures.memberWithTheBoard; board: BoardRead }>([
    { state: "locked", visitor: shellFixtures.memberWaitingForTheBoard, board: (period) => period && { kind: "locked", level: 2 } },
    { state: "ready", visitor: shellFixtures.memberWithTheBoardReady, board: (period) => period && { kind: "ready" } },
    { state: "not-found", visitor: shellFixtures.member, board: (period) => period && { kind: "not-found" } },
  ])("never draws on the $state leaderboard page", async ({ visitor, board }) => {
    const draw = drawing({ seed: pairing });
    renderApp(visitor, board, undefined, undefined, undefined, undefined, undefined, undefined, undefined, draw);
    await act(async () => undefined);
    expect(draw).not.toHaveBeenCalled();
    expect(querySpotlight()).toBeNull();
  });

  it("drops a draw answered after its mount ended, keeping the current mount's thank-you", async () => {
    const late = deferred<MySpotlight>();
    const seedAnswers: Promise<MySpotlight>[] = [late.promise];
    const draw = vi.fn<SpotlightDraw>(async () => seedAnswers.shift() ?? onboarding);
    boardWith(draw);
    expect(await within(await findSpotlight()).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(draw).toHaveBeenCalledTimes(2);
    await act(async () => late.resolve(pairing));
    expect(within(spotlight()).getByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeVisible();
    expect(within(spotlight()).queryByText("Ada Lindqvist thanked Bo Okafor")).toBeNull();
  });
});
