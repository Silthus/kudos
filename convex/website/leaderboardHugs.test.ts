import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { firstHypeEmojiNameFor } from "../album/emojiNames";
import { catalogue } from "../album/hoggies/catalogue";
import { xpToReach } from "../progression/levels";
import { allowanceRange, hugBudgetRange } from "../workspace/settingsBounds";
import type { BoardsNextStep, HugBoardsRead, HugMeasure, Highlight, PersonRow, JoiningTeam, Tallies, WithinReach } from "./leaderboard";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const weekMs = 7 * dayMs;
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const dana = { user: "U_DANA", name: "Dana Ferreira" };
const kiri = { user: "U_KIRI", name: "Kiri Tamaki", tz: "Pacific/Kiritimati" };
const people: Person[] = [alice, bob, carol, dana, kiri];
const why = "Thanks for untangling the flaky migration";
const workspaceUrl = "https://kudos-test.slack.com/";
const websiteFlags = ["album", "everyone-board", "hugs", "collection", "packs", "groups"];

type Person = { user: string; name: string; tz?: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Boards = Extract<HugBoardsRead, { kind: "boards" }>;
type Shown = Pick<PersonRow, "name" | "rank" | "figure" | "you">;
type Joining = Pick<JoiningTeam, "name" | "joined" | "of" | "standing" | "mine">;

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(tuesday.getTime() - 2 * weekMs) });
  aDeploymentForWorkspace();
  messages = 0;
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack().withWorkspaceUrl(workspaceUrl);
  for (const person of people) slack.withMember(person.user, slackUserOf(person));
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", url: workspaceUrl, kudosEmoji: "taco", baseAllowance: 200 }));
  await leaderboardHugs(true);
  for (const person of people) {
    await memberChanged(t, "team_join", { id: person.user, ...slackUserOf(person) });
    await settle(t);
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HH69 HH81: the Leaderboard reads getBoards only while leaderboard-hugs is on", () => {
  test("with the flag on, getBoards answers this week's boards and the album says the Leaderboard ranks hugs", async () => {
    await thisWeek();
    const asAlice = await signedIn(alice);

    expect((await asAlice.query(api.website.leaderboard.getBoards, {})).kind).toBe("boards");
    expect(await albumSaysLeaderboardHugs(asAlice)).toBe(true);
  });

  test("with the flag off, getBoards answers off, the album says nothing of it, and the kudos boards answer as before", async () => {
    await thisWeek();
    await leaderboardHugs(false);
    const asAlice = await signedIn(alice);

    expect(await asAlice.query(api.website.leaderboard.getBoards, {})).toEqual({ kind: "off" });
    expect(await albumSaysLeaderboardHugs(asAlice)).toBe(false);
    expect((await asAlice.query(api.website.album.getThoughtfulBoards, {})).kind).toBe("boards");
  });

  test("viewing the Leaderboard records the member's leaderboard-hugs exposure, on or off, and getBoards records none", async () => {
    await thisWeek();
    const asAlice = await signedIn(alice);
    await asAlice.query(api.website.leaderboard.getBoards, {});
    expect(await exposuresOf("leaderboard-hugs"), "after the read").toEqual([]);

    await asAlice.mutation(api.website.album.viewLeaderboard, { period: "week" });
    await leaderboardHugs(false);
    await asAlice.mutation(api.website.album.viewLeaderboard, { period: "week" });

    expect(await exposuresOf("leaderboard-hugs")).toEqual([true, false]);
  });
});

describe("HH70: the you card tallies this week beside last week", () => {
  test("hugs given, hugs received and kudos received count this week and last week apart, in the member's own week", async () => {
    await lastWeek();
    await hugsOn(alice, bob);
    await hugsOn(carol, alice);
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);
    const alices = await said(alice, "Deploy is green");
    await hugs(bob, alice, alices);
    await hugs(dana, alice, alices);
    await thanks(bob, why, alice);

    const { you } = await boardsOf(alice);

    expect(you.tallies).toEqual<Tallies>({ hugsGiven: 2, hugsReceived: 2, kudosReceived: 1, hoggiesFound: 0 });
    expect(you.lastWeek).toEqual<Tallies>({ hugsGiven: 1, hugsReceived: 1, kudosReceived: 0, hoggiesFound: 0 });
  });

  test("hoggies found counts the hoggies the member put in this week", async () => {
    await thisWeek();
    await thanks(alice, why, bob);
    const asAlice = await signedIn(alice);
    await openEveryPack(asAlice);
    await asAlice.mutation(api.website.album.putAllIn, {});
    await settle(t);

    const { you } = await boardsOf(alice);

    expect(you.tallies.hoggiesFound).toBe(1);
    expect(you.lastWeek.hoggiesFound).toBe(0);
  });
});

