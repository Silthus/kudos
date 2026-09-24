import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { TEAMMATE_UNAVAILABLE } from "../convex/lib/compare";
import { benchmarkFromParam, compareTeamHref, compareWithHref, firstName, isTeammateUnavailable, matchCandidates, neutralDelta, sharePercent, teamStat, teamSummary } from "../src/lib/compare";

describe("benchmarkFromParam: the ?vs= deep link", () => {
  test("past and an empty or missing vs are Past you", () => {
    expect(benchmarkFromParam("past", "me")).toEqual({ kind: "past" });
    expect(benchmarkFromParam(null, "me")).toEqual({ kind: "past" });
    expect(benchmarkFromParam("", "me")).toEqual({ kind: "past" });
  });

  test("team is the Team benchmark", () => {
    expect(benchmarkFromParam("team", "me")).toEqual({ kind: "team" });
  });

  test("your own id is Past you: you can't be your own teammate", () => {
    expect(benchmarkFromParam("me", "me")).toEqual({ kind: "past" });
  });

  test("any other value is a teammate id, checked by the server", () => {
    expect(benchmarkFromParam("k57abc", "me")).toEqual({ kind: "teammate", memberId: "k57abc" });
  });
});

describe("compareWithHref: the Leaderboard row action", () => {
  test("keeps the leaderboard's period", () => {
    expect(compareWithHref("k57abc", "week")).toBe("/compare?vs=k57abc&period=week");
    expect(compareWithHref("k57abc", "year")).toBe("/compare?vs=k57abc&period=year");
  });

  test("all time has no comparison, so it opens the default month", () => {
    expect(compareWithHref("k57abc", "all")).toBe("/compare?vs=k57abc&period=month");
  });
});

describe("compareTeamHref: the Me page's \"Compare in detail\" link", () => {
  test("keeps the Me page's period, and opens the default month for all time", () => {
    expect(compareTeamHref("quarter")).toBe("/compare?vs=team&period=quarter");
    expect(compareTeamHref("all")).toBe("/compare?vs=team&period=month");
  });
});

describe("sharePercent: \"you gave more than N% of the team\"", () => {
  test("rounds down, so it never claims more than is true", () => {
    expect(sharePercent(0.8)).toBe("80%");
    expect(sharePercent(249 / 500)).toBe("49%");
    expect(sharePercent(0.999)).toBe("99%");
    expect(sharePercent(1)).toBe("100%");
    expect(sharePercent(0)).toBe("0%");
  });
});

describe("teamSummary: the range strip's tooltip and accessible label", () => {
  test("a full distribution names its median, middle half, most and size", () => {
    expect(teamSummary(14, { n: 38, median: 9, p25: 5, p75: 12.5, max: 1200 })).toEqual([
      "You 14",
      "Team median 9",
      "Middle half 5–12.5",
      "Most 1,200",
      "38 teammates",
    ]);
  });

  test("interpolated quartiles keep one decimal at most", () => {
    expect(teamSummary(41, { n: 16, median: 21, p25: 12.25, p75: 29.5, max: 56 })).toContain("Middle half 12.3–29.5");
    expect(teamStat(12.25)).toBe("12.3");
    expect(teamStat(21)).toBe("21");
  });

  test("a small team has only its median", () => {
    expect(teamSummary(0, { n: 3, median: 4, p25: null, p75: null, max: null })).toEqual(["You 0", "Team median 4", "3 teammates"]);
  });
});

describe("matchCandidates: the picker search", () => {
  const people = [
    { name: "Ana", realName: "Ana Álvarez", title: "Designer" },
    { name: "Ben", realName: "Ben Baker", title: "Engineer" },
    { name: "cleo.m", title: "Engineering manager" },
  ];

  test("an empty query lists everyone", () => {
    expect(matchCandidates("  ", people)).toEqual(people);
  });

  test("matches display name, real name and title, ignoring case and accents", () => {
    expect(matchCandidates("alva", people).map((p) => p.name)).toEqual(["Ana"]);
    expect(matchCandidates("ENGINEER", people).map((p) => p.name)).toEqual(["Ben", "cleo.m"]);
    expect(matchCandidates("baker", people).map((p) => p.name)).toEqual(["Ben"]);
  });

  test("every word has to match somewhere", () => {
    expect(matchCandidates("ben eng", people).map((p) => p.name)).toEqual(["Ben"]);
    expect(matchCandidates("ben design", people)).toEqual([]);
  });
});

describe("neutralDelta: Teammate differences carry no winner", () => {
  test("ahead, behind and level read as plain numbers", () => {
    expect(neutralDelta(4)).toBe("+4");
    expect(neutralDelta(-2)).toBe("−2");
    expect(neutralDelta(0)).toBe("same");
  });

  test("large numbers are grouped", () => {
    expect(neutralDelta(1234)).toBe("+1,234");
  });
});

describe("isTeammateUnavailable: which errors the stale-link card handles", () => {
  test("only the server's unavailable-teammate answer", () => {
    expect(isTeammateUnavailable(new ConvexError(TEAMMATE_UNAVAILABLE))).toBe(true);
  });

  test("signing out, a bad today and plain bugs go to the app-wide handling", () => {
    expect(isTeammateUnavailable(new ConvexError("Sign in with Slack to continue."))).toBe(false);
    expect(isTeammateUnavailable(new Error(TEAMMATE_UNAVAILABLE))).toBe(false);
  });
});

describe("firstName: how a teammate is named in labels", () => {
  test("the first word of the Slack display name", () => {
    expect(firstName("Ben Baker")).toBe("Ben");
    expect(firstName("  cleo.m ")).toBe("cleo.m");
  });
});
