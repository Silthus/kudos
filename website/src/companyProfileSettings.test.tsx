import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminParts, companyProfiles, manyPeople, oriel, samantha, settingsFixtures, tamsin, wren } from "./settingsFixtures";
import type { SettingsShown } from "./settingsRead";
import { shellFixtures, type AdminProfileLinkReply, type AdminProfiles, type CompanyProfileLinkReply, type CompanyProfileSetting, type MySettings, type ShellActions } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

type Commands = Partial<Pick<ShellActions, "linkMyCompanyProfile" | "linkCompanyProfile">>;

function showSettings(settings: MySettings, commands: Commands = {}) {
  let shown: SettingsShown = settings;
  const view = renderApp(shellFixtures.memberWithSettings, undefined, commands, undefined, undefined, undefined, undefined, undefined, undefined, undefined, (asking) => (asking ? shown : undefined));
  const showSettingsAnswer = (next: MySettings) => {
    shown = next;
    view.showVisitor({ ...shellFixtures.memberWithSettings });
  };
  return { ...view, showSettingsAnswer };
}

function withCompanyProfile(companyProfile: CompanyProfileSetting): MySettings {
  return { ...settingsFixtures.everything, companyProfile };
}

function forAnAdmin(admin: AdminProfiles): MySettings {
  return { ...settingsFixtures.everything, companyProfile: companyProfiles.byName, admin };
}

function answerLater<Reply>() {
  let resolve: (answer: Reply) => void = () => undefined;
  const answer = new Promise<Reply>((settle) => {
    resolve = settle;
  });
  return { answer, resolve };
}

function region(name: string) {
  return within(screen.getByRole("main")).getByRole("region", { name });
}

function thisIsMe() {
  return region("This is me on posthog.com");
}

function people(within_: HTMLElement) {
  return within(within_).getByRole("list", { name: "People on posthog.com" });
}

function shownPeople(within_: HTMLElement) {
  return within(people(within_))
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("heading").textContent);
}