describe("HH71: the you card always leads with a positive highlight", () => {
  test("more hugs given than in any week before is the best week of hugs yet", async () => {
    await lastWeek();
    await hugsOn(alice, bob);
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "best-week", hugsGiven: 2, more: 1, hoggiesFound: 0 });
  });

  test("more hugs than last week, short of an earlier best week, says how many more", async () => {
    await weeksAgo(2);
    for (const author of [bob, carol, dana]) await hugsOn(alice, author);
    await lastWeek();
    await hugsOn(alice, bob);
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "more-hugs", more: 1, hugsGiven: 2 });
  });

  test("without more hugs than last week, the teammates who thanked the member this week count once each, however they thanked", async () => {
    await thisWeek();
    const alices = await said(alice, "Deploy is green");
    await hugs(bob, alice, alices);
    await hugs(carol, alice, alices);
    await thanks(carol, why, alice);
    await hugsOn(dana, bob);

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "thanked", teammates: 2, reach: 0 });
  });

  test("the teammates who thanked the member count in the member's own week, wherever the giver's week falls", async () => {
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    await thanks(alice, why, kiri);
    vi.setSystemTime(new Date("2026-10-19T13:00:00Z"));

    const { you } = await boardsOf(kiri);

    expect(you.tallies.kudosReceived).toBe(1);
    expect(you.highlight).toEqual<Highlight>({ kind: "thanked", teammates: 1, reach: 0 });
  });

  test("a quiet week after a week with hugs tells the hugs of last week, and whether it was the best week yet", async () => {
    await weeksAgo(2);
    await hugsOn(alice, bob);
    await lastWeek();
    await hugsOn(alice, bob);
    await hugsOn(alice, carol);
    await thisWeek();

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "last-week", hugs: 2, best: true, reach: 2 });
  });

  test("otherwise it tells how many teammates the member's thanks ever reached", async () => {
    await weeksAgo(2);
    await hugsOn(alice, bob);
    await thanks(alice, why, carol, bob);
    await thisWeek();

    expect((await boardsOf(alice)).you.highlight).toEqual<Highlight>({ kind: "reach", teammates: 2 });
  });
});

