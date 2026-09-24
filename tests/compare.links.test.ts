import { describe, expect, test } from "vitest";
import { benchmarkFromParam, compareWithHref, firstName, matchCandidates, neutralDelta } from "../src/lib/compare";

describe("benchmarkFromParam: the ?vs= deep link", () => {
  test("past and an empty or missing vs are Past you", () => {
    expect(benchmarkFromParam("past", "me")).toEqual({ kind: "past" });
    expect(benchmarkFromParam(null, "me")).toEqual({ kind: "past" });
    expect(benchmarkFromParam("", "me")).toEqual({ kind: "past" });
  });

  test("team isn't offered yet, so it falls back to Past you", () => {
    expect(benchmarkFromParam("team", "me")).toEqual({ kind: "past" });
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

describe("firstName: how a teammate is named in labels", () => {
  test("the first word of the Slack display name", () => {
    expect(firstName("Ben Baker")).toBe("Ben");
    expect(firstName("  cleo.m ")).toBe("cleo.m");
  });
});
