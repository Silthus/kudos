import { describe, expect, test } from "vitest";
import { groupsBoard, type GroupFacts, type GroupsBoardFacts } from "./groupsBoard";

type Group = [name: string, members: number, kudos: number, givers: number, before?: [kudos: number, givers: number]];

function facts(groups: Group[], overrides: Partial<GroupsBoardFacts<string>> = {}): GroupsBoardFacts<string> {
  return { period: "week", groups: groups.map(groupOf), viewerGroup: null, best: null, ...overrides };
}

function groupOf([name, members, kudos, givers, [beforeKudos, beforeGivers] = [0, 0]]: Group): GroupFacts<string> {
  return { group: `S_${name}`, name, members, now: { kudos, givers }, before: { kudos: beforeKudos, givers: beforeGivers } };
}

function shown(board: ReturnType<typeof groupsBoard<string>>) {
  return board.rows.map(({ rank, name, perMember, participation, kudos }) => `${rank} ${name} ${perMember.toFixed(1)} ${participation}% ${kudos}`);
}

describe("GB13: the Groups board", () => {
  test.each([
    { members: 3, kudos: 10, givers: 2, perMember: 3.3, participation: 66 },
    { members: 3, kudos: 11, givers: 3, perMember: 3.7, participation: 100 },
    { members: 7, kudos: 1, givers: 1, perMember: 0.1, participation: 14 },
    { members: 4, kudos: 0, givers: 0, perMember: 0, participation: 0 },
    { members: 8, kudos: 5, givers: 5, perMember: 0.6, participation: 62 },
  ])("$kudos kudos from $givers of $members members: $perMember per person, $participation% gave", ({ members, kudos, givers, perMember, participation }) => {
    const [row] = groupsBoard(facts([["Owls", members, kudos, givers]])).rows;

    expect(row).toMatchObject({ perMember, participation, kudos, members });
  });

  test("lists only groups with at least 3 primary members, a group that gave nothing included", () => {
    const board = groupsBoard(facts([["Pair", 2, 40, 2], ["Trio", 3, 3, 1], ["Quiet", 5, 0, 0]]));

    expect(shown(board)).toEqual(["1 Trio 1.0 33% 3", "2 Quiet 0.0 0% 0"]);
  });

  test.each([
    { tieBreak: "score", groups: [["Big", 10, 10, 10], ["Small", 3, 6, 1]] as Group[], order: ["Small", "Big"] },
    { tieBreak: "participation", groups: [["Few", 4, 8, 2], ["All", 3, 6, 3]] as Group[], order: ["All", "Few"] },
    { tieBreak: "total kudos", groups: [["Trio", 3, 6, 3], ["Sextet", 6, 12, 6]] as Group[], order: ["Sextet", "Trio"] },
    { tieBreak: "name", groups: [["Zebras", 3, 6, 3], ["Ants", 3, 6, 3]] as Group[], order: ["Ants", "Zebras"] },
  ])("groups rank by score, then participation, total kudos and name: $tieBreak decides", ({ groups, order }) => {
    expect(groupsBoard(facts(groups)).rows.map(({ name }) => name)).toEqual(order);
  });

  test("score and participation rank as shown, so groups equal on all three shown numbers share a rank", () => {
    const board = groupsBoard(facts([["Ants", 3, 10, 2], ["Bees", 6, 20, 4], ["Cats", 3, 20, 3], ["Dogs", 3, 10, 2]]));

    expect(board.rows.map(({ position, rank, tied, name }) => `${position} ${rank} ${tied} ${name}`)).toEqual(["1 1 false Cats", "2 2 false Bees", "3 3 true Ants", "4 3 true Dogs"]);
  });

  test.each([
    { viewerPosition: 5, window: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { viewerPosition: 12, window: [1, 2, 3, 9, 10, 11, 12, 13, 14, 15] },
    { viewerPosition: 15, window: [1, 2, 3, 12, 13, 14, 15] },
  ])("G17: the viewer's group at position $viewerPosition of 15 sees $window", ({ viewerPosition, window }) => {
    const fifteen: Group[] = Array.from({ length: 15 }, (_, index) => [`G${String(index + 1).padStart(2, "0")}`, 3, 30 - index, 1]);

    const board = groupsBoard(facts(fifteen, { viewerGroup: `S_G${String(viewerPosition).padStart(2, "0")}` }));

    expect(board.window).toEqual(window);
    expect(board.standing).toEqual({ kind: "ranked", position: viewerPosition, rank: viewerPosition });
    expect(board.rows.filter(({ mine }) => mine).map(({ position }) => position)).toEqual([viewerPosition]);
  });

  test.each([
    { case: "a viewer whose group isn't listed", viewerGroup: "S_Pair", standing: { kind: "not-listed" } },
    { case: "a viewer without a primary group", viewerGroup: null, standing: { kind: "no-group" } },
  ])("$case sees positions 1–3", ({ viewerGroup, standing }) => {
    const groups: Group[] = [["Pair", 2, 9, 2], ["A", 3, 5, 1], ["B", 3, 4, 1], ["C", 3, 3, 1], ["D", 3, 2, 1], ["E", 3, 1, 1]];

    const board = groupsBoard(facts(groups, { viewerGroup }));

    expect(board.window).toEqual([1, 2, 3]);
    expect(board.standing).toEqual(standing);
    expect(board.improvement).toBeNull();
  });
});

describe("GB18: places climbed on the Groups board", () => {
  test("a group that rose against last period up to the same day climbed; one that fell or stayed didn't", () => {
    const board = groupsBoard(facts([["Ants", 3, 30, 3, [3, 1]], ["Bees", 3, 20, 2, [9, 3]], ["Cats", 3, 10, 1, [6, 2]], ["Dogs", 3, 5, 1, [0, 0]]]));

    expect(board.rows.map(({ name, climbed }) => [name, climbed])).toEqual([
      ["Ants", 2],
      ["Bees", null],
      ["Cats", null],
      ["Dogs", null],
    ]);
  });

  test("a listed group that had no kudos last period was on that board too, so rising from its place there is a climb", () => {
    const board = groupsBoard(facts([["Ants", 3, 9, 3, [0, 0]], ["Bees", 3, 3, 1, [3, 1]]], { viewerGroup: "S_Ants" }));

    expect(board.rows.map(({ name, climbed }) => [name, climbed])).toEqual([
      ["Ants", 1],
      ["Bees", null],
    ]);
    expect(board.improvement).toEqual({ gain: 3, places: 1 });
  });

  test("all time compares with nothing", () => {
    const board = groupsBoard(facts([["Ants", 3, 30, 3, [3, 1]], ["Bees", 3, 20, 2, [9, 3]]], { period: "all", viewerGroup: "S_Ants", best: 90 }));

    expect(board.rows.map(({ climbed }) => climbed)).toEqual([null, null]);
    expect(board.improvement).toBeNull();
    expect(board.mostImproved).toBeNull();
  });
});

describe("GB14: the group's lines", () => {
  test("3 members whose kudos rose from 30 to 60 gained 10.0 per person, with the places their group climbed", () => {
    const board = groupsBoard(facts([["Ants", 3, 60, 3, [30, 3]], ["Bees", 3, 45, 3, [45, 3]]], { viewerGroup: "S_Ants" }));

    expect(board.improvement).toEqual({ gain: 10, places: 1 });
  });

  test("the gain is computed once, from the totals, and rounded to one decimal", () => {
    const board = groupsBoard(facts([["Owls", 7, 12, 4, [2, 1]]], { viewerGroup: "S_Owls" }));

    expect(board.improvement).toEqual({ gain: 1.4 });
  });

  test.each([
    { case: "fewer kudos than last period", now: 20, before: 30 },
    { case: "the same kudos", now: 30, before: 30 },
    { case: "a gain that rounds to 0.0", now: 30, before: 29 },
  ])("with $case the line names the group's best completed period per person", ({ now, before }) => {
    const board = groupsBoard(facts([["Owls", 25, now, 3, [before, 3]]], { viewerGroup: "S_Owls", best: 110 }));

    expect(board.improvement).toEqual({ best: 4.4 });
  });

  test("without a gain or a completed period with kudos there is no line", () => {
    const board = groupsBoard(facts([["Owls", 3, 3, 1, [3, 1]]], { viewerGroup: "S_Owls", best: null }));

    expect(board.improvement).toBeNull();
  });

  test("the most improved group is the listed one with the largest gain per person, ties by name", () => {
    const board = groupsBoard(facts([["Zebras", 3, 9, 3, [0, 0]], ["Ants", 6, 18, 3, [0, 0]], ["Pair", 2, 90, 2, [0, 0]], ["Bees", 3, 30, 3, [30, 3]]]));

    expect(board.mostImproved).toEqual({ group: "S_Ants", name: "Ants", gain: 3 });
  });

  test("no group gained, so none is the most improved", () => {
    const board = groupsBoard(facts([["Ants", 3, 3, 1, [9, 3]], ["Bees", 3, 3, 1, [3, 1]]]));

    expect(board.mostImproved).toBeNull();
  });
});