describe("HH73: the People board ranks the chosen measure", () => {
  test("Hugs given, the first chip, ranks the people who gave hugs this week, equal figures sharing a rank, with the member's row tagged even before they have a figure", async () => {
    await thisWeek();
    for (const author of [bob, carol]) await hugsOn(alice, author);
    for (const author of [bob, carol]) await hugsOn(dana, author);
    await hugsOn(bob, alice);

    const { measure, people } = await boardsOf(carol);

    expect(measure).toBe("hugsGiven");
    expect(shown(people.rows)).toEqual<Shown[]>([
      { name: alice.name, rank: 1, figure: 2, you: false },
      { name: dana.name, rank: 1, figure: 2, you: false },
      { name: bob.name, rank: 3, figure: 1, you: false },
      { name: carol.name, rank: null, figure: 0, you: true },
    ]);
  });

  test("Hugged and Kudos received rank what people got this week", async () => {
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(dana, bob);
    await hugsOn(alice, carol);
    await thanks(bob, why, alice);

    expect(shown((await boardsOf(alice, "hugsReceived")).people.rows)).toEqual<Shown[]>([
      { name: bob.name, rank: 1, figure: 2, you: false },
      { name: carol.name, rank: 2, figure: 1, you: false },
      { name: alice.name, rank: null, figure: 0, you: true },
    ]);
    expect(shown((await boardsOf(alice, "kudosReceived")).people.rows)).toEqual<Shown[]>([{ name: alice.name, rank: 1, figure: 1, you: true }]);
  });

  test("Level ranks the people on this week's or last week's boards and the member by level", async () => {
    await lastWeek();
    await hugsOn(bob, alice);
    await thisWeek();
    await hugsOn(carol, alice);
    await atLevel(alice, 3);
    await atLevel(bob, 5);
    await atLevel(carol, 3);
    await atLevel(kiri, 9);

    expect(shown((await boardsOf(dana, "level")).people.rows)).toEqual<Shown[]>([
      { name: bob.name, rank: 1, figure: 5, you: false },
      { name: alice.name, rank: 2, figure: 3, you: false },
      { name: carol.name, rank: 2, figure: 3, you: false },
      { name: dana.name, rank: 4, figure: 1, you: true },
    ]);
  });

  test("Hoggies ranks the same people by the hoggies they own", async () => {
    await thisWeek();
    await hugsOn(alice, bob);
    await owns(alice, 3);
    await owns(bob, 1);

    expect(shown((await boardsOf(carol, "hoggies")).people.rows)).toEqual<Shown[]>([
      { name: alice.name, rank: 1, figure: 3, you: false },
      { name: bob.name, rank: 2, figure: 1, you: false },
      { name: carol.name, rank: null, figure: 0, you: true },
    ]);
  });

  test("a long board shows Leaderboard's window: the top three and the three around the member, with the member's row", async () => {
    const crowd = await moreTeammates(12);
    await thisWeek();
    await thanks(alice, why, ...crowd);
    for (const [index, person] of crowd.entries()) await atLevel(person, index + 2);
    await atLevel(alice, 1);

    expect(shown((await boardsOf(alice, "level")).people.rows).map(({ rank, figure, you }) => `${rank}:${figure}${you ? ":you" : ""}`)).toEqual(["1:13", "2:12", "3:11", "10:4", "11:3", "12:2", "13:1:you"]);
    expect(shown((await boardsOf(alice, "kudosReceived")).people.rows).map(({ rank, you }) => `${rank}${you ? ":you" : ""}`)).toEqual(["1", "1", "1", "null:you"]);
  });

  test("members who left the boards are on no board, their own view included", async () => {
    await thisWeek();
    await hugsOn(alice, bob);
    await hugsOn(bob, alice);
    await leavesTheBoards(alice);

    expect(shown((await boardsOf(carol)).people.rows).map(({ name }) => name)).toEqual([bob.name, carol.name]);
    expect(shown((await boardsOf(alice)).people.rows).map(({ name }) => name)).toEqual([bob.name]);
  });

  test("each row names the person it opens", async () => {
    await thisWeek();
    await hugsOn(alice, bob);

    const [row] = (await boardsOf(bob)).people.rows;

    expect(row!.person).toBe(await memberOf(alice));
  });
});

describe("HH74: a fresh week", () => {
  test("when nobody has a figure on the measure this week, the board brings last week's top three", async () => {
    await lastWeek();
    for (const author of [bob, carol, dana, kiri]) await hugsOn(alice, author);
    for (const author of [carol, dana, kiri]) await hugsOn(bob, author);
    for (const author of [alice, dana]) await hugsOn(carol, author);
    await hugsOn(dana, alice);
    await thisWeek();
    await thanks(kiri, why, bob);

    const { people } = await boardsOf(dana);

    expect(shown(people.rows)).toEqual<Shown[]>([{ name: dana.name, rank: null, figure: 0, you: true }]);
    expect(shown(people.lastWeek!)).toEqual<Shown[]>([
      { name: alice.name, rank: 1, figure: 4, you: false },
      { name: bob.name, rank: 2, figure: 3, you: false },
      { name: carol.name, rank: 3, figure: 2, you: false },
    ]);
  });

  test("the board names the workspace's kudos emoji, for the way to be first", async () => {
    await thisWeek();

    expect((await boardsOf(alice)).kudosEmoji).toEqual({ kudosEmoji: "taco", kudosEmojiImage: null });
  });

  test("a measure someone has a figure on this week brings no last week", async () => {
    await lastWeek();
    await hugsOn(alice, bob);
    await thisWeek();
    await thanks(kiri, why, bob);

    expect((await boardsOf(dana, "kudosReceived")).people.lastWeek).toBeNull();
  });
});

