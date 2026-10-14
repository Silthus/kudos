import { describe, expect, it } from "vitest";
import { shellFixtures, type FeatureCard, type MemberProfile } from "../shell";
import { navEntriesOf, type NavEntry } from "./entries";

const readyAt = Date.parse("2026-10-12T09:00:00Z");

const card = (feature: FeatureCard["feature"], name: string, level: number, state: FeatureCard["state"]): FeatureCard => ({
  feature,
  name,
  opens: "something",
  level,
  seen: `seen-${feature}`,
  state,
  readyAt: state === "locked" ? null : readyAt,
  openedAt: state === "open" ? readyAt : null,
});

const memberWith = (features: FeatureCard[] | null, leaderboard: MemberProfile["leaderboard"] = { kind: "off" }): MemberProfile => ({ ...shellFixtures.member, features, leaderboard });

function shown(entry: NavEntry) {
  if (entry.state === "open") return { state: "open", name: entry.name, href: entry.href };
  if (entry.state === "ready") return { state: "ready", name: entry.name, crate: entry.card.seen };
  return { state: "locked", name: entry.name, level: entry.level, next: entry.next };
}

const profile = { state: "open", name: "Profile", href: "/" };

describe("WS301 WS302: navEntriesOf lists Profile, then each shipped feature with a web page in schedule order and in its state", () => {
  it("lists every state in schedule order, marks only the first locked entry as the next unlock, and skips a feature with no web page", () => {
    const member = memberWith([
      card("quests", "Quests", 2, "open"),
      card("leaderboard", "Leaderboard", 3, "ready"),
      card("coins", "Coins and inventory", 4, "open"),
      card("book", "Book", 5, "locked"),
      card("skillTree", "Skill tree", 6, "locked"),
    ]);
    expect(navEntriesOf(member).map(shown)).toEqual([
      profile,
      { state: "open", name: "Quests", href: "/quests" },
      { state: "ready", name: "Leaderboard", crate: "seen-leaderboard" },
      { state: "locked", name: "Book", level: 5, next: true },
      { state: "locked", name: "Skill tree", level: 6, next: false },
    ]);
  });

  it("gives a feature that hasn't shipped no entry, because it has no facts", () => {
    expect(navEntriesOf(memberWith([card("book", "Book", 4, "open")])).map(shown)).toEqual([profile, { state: "open", name: "Book", href: "/book" }]);
    expect(navEntriesOf(memberWith([])).map(shown)).toEqual([profile]);
  });

  it.each([
    ["off", { kind: "off" }, [profile]],
    ["open", { kind: "open" }, [profile, { state: "open", name: "Leaderboard", href: "/leaderboard" }]],
  ] as const)("keeps WS59's fallback while unlocks don't apply and the leaderboard is %s", (_, leaderboard, entries) => {
    expect(navEntriesOf(memberWith(null, leaderboard)).map(shown)).toEqual(entries);
  });
});
