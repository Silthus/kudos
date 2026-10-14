import { describe, expect, it } from "vitest";
import { aGiven, aLevelUp, aReceived, aPage, anUnknownKind } from "../activityFixtures";
import { entryIdOf, firstPage, hasNewActivity, timeline, type TimelineEvent, type TimelineState } from "./timeline";

function after(...events: TimelineEvent[]): TimelineState {
  return events.reduce(timeline, firstPage("all"));
}

const newest = aReceived("r3", Date.parse("2026-10-14T12:00:00Z"));
const middle = aGiven("g2", Date.parse("2026-10-14T09:00:00Z"));
const older = aLevelUp(4, Date.parse("2026-10-13T18:00:00Z"));
const oldest = aReceived("r1", Date.parse("2026-10-12T08:00:00Z"));

describe("WS214 WS216: the timeline reads pages one after another", () => {
  it("starts on its first page with nothing shown", () => {
    expect(firstPage("given")).toMatchObject({ filter: "given", entries: [], cursor: null, status: "first", landed: false });
  });

  it("appends each page in the read's order and keeps the next page's cursor", () => {
    const state = after({ kind: "read", answer: aPage([newest, middle], "c1") }, { kind: "asked", by: "scroll" }, { kind: "read", answer: aPage([older, oldest], "c2") });
    expect(state.entries).toEqual([newest, middle, older, oldest]);
    expect(state).toMatchObject({ cursor: "c2", status: "idle", landed: true, added: 2 });
  });

  it("takes the answer's time zone", () => {
    expect(after({ kind: "read", answer: aPage([newest], "c1", "Pacific/Auckland") }).timeZone).toBe("Pacific/Auckland");
  });

  it("ends when a page answers no cursor", () => {
    expect(after({ kind: "read", answer: aPage([newest], null) }).status).toBe("end");
  });

  it("treats a short page as a page, never as the end", () => {
    const state = after({ kind: "read", answer: aPage([], "c1") });
    expect(state).toMatchObject({ status: "idle", cursor: "c1", landed: true, added: 0 });
  });

  it("skips entries of kinds it doesn't know", () => {
    const state = after({ kind: "read", answer: aPage([anUnknownKind(), newest], "c1") });
    expect(state.entries).toEqual([newest]);
  });

  it("remembers who asked for a page, so the page can place focus", () => {
    const pressed = after({ kind: "read", answer: aPage([newest], "c1") }, { kind: "asked", by: "button" });
    expect(pressed).toMatchObject({ status: "loading", askedBy: "button" });
    expect(timeline(pressed, { kind: "read", answer: aPage([older], "c2") }).askedBy).toBe("button");
    expect(after({ kind: "read", answer: aPage([newest], "c1") }, { kind: "asked", by: "scroll" }).askedBy).toBe("scroll");
  });

  it("asks for one page at a time", () => {
    const loading = after({ kind: "read", answer: aPage([newest], "c1") }, { kind: "asked", by: "scroll" });
    expect(timeline(loading, { kind: "asked", by: "button" })).toBe(loading);
  });

  it("never asks past the end", () => {
    const ended = after({ kind: "read", answer: aPage([newest], null) });
    expect(timeline(ended, { kind: "asked", by: "button" })).toBe(ended);
  });

  it("marks a failed page and reads it again when asked", () => {
    const failed = after({ kind: "read", answer: aPage([newest], "c1") }, { kind: "asked", by: "scroll" }, { kind: "failed" });
    expect(failed).toMatchObject({ status: "failed", entries: [newest], cursor: "c1" });
    expect(timeline(failed, { kind: "asked", by: "button" })).toMatchObject({ status: "loading", cursor: "c1", askedBy: "button" });
  });

  it("reads the first page again after it failed", () => {
    const failed = after({ kind: "failed" });
    expect(failed).toMatchObject({ status: "failed", landed: false });
    expect(timeline(failed, { kind: "asked", by: "button" })).toMatchObject({ status: "first", cursor: null, landed: false });
  });

  it("drops everything on a reset and starts again from the newest page", () => {
    const reset = after({ kind: "read", answer: aPage([newest, middle], "c1") }, { kind: "reset", filter: "received" });
    expect(reset).toEqual(firstPage("received"));
  });

  it("ignores a page nobody is waiting for", () => {
    const idle = after({ kind: "read", answer: aPage([newest], "c1") });
    expect(timeline(idle, { kind: "read", answer: aPage([older], "c2") })).toBe(idle);
  });
});