describe("HH75: You in your team", () => {
  test("on this week's measures it lists the teammates who joined in and the member, and counts the teammates who can still join in", async () => {
    await inTheOtters(alice, bob, carol, dana);
    await thisWeek();
    await hugsOn(bob, kiri);
    await thanks(dana, why, kiri);

    const { team } = await boardsOf(alice);

    expect(team).toMatchObject({ name: "Otters", yetToJoin: 1 });
    expect(shown(team!.rows)).toEqual<Shown[]>([
      { name: bob.name, rank: 1, figure: 1, you: false },
      { name: alice.name, rank: null, figure: 0, you: true },
      { name: dana.name, rank: null, figure: 0, you: false },
    ]);
  });

  test("a teammate joins in with a hug or a kudos given, and the member never counts among those who can still join in", async () => {
    await inTheOtters(alice, bob, carol, dana);
    await thisWeek();
    await thanks(alice, why, kiri);
    await thanks(bob, why, kiri);
    await hugsOn(kiri, carol);

    expect((await boardsOf(alice)).team).toMatchObject({ yetToJoin: 2 });
  });

  test("the member's team says whether they joined in, whatever their figure on the chosen measure", async () => {
    await inTheOtters(alice, bob, carol);
    await thisWeek();
    expect((await boardsOf(alice, "kudosReceived")).team, "before").toMatchObject({ joinedIn: false });

    await hugsOn(alice, kiri);

    expect((await boardsOf(alice, "kudosReceived")).team, "after a hug").toMatchObject({ joinedIn: true });
  });

  test("a teammate who left the boards is neither listed nor counted among those who can still join in", async () => {
    await inTheOtters(alice, bob, carol, dana);
    await thisWeek();
    await hugsOn(bob, kiri);
    await hugsOn(dana, kiri);
    await leavesTheBoards(dana);

    const { team } = await boardsOf(alice);

    expect(team).toMatchObject({ yetToJoin: 1 });
    expect(shown(team!.rows).map(({ name }) => name)).toEqual([bob.name, alice.name]);
  });

  test("on level and hoggies it lists the whole team", async () => {
    await inTheOtters(alice, bob, carol);
    await thisWeek();
    await atLevel(carol, 4);

    const { team } = await boardsOf(alice, "level");

    expect(team).toMatchObject({ yetToJoin: 0 });
    expect(shown(team!.rows)).toEqual<Shown[]>([
      { name: carol.name, rank: 1, figure: 4, you: false },
      { name: alice.name, rank: 2, figure: 1, you: true },
      { name: bob.name, rank: 2, figure: 1, you: false },
    ]);
  });

  test("a primary group of fewer than three is no team, and neither is any group while groups is off", async () => {
    await inTheOtters(alice, bob);
    await thisWeek();
    expect((await boardsOf(alice)).team, "two Otters").toBeNull();

    await inTheOtters(alice, bob, carol);
    await switchWebsite(t, postHog, true, ...websiteFlags.filter((flag) => flag !== "groups"), "leaderboard-hugs");
    expect((await boardsOf(alice)).team, "groups off").toBeNull();
  });
});