describe("#608: a member's posthog.com match changes only through the link commands", { timeout: 60_000 }, () => {
  describe("#608: This is me on posthog.com", () => {
    it("leaves the section out while the read carries no company profile, as with team-pages off", () => {
      showSettings(settingsFixtures.everything);

      expect(within(screen.getByRole("main")).queryByRole("region", { name: "This is me on posthog.com" })).not.toBeInTheDocument();
      expect(within(screen.getByRole("main")).queryByRole("region", { name: "Match teammates" })).not.toBeInTheDocument();
    });

    it("says an unmatched member isn't matched yet and lists every choice by name, with its role and teams", () => {
      showSettings(withCompanyProfile(companyProfiles.unmatched));

      expect(thisIsMe()).toHaveTextContent("You aren't matched to anyone on posthog.com yet.");
      expect(shownPeople(thisIsMe())).toEqual(["Oriel Pemberton", "Samantha Okafor", "Tamsin Vale", "Wren Halloway"]);
      const orielRow = within(people(thisIsMe())).getAllByRole("listitem")[0]!;
      expect(orielRow).toHaveTextContent("Designer");
      expect(orielRow).toHaveTextContent("Lantern, Kite");
    });

    it("finds a person by name, role or team, ignoring case and accents", async () => {
      const { user } = showSettings(withCompanyProfile(companyProfiles.unmatched));
      const search = within(thisIsMe()).getByRole("searchbox", { name: "Find yourself on posthog.com" });

      await user.type(search, "SAMANTHA");
      expect(shownPeople(thisIsMe())).toEqual(["Samantha Okafor"]);

      await user.clear(search);
      await user.type(search, "kite");
      expect(shownPeople(thisIsMe())).toEqual(["Oriel Pemberton", "Tamsin Vale"]);

      await user.clear(search);
      await user.type(search, "désigner");
      expect(shownPeople(thisIsMe())).toEqual(["Oriel Pemberton"]);

      await user.clear(search);
      await user.type(search, "nobody here");
      expect(within(thisIsMe()).queryByRole("list", { name: "People on posthog.com" })).not.toBeInTheDocument();
      expect(thisIsMe()).toHaveTextContent("Nobody on posthog.com matches “nobody here”.");
    });

    it("keeps a long list bounded, saying how many more a search narrows down", async () => {
      const { user } = showSettings(withCompanyProfile(companyProfiles.amongMany));

      expect(shownPeople(thisIsMe())).toHaveLength(20);
      expect(thisIsMe()).toHaveTextContent(`${manyPeople.length + 4 - 20} more. Type a name, role or team to narrow it down.`);

      await user.type(within(thisIsMe()).getByRole("searchbox", { name: "Find yourself on posthog.com" }), "Lark");
      expect(shownPeople(thisIsMe())).toHaveLength(6);
      expect(thisIsMe()).not.toHaveTextContent("more.");
    });

    it("sends This is me once with the person's profile, holds every choice while it's pending, and names the match once the read shows it", async () => {
      const pending = answerLater<CompanyProfileLinkReply>();
      const linkMyCompanyProfile = vi.fn(() => pending.answer);
      const { user, showSettingsAnswer } = showSettings(withCompanyProfile(companyProfiles.unmatched), { linkMyCompanyProfile });

      await user.click(within(thisIsMe()).getByRole("button", { name: "This is me: Samantha Okafor" }));

      expect(linkMyCompanyProfile).toHaveBeenCalledExactlyOnceWith(samantha.profile);
      for (const button of within(people(thisIsMe())).getAllByRole("button")) expect(button).toHaveAttribute("aria-disabled", "true");

      await act(async () => pending.resolve({ kind: "linked" }));
      showSettingsAnswer(withCompanyProfile(companyProfiles.bySelf));

      expect(within(thisIsMe()).getByRole("status")).toHaveTextContent("You're Samantha Okafor on posthog.com.");
      expect(linkMyCompanyProfile).toHaveBeenCalledOnce();
    });

    it("keeps keyboard focus in the section when the pressed choice leaves the page, after a pick and after a clear", async () => {
      const { user, showSettingsAnswer } = showSettings(withCompanyProfile(companyProfiles.unmatched), { linkMyCompanyProfile: async () => ({ kind: "linked" }) });

      within(thisIsMe()).getByRole("button", { name: "This is me: Samantha Okafor" }).focus();
      await user.keyboard("{Enter}");
      showSettingsAnswer(withCompanyProfile(companyProfiles.bySelf));
      expect(within(thisIsMe()).getByRole("heading", { level: 2, name: "This is me on posthog.com" })).toHaveFocus();

      within(thisIsMe()).getByRole("button", { name: "That isn't me" }).focus();
      await user.keyboard("{Enter}");
      showSettingsAnswer(withCompanyProfile(companyProfiles.unmatched));
      expect(within(thisIsMe()).getByRole("heading", { level: 2, name: "This is me on posthog.com" })).toHaveFocus();
    });

    it("leaves focus alone after a refused pick, when something else on the page later leaves", async () => {
      const settings = { ...forAnAdmin(adminParts.teammates), companyProfile: companyProfiles.unmatched };
      const { user, showSettingsAnswer } = showSettings(settings, { linkMyCompanyProfile: async () => ({ kind: "refused", reason: "taken" }), linkCompanyProfile: async () => ({ kind: "linked" }) });
      await user.click(within(thisIsMe()).getByRole("button", { name: "This is me: Samantha Okafor" }));
      await user.click(within(region("Match teammates")).getByRole("checkbox", { name: "Only teammates without a match" }));

      const adaRow = within(within(region("Match teammates")).getByRole("list", { name: "Teammates" })).getByRole("heading", { level: 3, name: "Ada Admin" }).closest("li")!;
      await user.click(within(adaRow).getByRole("button", { name: "Change Ada Admin's match" }));
      await user.click(within(adaRow).getByRole("button", { name: "Not on posthog.com" }));
      const matched = adminParts.teammates.members.map((member) => (member.key === "k-ada" ? { ...member, by: "admin" as const } : member));
      showSettingsAnswer({ ...settings, admin: { ...adminParts.teammates, members: matched } });

      expect(within(thisIsMe()).getByRole("heading", { level: 2, name: "This is me on posthog.com" })).not.toHaveFocus();
    });

    it("shows the member's own pick with That isn't me, which clears it, and offers the other people to change to", async () => {
      const linkMyCompanyProfile = vi.fn(async (): Promise<CompanyProfileLinkReply> => ({ kind: "linked" }));
      const { user, showSettingsAnswer } = showSettings(withCompanyProfile(companyProfiles.bySelf), { linkMyCompanyProfile });

      expect(within(thisIsMe()).getByRole("heading", { level: 3, name: "Samantha Okafor" })).toBeInTheDocument();
      expect(thisIsMe()).toHaveTextContent("You picked this profile.");
      expect(shownPeople(thisIsMe())).toEqual(["Oriel Pemberton", "Tamsin Vale"]);

      await user.click(within(thisIsMe()).getByRole("button", { name: "That isn't me" }));
      expect(linkMyCompanyProfile).toHaveBeenCalledExactlyOnceWith(null);

      showSettingsAnswer(withCompanyProfile(companyProfiles.unmatched));
      expect(within(thisIsMe()).getByRole("status")).toHaveTextContent("Your pick is cleared.");
    });

    it.each([
      ["a name match", companyProfiles.byName, "Wren Halloway", "Matched by your name in Slack. If that isn't you, ask a workspace admin to fix it."],
      ["an admin's match", companyProfiles.byAdmin, "Oriel Pemberton", "A workspace admin matched you. Ask them if it's wrong."],
    ])("shows %s with who decided it and offers no choice the command would refuse", (_, companyProfile, name, line) => {
      showSettings(withCompanyProfile(companyProfile));

      expect(within(thisIsMe()).getByRole("heading", { level: 3, name })).toBeInTheDocument();
      expect(thisIsMe()).toHaveTextContent(line);
      expect(within(thisIsMe()).queryByRole("searchbox")).not.toBeInTheDocument();
      expect(within(thisIsMe()).queryByRole("button")).not.toBeInTheDocument();
    });

    it("says an admin noted the member isn't on posthog.com, offering no choice", () => {
      showSettings(withCompanyProfile(companyProfiles.notOnPostHog));

      expect(thisIsMe()).toHaveTextContent("A workspace admin noted that you aren't on posthog.com. Ask them if that's wrong.");
      expect(within(thisIsMe()).queryByRole("button")).not.toBeInTheDocument();
    });

    it.each([
      ["matched", "You're already matched, so only a workspace admin can change it."],
      ["taken", "Someone else already holds that profile. If it's you, ask a workspace admin."],
      ["unknown", "That profile isn't on posthog.com any more."],
      [null, "Matching isn't open for you right now."],
    ] as const)("says what a %s refusal means in its own sentence", async (reason, line) => {
      const { user } = showSettings(withCompanyProfile(companyProfiles.unmatched), { linkMyCompanyProfile: async () => ({ kind: "refused", reason }) });

      await user.click(within(thisIsMe()).getByRole("button", { name: "This is me: Wren Halloway" }));

      expect(within(thisIsMe()).getByRole("status")).toHaveTextContent(line);
    });

    it("says HedgeHug couldn't be reached when the send fails", async () => {
      const { user } = showSettings(withCompanyProfile(companyProfiles.unmatched), { linkMyCompanyProfile: async () => Promise.reject(new Error("offline")) });

      await user.click(within(thisIsMe()).getByRole("button", { name: "This is me: Wren Halloway" }));

      expect(within(thisIsMe()).getByRole("status")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    });
  });

  describe("#608: admins match teammates", () => {
    function matching() {
      return region("Match teammates");
    }

    function teammates() {
      return within(matching()).getByRole("list", { name: "Teammates" });
    }

    function shownTeammates() {
      return within(teammates())
        .getAllByRole("listitem")
        .map((item) => within(item).getByRole("heading", { level: 3 }).textContent);
    }

    function rowOf(name: string) {
      return within(teammates()).getByRole("heading", { level: 3, name }).closest("li")!;
    }

    async function change(user: ReturnType<typeof showSettings>["user"], name: string) {
      await user.click(within(rowOf(name)).getByRole("button", { name: `Change ${name}'s match` }));
      return within(rowOf(name)).getByRole("group", { name: `${name}'s match` });
    }

    it("is shown only while the read carries the admin part", () => {
      showSettings(withCompanyProfile(companyProfiles.byName));

      expect(within(screen.getByRole("main")).queryByRole("region", { name: "Match teammates" })).not.toBeInTheDocument();
    });

    it("lists every teammate with how they're matched", () => {
      showSettings(forAnAdmin(adminParts.teammates));

      expect(shownTeammates()).toEqual(["Ada Admin", "Oriel Pemberton", "Sam Okafor", "Tam Vale", "Wren Halloway"]);
      expect(rowOf("Ada Admin")).toHaveTextContent("Not matched");
      expect(rowOf("Oriel Pemberton")).toHaveTextContent("Not on posthog.com, set by an admin");
      expect(rowOf("Sam Okafor")).toHaveTextContent("Picked Samantha Okafor themselves");
      expect(rowOf("Tam Vale")).toHaveTextContent("Matched by an admin to Tamsin Vale");
      expect(rowOf("Wren Halloway")).toHaveTextContent("Matched by name to Wren Halloway");
    });

    it("finds teammates by their name or their match, and filters to the unmatched", async () => {
      const { user } = showSettings(forAnAdmin(adminParts.teammates));

      await user.type(within(matching()).getByRole("searchbox", { name: "Find a teammate" }), "samantha");
      expect(shownTeammates()).toEqual(["Sam Okafor"]);

      await user.clear(within(matching()).getByRole("searchbox", { name: "Find a teammate" }));
      await user.click(within(matching()).getByRole("checkbox", { name: "Only teammates without a match" }));
      expect(shownTeammates()).toEqual(["Ada Admin"]);
    });

    it("keeps many teammates bounded, saying how many more a search narrows down", () => {
      showSettings(forAnAdmin(adminParts.manyTeammates));

      expect(shownTeammates()).toHaveLength(25);
      expect(matching()).toHaveTextContent(`${manyPeople.length - 25} more teammates. Search to narrow it down.`);
    });

    it("matches a teammate to a profile once, saying whose it moves from, and names the match once the read shows it", async () => {
      const pending = answerLater<AdminProfileLinkReply>();
      const linkCompanyProfile = vi.fn(() => pending.answer);
      const { user, showSettingsAnswer } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile });

      const editor = await change(user, "Ada Admin");
      expect(within(people(editor)).getAllByRole("listitem")[1]).toHaveTextContent("Held by Sam Okafor");
      await user.type(within(editor).getByRole("searchbox", { name: "Find their posthog.com profile" }), "samantha");
      await user.click(within(editor).getByRole("button", { name: "Match Ada Admin to Samantha Okafor" }));

      expect(linkCompanyProfile).toHaveBeenCalledExactlyOnceWith("k-ada", samantha.profile);
      expect(within(rowOf("Ada Admin")).getByRole("button", { name: "Change Ada Admin's match" })).toHaveAttribute("aria-disabled", "true");

      await act(async () => pending.resolve({ kind: "linked" }));
      const moved = adminParts.teammates.members.map((member) => (member.key === "k-ada" ? { ...member, profile: samantha.profile, by: "admin" as const } : member.key === "k-sam" ? { ...member, profile: null, by: null } : member));
      showSettingsAnswer(forAnAdmin({ ...adminParts.teammates, members: moved }));

      expect(within(rowOf("Ada Admin")).getByRole("status")).toHaveTextContent("Ada Admin is matched to Samantha Okafor.");
      expect(rowOf("Ada Admin")).toHaveTextContent("Matched by an admin to Samantha Okafor");
    });

    it("keeps a teammate held while their match is pending, even when a search hides the row and brings it back", async () => {
      const pending = answerLater<AdminProfileLinkReply>();
      const linkCompanyProfile = vi.fn(() => pending.answer);
      const { user } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile });

      await user.click(within(await change(user, "Ada Admin")).getByRole("button", { name: "Not on posthog.com" }));
      const search = within(matching()).getByRole("searchbox", { name: "Find a teammate" });
      await user.type(search, "wren");
      expect(shownTeammates()).toEqual(["Wren Halloway"]);
      await user.clear(search);

      const changeAda = within(rowOf("Ada Admin")).getByRole("button", { name: "Change Ada Admin's match" });
      expect(changeAda).toHaveAttribute("aria-disabled", "true");
      await user.click(changeAda);
      expect(within(rowOf("Ada Admin")).queryByRole("group")).not.toBeInTheDocument();
      expect(linkCompanyProfile).toHaveBeenCalledOnce();

      await act(async () => pending.resolve({ kind: "linked" }));
      expect(within(rowOf("Ada Admin")).getByRole("button", { name: "Change Ada Admin's match" })).not.toHaveAttribute("aria-disabled", "true");
    });

    it("leaves a teammate's current profile out of their choices", async () => {
      const { user } = showSettings(forAnAdmin(adminParts.teammates));

      const editor = await change(user, "Wren Halloway");

      expect(shownPeople(editor)).toEqual([oriel.name, samantha.name, tamsin.name]);
      expect(shownPeople(editor)).not.toContain(wren.name);
    });

    it("marks a teammate as not on posthog.com with none", async () => {
      const linkCompanyProfile = vi.fn(async (): Promise<AdminProfileLinkReply> => ({ kind: "linked" }));
      const { user } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile });

      await user.click(within(await change(user, "Wren Halloway")).getByRole("button", { name: "Not on posthog.com" }));

      expect(linkCompanyProfile).toHaveBeenCalledExactlyOnceWith("k-wren", "none");
    });

    it("undoes only an admin's own match, with null", async () => {
      const linkCompanyProfile = vi.fn(async (): Promise<AdminProfileLinkReply> => ({ kind: "linked" }));
      const { user } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile });

      expect(within(await change(user, "Wren Halloway")).queryByRole("button", { name: "Undo the admin match" })).not.toBeInTheDocument();
      await user.click(within(await change(user, "Tam Vale")).getByRole("button", { name: "Undo the admin match" }));

      expect(linkCompanyProfile).toHaveBeenCalledExactlyOnceWith("k-tam", null);
    });

    it("closes the editor on Cancel without sending, returning focus to Change", async () => {
      const linkCompanyProfile = vi.fn(async (): Promise<AdminProfileLinkReply> => ({ kind: "linked" }));
      const { user } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile });

      await user.click(within(await change(user, "Ada Admin")).getByRole("button", { name: "Cancel" }));

      expect(within(rowOf("Ada Admin")).queryByRole("group")).not.toBeInTheDocument();
      expect(within(rowOf("Ada Admin")).getByRole("button", { name: "Change Ada Admin's match" })).toHaveFocus();
      expect(linkCompanyProfile).not.toHaveBeenCalled();
    });

    it.each([
      ["not-admin", "Only workspace admins can match teammates."],
      ["unknown", "That teammate or profile isn't here any more."],
      [null, "Matching isn't open for you right now."],
    ] as const)("says what a %s refusal means in its own sentence", async (reason, line) => {
      const { user } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile: async () => ({ kind: "refused", reason }) });

      await user.click(within(await change(user, "Ada Admin")).getByRole("button", { name: "Not on posthog.com" }));

      expect(within(rowOf("Ada Admin")).getByRole("status")).toHaveTextContent(line);
    });
  });
});

describe("#608: the posthog.com sections pass axe in light and dark", () => {
  const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

  for (const dark of [false, true]) {
    it(`for an admin with an open editor, after a refusal, in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const { container, user } = showSettings(forAnAdmin(adminParts.teammates), { linkCompanyProfile: async () => ({ kind: "refused", reason: "unknown" }) });
      await user.click(within(region("Match teammates")).getByRole("button", { name: "Change Ada Admin's match" }));
      await user.click(within(region("Match teammates")).getByRole("button", { name: "Not on posthog.com" }));
      await user.click(within(region("Match teammates")).getByRole("button", { name: "Change Ada Admin's match" }));

      const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    }, 30_000);

    it(`for an unmatched member, in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const { container } = showSettings(withCompanyProfile(companyProfiles.unmatched));

      const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    }, 30_000);
  }
});