describe("WS215: entry identity", () => {
  it("names a kudos by its kind and key, and a level-up by its instant and level", () => {
    expect(entryIdOf(aReceived("k1", 1))).toBe("kudosReceived:k1");
    expect(entryIdOf(aGiven("k1", 1))).toBe("kudosGiven:k1");
    expect(entryIdOf(aLevelUp(5, 1234))).toBe("levelUp:1234:5");
  });
});

describe("WS214: Show new activity compares the live watch with what is shown", () => {
  const shown = after({ kind: "read", answer: aPage([newest, middle, older], "c1") });

  it("raises nothing while the watch holds what is shown", () => {
    expect(hasNewActivity(shown, aPage([newest, middle, older], "c1"))).toBe(false);
  });

  it("raises nothing while the watch hasn't answered", () => {
    expect(hasNewActivity(shown, undefined)).toBe(false);
  });

  it("raises an entry the timeline doesn't show", () => {
    expect(hasNewActivity(shown, aPage([aGiven("g9", Date.parse("2026-10-14T13:00:00Z")), newest, middle], "c1"))).toBe(true);
  });

  it("raises a new entry inside the newest instant, sorting after the shown head", () => {
    const sameInstant = aReceived("r2", newest.at);
    expect(hasNewActivity(shown, aPage([newest, sameInstant, middle], "c1"))).toBe(true);
  });

  it("raises a shown entry whose content changed", () => {
    const deleted = { ...newest, message: { kind: "unavailable", reason: "deleted" } } as const;
    expect(hasNewActivity(shown, aPage([deleted, middle, older], "c1"))).toBe(true);
  });

  it("raises nothing for an entry of a kind it doesn't know", () => {
    expect(hasNewActivity(shown, aPage([anUnknownKind(), newest, middle, older], "c1"))).toBe(false);
  });

  it("compares nothing before the current timeline's first page lands", () => {
    const resetting = timeline(shown, { kind: "reset", filter: "all" });
    expect(hasNewActivity(resetting, aPage([aGiven("g9", Date.parse("2026-10-14T13:00:00Z"))], null))).toBe(false);
  });

  it("raises nothing on an empty timeline, which takes the watch instead", () => {
    const empty = after({ kind: "read", answer: aPage([], null) });
    expect(hasNewActivity(empty, aPage([newest], null))).toBe(false);
  });
});

describe("WS214: an empty timeline takes the watch directly", () => {
  it("shows the watch's entries at once while nothing is shown", () => {
    const empty = after({ kind: "read", answer: aPage([], null) });
    expect(timeline(empty, { kind: "watched", answer: aPage([newest, middle], "c1") })).toMatchObject({ entries: [newest, middle], cursor: "c1", status: "idle", landed: true });
  });

  it("keeps the shown entries while there are any", () => {
    const shown = after({ kind: "read", answer: aPage([middle], null) });
    expect(timeline(shown, { kind: "watched", answer: aPage([newest, middle], null) })).toBe(shown);
  });

  it("waits for the first page before taking anything", () => {
    const waiting = firstPage("all");
    expect(timeline(waiting, { kind: "watched", answer: aPage([newest], null) })).toBe(waiting);
  });

  it("ignores a watch that only holds kinds it doesn't know", () => {
    const empty = after({ kind: "read", answer: aPage([], null) });
    expect(timeline(empty, { kind: "watched", answer: aPage([anUnknownKind()], null) })).toBe(empty);
  });
});