describe("HH76 HH77: teams joining in", () => {
  test("a team scores the points it gained in the share of its members who joined in, against the same weekday last week, and gaining teams rank by points", async () => {
    const [ezra] = await moreTeammates(1);
    await inGroups({ Otters: [alice, bob, carol], Badgers: [dana, kiri, ezra!] });
    await lastWeek();
    await thanks(bob, why, dana);
    await thisWeek();
    await thanks(alice, why, dana);
    await hugsOn(bob, kiri);
    await hugsOn(carol, kiri);
    await thanks(dana, why, alice);

    expect(joining(await boardsOf(alice))).toEqual<Joining[]>([
      { name: "Otters", joined: 3, of: 3, standing: { rank: 1, gain: 67 }, mine: true },
      { name: "Badgers", joined: 1, of: 3, standing: { rank: 2, gain: 33 }, mine: false },
    ]);
  });

  test("equal gains share a rank, and a team that gained nothing or lost ground folds with no figure", async () => {
    const [ezra, finn, gale, hal] = await moreTeammates(4);
    await inGroups({ Otters: [alice, bob, carol], Badgers: [dana, kiri, ezra!], Herons: [finn!, gale!, hal!] });
    await lastWeek();
    await thanks(finn!, why, alice);
    await thanks(gale!, why, alice);
    await thisWeek();
    await thanks(alice, why, dana);
    await thanks(dana, why, alice);
    await thanks(finn!, why, alice);

    expect(joining(await boardsOf(alice))).toEqual<Joining[]>([
      { name: "Badgers", joined: 1, of: 3, standing: { rank: 1, gain: 33 }, mine: false },
      { name: "Otters", joined: 1, of: 3, standing: { rank: 1, gain: 33 }, mine: true },
      { name: "Herons", joined: 1, of: 3, standing: null, mine: false },
    ]);
  });

  test("last week counts only who joined in on or before today's weekday", async () => {
    await inGroups({ Otters: [alice, bob, carol] });
    await lastWeek();
    await thanks(bob, why, dana);
    vi.setSystemTime(Date.now() + 2 * dayMs);
    await thanks(carol, why, dana);
    await thisWeek();
    await thanks(alice, why, dana);
    await thanks(carol, why, dana);

    expect(joining(await boardsOf(alice))).toEqual<Joining[]>([{ name: "Otters", joined: 2, of: 3, standing: { rank: 1, gain: 33 }, mine: true }]);
  });

  test("every team folds before the first week anything was counted", async () => {
    await inGroups({ Otters: [alice, bob, carol] });
    await thisWeek();
    await thanks(alice, why, dana);

    expect(joining(await boardsOf(alice))).toEqual<Joining[]>([{ name: "Otters", joined: 1, of: 3, standing: null, mine: true }]);
  });

  test("a team whose group is newer than the same weekday last week folds", async () => {
    const [ezra] = await moreTeammates(1);
    await inGroups({ Otters: [alice, bob, carol] });
    await lastWeek();
    await thanks(kiri, why, alice);
    await thisWeek();
    await inGroups({ Otters: [alice, bob, carol], Badgers: [dana, kiri, ezra!] });
    await thanks(alice, why, dana);
    await thanks(dana, why, alice);

    expect(joining(await boardsOf(alice))).toEqual<Joining[]>([
      { name: "Otters", joined: 1, of: 3, standing: { rank: 1, gain: 33 }, mine: true },
      { name: "Badgers", joined: 1, of: 3, standing: null, mine: false },
    ]);
  });

  test("a member who left the boards counts neither among who joined in nor among the team", async () => {
    const [ezra] = await moreTeammates(1);
    await inGroups({ Otters: [alice, bob, carol, ezra!] });
    await lastWeek();
    await thanks(kiri, why, dana);
    await thisWeek();
    await thanks(alice, why, dana);
    await thanks(ezra!, why, dana);
    await leavesTheBoards(ezra!);

    expect(joining(await boardsOf(alice))).toEqual<Joining[]>([{ name: "Otters", joined: 1, of: 3, standing: { rank: 1, gain: 33 }, mine: true }]);
  });

  test("a team carries the crest and page of the company team with its name, and only groups of three or more primary members join the board", async () => {
    await companyTeams({ otters: "Otters" });
    await inGroups({ Otters: [alice, bob, carol], Pairs: [dana, kiri] });
    await thisWeek();

    const { joiningIn } = await boardsOf(alice);

    expect(joiningIn?.teams.map(({ name, team, art }) => ({ name, team, art }))).toEqual([{ name: "Otters", team: "otters", art: { kind: "image", url: "https://example.com/otters.png" } }]);
  });

  test("a group names its company team whatever its case, punctuation, ampersand or the words team and folks around the name", async () => {
    await companyTeams({ otters: "Otters", "wizard-docs": "Wizard & Docs", "led-sales": "Product-Led Sales" });
    const [ezra, finn, gwen, hugo] = await moreTeammates(4);
    await inGroups({ "Team Otters": [alice, bob, carol], "wizard and docs folks": [dana, kiri, ezra!], "Product Led Sales Team": [finn!, gwen!, hugo!] });
    await thisWeek();

    const { joiningIn } = await boardsOf(alice);

    expect(joiningIn?.teams.map(({ name, team }) => ({ name, team }))).toEqual([
      { name: "Product Led Sales Team", team: "led-sales" },
      { name: "Team Otters", team: "otters" },
      { name: "wizard and docs folks", team: "wizard-docs" },
    ]);
  });

  test("teams joining in is missing while groups is off or without a team", async () => {
    await inGroups({ Pairs: [alice, bob] });
    await thisWeek();
    expect((await boardsOf(alice)).joiningIn, "no team").toBeNull();

    await inGroups({ Otters: [alice, bob, carol] });
    await switchWebsite(t, postHog, true, ...websiteFlags.filter((flag) => flag !== "groups"), "leaderboard-hugs");
    expect((await boardsOf(alice)).joiningIn, "groups off").toBeNull();
  });
});

describe("HH72: one next step beside the you card", () => {
  test("a member who gave this week is asked to give a kudos to the first teammate nudgesFor names, collecting their hype emoji", async () => {
    await thisWeek();
    await thanks(alice, why, bob);
    await hypeReactsTo(carol, bob);
    await hugsOn(carol, dana);
    await hugsOn(carol, dana);

    expect((await boardsOf(carol)).next).toEqual<BoardsNextStep>({ kind: "lively", teammate: await faceOf(bob), collectsHype: true, epicHoggiesByKudos: false });
  });

  test("without a nudge, it names the teammate the member hugged or thanked most this week, and a teammate without a hype emoji collects none", async () => {
    await lastWeek();
    for (let kudos = 0; kudos < 3; kudos += 1) await thanks(carol, why, kiri);
    await thisWeek();
    await hugsOn(carol, dana);
    await thanks(carol, why, dana);
    await thanks(carol, why, bob);

    expect((await boardsOf(carol)).next).toEqual<BoardsNextStep>({ kind: "lively", teammate: await faceOf(dana), collectsHype: false, epicHoggiesByKudos: false });
  });

  test("the teammate thanked most counts the whole week, however many teammates were thanked since", { timeout: 60_000 }, async () => {
    await withTheLargestSettings();
    const crowd = await moreTeammates(allowanceRange.most * 5);
    await thisWeek();
    await thanks(carol, why, dana);
    await thanks(carol, why, dana);
    for (let day = 0; day < 5; day += 1) {
      vi.setSystemTime(Date.now() + dayMs);
      await thanks(carol, why, ...crowd.slice(day * allowanceRange.most, (day + 1) * allowanceRange.most));
    }

    expect((await boardsOf(carol)).next).toMatchObject({ kind: "lively", teammate: { name: dana.name } });
  });

  test("the teammate hugged most counts the whole week, however many hugs were given since", { timeout: 120_000 }, async () => {
    await withTheLargestSettings();
    const crowd = await moreTeammates(60);
    await thisWeek();
    for (let hug = 0; hug < 3; hug += 1) await hugsOn(carol, dana);
    for (let day = 0; day < 3; day += 1) {
      vi.setSystemTime(Date.now() + dayMs);
      for (let hug = 0; hug < 40; hug += 1) await hugsOn(carol, crowd[(day * 40 + hug) % crowd.length]!);
    }

    expect((await boardsOf(carol)).next).toMatchObject({ kind: "lively", teammate: { name: dana.name } });
  });

  test("it says the kudos collects the teammate's hype emoji only while the member doesn't hold it yet", async () => {
    await thisWeek();
    await thanks(alice, why, bob);
    await hugsOn(carol, bob);
    expect((await boardsOf(carol)).next, "before carol holds it").toMatchObject({ kind: "lively", teammate: { name: bob.name }, collectsHype: true });

    await thanks(carol, why, bob);

    expect((await boardsOf(carol)).next, "once carol holds it").toMatchObject({ kind: "lively", teammate: { name: bob.name }, collectsHype: false });
  });

  test("while rarity-caps is on for the member, it says kudos are the only way to epic hoggies", async () => {
    await thisWeek();
    await hugsOn(carol, dana);
    await switchWebsite(t, postHog, true, ...websiteFlags, "leaderboard-hugs", "rarity-caps");

    expect((await boardsOf(carol)).next).toMatchObject({ kind: "lively", epicHoggiesByKudos: true });
  });

  test("a member who gave nothing this week is asked to hug back a kudos they got that they can still hug, as Activity's thanked step", async () => {
    await lastWeek();
    await hugsOn(alice, carol);
    await thisWeek();
    const kudos = await thanks(bob, why, alice);

    expect((await boardsOf(alice)).next).toEqual<BoardsNextStep>({ kind: "quiet", giver: await faceOf(bob), permalink: permalinkOf(kudos), at: atOf(kudos) });
  });

  test("giving this week comes before a kudos to hug back", async () => {
    await thisWeek();
    await thanks(bob, why, alice);
    await hugsOn(alice, dana);

    expect((await boardsOf(alice)).next).toMatchObject({ kind: "lively", teammate: { name: dana.name } });
  });

  test("everyone else is asked for the first hug of the week, which pays extra XP only while hug rewards show to them", async () => {
    await thisWeek();
    expect((await boardsOf(alice)).next, "hug-rewards off").toEqual<BoardsNextStep>({ kind: "empty", firstHugPaysExtra: false });

    await switchWebsite(t, postHog, true, ...websiteFlags, "leaderboard-hugs", "hug-rewards");

    expect((await boardsOf(alice)).next, "hug-rewards on").toEqual<BoardsNextStep>({ kind: "empty", firstHugPaysExtra: true });
  });

  test("the answer carries the workspace's Slack link for the step's button", async () => {
    await thisWeek();

    expect((await boardsOf(alice)).slack).toBe("https://app.slack.com/client/T1");
  });
});

describe("HH78: emojis within your reach", () => {
  test("the first teammate nudgesFor names brings their hype emoji, one kudos away", async () => {
    await thisWeek();
    await thanks(alice, why, bob);
    await hypeReactsTo(carol, bob);

    expect((await boardsOf(carol)).withinReach.hype).toEqual<WithinReach["hype"]>({ person: await faceOf(bob), emoji: { name: firstHypeEmojiNameFor(bob.name), picture: expect.any(String), inSlack: false }, progress: { have: 0, need: 1 } });
    expect((await boardsOf(dana)).withinReach.hype, "without a nudge").toBeNull();
  });

  test("the member's team emoji shows the stickers to go while the team page is still collecting", async () => {
    await theCompanyCopyHolds({ slug: "otters", name: "Otters", profiles: profilesOf(alice, bob, carol, dana) });
    await thisWeek();
    await aliceCollects(bob);

    expect((await boardsOf(alice)).withinReach.team).toEqual<WithinReach["team"]>({ teamName: "Otters", emoji: { name: "team-otters", picture: expect.any(String), inSlack: false }, progress: { have: 1, need: 3 } });
    expect((await boardsOf(kiri)).withinReach.team, "without a team page of their own").toBeNull();

    await aliceCollects(carol, dana);

    expect((await boardsOf(alice)).withinReach.team, "every sticker collected").toBeNull();
  });

  test("the next level emoji shows the XP to go, and none past the last one", async () => {
    await thisWeek();
    await thanks(bob, why, carol);
    await atLevel(alice, 3);

    expect((await boardsOf(alice)).withinReach.level).toEqual<WithinReach["level"]>({ level: 5, emoji: { name: "level-5", picture: expect.any(String), inSlack: false }, progress: { have: xpToReach(3), need: xpToReach(5) } });

    await atLevel(alice, 25);

    expect((await boardsOf(alice)).withinReach.level).toBeNull();
  });
});

async function leaderboardHugs(on: boolean) {
  await switchWebsite(t, postHog, true, ...websiteFlags, ...(on ? ["leaderboard-hugs"] : []));
}

async function weeksAgo(weeks: number) {
  vi.setSystemTime(new Date(tuesday.getTime() - weeks * weekMs + messages * minuteMs));
}

function lastWeek() {
  return weeksAgo(1);
}

function thisWeek() {
  return weeksAgo(0);
}

function slackUserOf({ name, tz }: Person) {
  return { real_name: name, ...(tz !== undefined && { tz }), profile: { real_name: name, display_name: name } };
}

async function signedIn(person: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: person.user, name: person.name });
  return asSignedIn;
}

async function boardsOf(person: Person, measure?: HugMeasure): Promise<Boards> {
  const read = await (await signedIn(person)).query(api.website.leaderboard.getBoards, measure === undefined ? {} : { measure });
  if (read.kind !== "boards") throw new Error(`expected the boards, got ${JSON.stringify(read)}`);
  return read;
}

async function albumSaysLeaderboardHugs(reader: Reader) {
  const album = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected the album, got ${album.kind}`);
  return album.leaderboardHugs === true;
}

function nextTs() {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  return `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
}

async function said(author: Person, words: string) {
  const ts = nextTs();
  await post(t, [section(text(words))], { user: author.user, ts });
  await settle(t);
  return ts;
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = nextTs();
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts });
  await settle(t);
  return ts;
}

async function hugs(giver: Person, author: Person, ts: string) {
  messages += 1;
  await react(t, { user: giver.user, itemUser: author.user, ts, eventId: `EvHug${messages}`, eventTs: `${Math.floor(Date.now() / 1000)}.999999` });
  await settle(t);
}

async function hugsOn(giver: Person, author: Person) {
  const ts = await said(author, "A message worth a hug");
  await hugs(giver, author, ts);
  return ts;
}

async function openEveryPack(reader: Reader) {
  const album = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected the album, got ${album.kind}`);
  for (const { pack } of album.packs) await reader.mutation(api.website.album.openThoughtfulPack, { pack });
}

function shown(rows: PersonRow[]): Shown[] {
  return rows.map(({ name, rank, figure, you }) => ({ name, rank, figure, you }));
}

function memberOf(person: Person) {
  return t.run(async (ctx) => (await ctx.db.query("members").collect()).find(({ user }) => user === person.user)!._id);
}

async function atLevel(person: Person, level: number) {
  const member = await memberOf(person);
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    if (row === null) await ctx.db.insert("memberProgress", { member, xp: xpToReach(level), pointsSpent: 0 });
    else await ctx.db.patch(row._id, { xp: xpToReach(level) });
  });
}

async function owns(person: Person, hoggies: number) {
  const member = await memberOf(person);
  await t.run(async (ctx) => {
    for (const [index, { hoggie }] of catalogue.hoggies.slice(0, hoggies).entries()) await ctx.db.insert("hoggieTallies", { member, hoggie, count: 1, firstAt: Date.now(), firstN: index + 1 });
  });
}

function withTheLargestSettings() {
  const largest = { baseAllowance: allowanceRange.most, hugBudget: hugBudgetRange.most };
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_workspace", (q) => q.eq("workspace", "T1"))
      .unique();
    if (row === null) await ctx.db.insert("workspaces", { workspace: "T1", ...largest });
    else await ctx.db.patch(row._id, largest);
  });
}

async function moreTeammates(count: number): Promise<Person[]> {
  const crowd = Array.from({ length: count }, (_, index) => ({ user: `U_CROWD${String(index).padStart(3, "0")}`, name: `Crowd Member ${String(index).padStart(3, "0")}` }));
  for (const person of crowd) {
    slack.withMember(person.user, slackUserOf(person));
    await memberChanged(t, "team_join", { id: person.user, ...slackUserOf(person) });
  }
  await settle(t);
  return crowd;
}

async function leavesTheBoards(person: Person) {
  await (await signedIn(person)).mutation(api.website.commands.setBoardVisibility, { visible: false });
  await settle(t);
}

async function inTheOtters(...otters: Person[]) {
  await inGroups({ Otters: otters });
}

function companyTeams(teams: Record<string, string>) {
  return t.run(async (ctx) => {
    for (const [team, name] of Object.entries(teams)) await ctx.db.insert("companyTeams", { team, name, crestImage: `https://example.com/${team}.png`, leads: [], people: [], asOf: Date.now() });
  });
}

async function inGroups(groups: Record<string, Person[]>) {
  for (const [name, members] of Object.entries(groups)) slack.withUserGroup(`S_${name.toUpperCase()}`, { name, users: members.map(({ user }) => user) });
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
}

function joining({ joiningIn }: Boards): Joining[] {
  return (joiningIn?.teams ?? []).map(({ name, joined, of, standing, mine }) => ({ name, joined, of, standing, mine }));
}

function exposuresOf(flag: string) {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter((exposure) => exposure.flag === flag).map(({ value }) => value));
}

async function hypeReactsTo(giver: Person, owner: Person) {
  const ts = await said(owner, "A message worth a hype");
  messages += 1;
  await react(t, { user: giver.user, itemUser: owner.user, ts, reaction: firstHypeEmojiNameFor(owner.name), eventId: `EvHype${messages}` });
  await settle(t);
}

async function faceOf(person: Person) {
  const [row] = (await boardsOf(person, "level")).people.rows.filter(({ you }) => you);
  return { person: row!.person, name: row!.name, face: row!.face };
}

function permalinkOf(ts: string) {
  return `${workspaceUrl}archives/C1/p${ts.replace(".", "")}`;
}

function atOf(ts: string) {
  return Number(ts.split(".")[0]) * 1000;
}

async function theCompanyCopyHolds(...teams: TeamPage[]) {
  postHogCom.withTeams(...teams);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
}

function profilesOf(...members: Person[]): TeamPage["profiles"] {
  return members.map(({ name }) => {
    const [firstName, lastName] = name.split(" ") as [string, string];
    return { id: people.findIndex((someone) => someone.name === name) + 1, firstName, lastName, colour: "teal" };
  });
}

async function aliceCollects(...collected: Person[]) {
  await thanks(alice, why, ...collected);
  const asAlice = await signedIn(alice);
  await openEveryPack(asAlice);
  for (let placed = await asAlice.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await asAlice.mutation(api.website.album.putAllIn, {});
  await settle(t);
}
