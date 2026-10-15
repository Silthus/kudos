import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function main() {
  return screen.getByRole("main");
}

function thankInSlack() {
  return within(main()).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" });
}

function comesBefore(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("WS98 WS101: the hero is the character header, leading with the member and the invitation", () => {
  function hero() {
    return within(main()).getByRole("region", { name: "Sam Example" });
  }

  it("shows the member's face as the portrait, and Character over their name as the page title in RoundHog", () => {
    renderApp(shellFixtures.member);
    expect(within(hero()).getByText("SE")).toHaveClass("size-28");
    expect(within(hero()).getByText("Character")).toHaveClass("hud-label");
    const title = within(hero()).getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent(/^Sam Example$/);
    expect(title).toHaveClass("hud-display");
    expect(comesBefore(within(hero()).getByText("Character"), title)).toBe(true);
    expect(document.title).toBe("HedgeHug · Profile");
  });

  it("titles the sheet You when the sign-in carried no name", () => {
    const { name: _, ...withoutName } = shellFixtures.member;
    renderApp({ ...withoutName, face: { kind: "initials", initials: "?" } });
    expect(within(main()).getByRole("region", { name: "You" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^You$/);
  });

  it("invites the member to thank someone directly under the name, with the one action, which opens the member's workspace", () => {
    renderApp(shellFixtures.member);
    const invitation = within(hero()).getByText("Thank someone for work you noticed. Mention them in a Slack message with :taco: and say what they did.");
    expect(comesBefore(within(hero()).getByRole("heading", { level: 1 }), invitation)).toBe(true);
    expect(comesBefore(invitation, thankInSlack())).toBe(true);
    expect(thankInSlack()).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(thankInSlack()).toHaveAttribute("target", "_blank");
    expect(within(main()).getAllByRole("link")).toEqual([thankInSlack()]);
    expect(within(main()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("puts the invitation and the action before the XP bar and every counter, and Max last", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const inOrder = [
      within(hero()).getByRole("heading", { level: 1 }),
      thankInSlack(),
      within(hero()).getByRole("progressbar"),
      within(hero()).getByText("Kudos left today"),
      within(hero()).getByText("You've given 14 kudos and received 9."),
      within(hero()).getByText("This week you gave 2 kudos and received 1."),
    ];
    for (const [earlier, later] of inOrder.slice(0, -1).map((element, at) => [element, inOrder[at + 1]!])) {
      expect(comesBefore(earlier!, later!)).toBe(true);
    }
  });

  it("shows the kudos left today as the hero's one big number, a pip per kudos of the base, and the refill", () => {
    renderApp(shellFixtures.member);
    expect(within(hero()).getByText("Kudos left today")).toHaveClass("hud-label");
    expect(within(hero()).getByText("1", { selector: ".hud-display" })).toHaveTextContent(/^1\/3$/);
    const pips = within(hero()).getByRole("img", { name: "1 of 3 kudos left today" });
    expect(pips.children).toHaveLength(3);
    const refill = within(hero()).getByText(/^Refills at/);
    expect(refill.querySelector("time")).toHaveAttribute("dateTime", "2026-10-14T00:00:00.000Z");
  });

  it.each([
    [0, ["spent", "spent", "spent"]],
    [1, ["left", "spent", "spent"]],
    [3, ["left", "left", "left"]],
  ] as const)("fills a pip for each of %i kudos left and outlines each spent one", (left, pips) => {
    renderApp({ ...shellFixtures.member, allowance: { ...shellFixtures.member.allowance, left } });
    const allowance = within(hero()).getByRole("img", { name: `${left} of 3 kudos left today` });
    const shown = [...allowance.children].map((pip) => (pip.classList.contains("bg-foreground") ? "left" : pip.classList.contains("border-muted-foreground") ? "spent" : "unpainted"));
    expect(shown).toEqual(pips);
  });

  it("states the lifetime totals in one quiet line and Max's line on this week, unchanged", () => {
    renderApp(shellFixtures.member);
    expect(within(hero()).getByText("You've given 14 kudos and received 9.")).not.toHaveClass("hud-display");
    expect(within(hero()).getByText("This week you gave 2 kudos and received 1.")).toBeInTheDocument();
  });
});

describe("WS311 V2: the open hero", () => {
  it("drops the card's border, background and corner marks for E's open header spacing", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const hero = within(main()).getByRole("region", { name: "Sam Example" });
    for (const frame of ["hud-panel", "border", "bg-card", "rounded-xl", "p-6"]) expect(hero).not.toHaveClass(frame);
    expect(hero).toHaveClass("sm:py-4", "sm:gap-7", "sm:items-center");
  });
});

describe("WS312 V4: the first-kudos nudge", () => {
  function nudge() {
    return within(main()).queryByRole("region", { name: "Give your first kudos in Slack" });
  }

  function hero() {
    return within(main()).getByRole("region", { name: "Sam Example" });
  }

  function primaries() {
    return [...document.querySelectorAll(".quill-button--variant-primary")];
  }

  it("shows under the hero while the member has given no kudos, teaching with their kudos emoji, with the page's one primary action", () => {
    renderApp({ ...shellFixtures.memberBeforeTheirFirstKudos, kudosEmoji: "sparkles" });
    expect(nudge()).toBeInTheDocument();
    expect(comesBefore(hero(), nudge()!)).toBe(true);
    expect(nudge()!.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(nudge()).toHaveTextContent("Mention a teammate in a Slack message with :sparkles: and say why in five words or more. Every kudos earns XP toward level 2.");
    const action = within(nudge()!).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" });
    expect(action).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(primaries()).toEqual([action]);
    expect(within(hero()).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" })).toHaveClass("quill-button--variant-outline");
  });

  it("promises no XP while the member's progression isn't shown", () => {
    renderApp({ ...shellFixtures.memberBeforeTheirFirstKudos, progression: null });
    expect(within(nudge()!).getByText("Mention a teammate in a Slack message with :taco: and say why in five words or more.")).toBeInTheDocument();
    expect(nudge()!.textContent).not.toMatch(/xp|level/i);
  });

  it("goes once the member has given a kudos, handing the one primary action back to the hero", () => {
    renderApp({ ...shellFixtures.memberBeforeTheirFirstKudos, lifetime: { given: 1, received: 0 } });
    expect(nudge()).not.toBeInTheDocument();
    expect(primaries()).toEqual([within(hero()).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" })]);
  });
});

describe("WS313 V4: spending skill points from the hero", () => {
  function hero() {
    return within(main()).getByRole("region", { name: "Sam Example" });
  }

  function spend() {
    return within(hero()).queryByRole("link", { name: /^Spend/ });
  }

  function skillTreePanel() {
    return within(main()).getByRole("region", { name: "Skill tree" });
  }

  function primaries() {
    return [...document.querySelectorAll(".quill-button--variant-primary")];
  }

  it.each([
    { member: shellFixtures.memberWithEveryFeatureOpen, name: "Spend 2 skill points", count: "2 skill points to spend" },
    { member: shellFixtures.memberWithOneSkillPoint, name: "Spend 1 skill point", count: "1 skill point to spend" },
  ])("offers $name as an outline link to /skills after the allowance row, while the Skill tree panel keeps its count", ({ member, name, count }) => {
    renderApp(member);
    expect(spend()).toHaveAccessibleName(name);
    expect(spend()).toHaveAttribute("href", "/skills");
    expect(spend()).toHaveClass("quill-button--variant-outline");
    expect(spend()!.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(comesBefore(within(hero()).getByRole("img", { name: /kudos left today$/ }), spend()!)).toBe(true);
    expect(within(skillTreePanel()).getByText(count)).toBeInTheDocument();
  });

  it("offers nothing to spend at 0 points, while the Skill tree panel says so", () => {
    renderApp(shellFixtures.memberWithNoSkillPointsLeft);
    expect(spend()).toBeNull();
    expect(within(skillTreePanel()).getByText("No skill points to spend")).toBeInTheDocument();
  });

  it("offers nothing while the Skill tree isn't open", () => {
    renderApp(shellFixtures.memberWithTheBoardOpened);
    expect(spend()).toBeNull();
    expect(hero().textContent).not.toMatch(/skill/i);
  });

  it("keeps the page's one primary action on the hero's Slack link, or on the first-kudos nudge while it shows", () => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(primaries()).toEqual([within(hero()).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" })]);
    cleanup();
    renderApp({ ...shellFixtures.memberWithEveryFeatureOpen, lifetime: { given: 0, received: 0 } });
    const nudge = within(main()).getByRole("region", { name: "Give your first kudos in Slack" });
    expect(primaries()).toEqual([within(nudge).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" })]);
    expect(spend()).toHaveClass("quill-button--variant-outline");
  });

  it("leads to the Skill tree page", async () => {
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureOpen);
    await user.click(spend()!);
    expect(window.location.pathname).toBe("/skills");
  });
});

describe("WS100: the counters table goes", () => {
  it("shows no Your kudos table on the home", () => {
    renderApp(shellFixtures.memberAtLevel7);
    expect(within(main()).queryByRole("table")).not.toBeInTheDocument();
    expect(main()).not.toHaveTextContent("Your kudos");
  });
});

describe("WS21 V19: the member's face", () => {
  const cutout = "https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/sam.png";

  it("shows the member's company profile cutout on its own colour in the hero, the profile card and the avatar menu", () => {
    renderApp({ ...shellFixtures.member, face: { kind: "company-profile", image: cutout, colour: "#8567FF", initials: "SE" } });
    const faces = document.querySelectorAll(`img[src="${cutout}"]`);
    expect(faces).toHaveLength(3);
    for (const face of faces) {
      expect(face).toHaveAttribute("alt", "");
      expect(face).toHaveStyle({ backgroundColor: "#8567FF" });
    }
    expect(screen.queryByText("SE")).not.toBeInTheDocument();
  });

  it.each([
    { kind: "a Slack picture", face: { kind: "slack", image: "https://secure.gravatar.com/avatar/sam.png", initials: "SE" } as const },
    { kind: "a company profile cutout", face: { kind: "company-profile", image: cutout, colour: "#8567FF", initials: "SE" } as const },
  ])("falls back to the member's initials wherever $kind fails to load", ({ face }) => {
    renderApp({ ...shellFixtures.member, face });

    for (const image of document.querySelectorAll(`img[src="${face.image}"]`)) fireEvent.error(image);

    expect(document.querySelectorAll("img[src]")).toHaveLength(0);
    expect(screen.getAllByText("SE")).toHaveLength(3);
  });
});

describe("WS18: what teammates see, and received kudos staying private", () => {
  it("shows the member's profile card as their face and name, saying the kudos they receive stay private", () => {
    renderApp(shellFixtures.member);
    const card = within(main()).getByRole("region", { name: "What teammates see" });
    expect(within(card).getByText("Sam Example")).toBeInTheDocument();
    expect(within(card).getByText("SE")).toBeInTheDocument();
    expect(card).toHaveTextContent("Everyone can see this card. Your XP and the kudos you receive stay with you.");
    expect(card.textContent).not.toMatch(/\d/);
  });
});

describe("WS19 WS106: the later features are plain locked panels", () => {
  it("shows no level or XP anywhere until the facts carry them", () => {
    renderApp(shellFixtures.member);
    expect(main().textContent).not.toMatch(/\blevel\b|\bLv\b|\d XP/i);
  });
});

describe("WS20: a quiet week", () => {
  it("has Max point back to thanking someone in Slack, with the one action and no reward", () => {
    renderApp(shellFixtures.memberWithAQuietWeek);
    expect(within(main()).getByText("No kudos yet this week, so thank someone in Slack for something they did.")).toBeInTheDocument();
    expect(within(main()).queryByText(/This week you gave/)).not.toBeInTheDocument();
    expect(within(main()).getAllByRole("link")).toEqual([thankInSlack()]);
    const hero = within(main()).getByRole("region", { name: "Sam Example" });
    expect(hero.textContent).not.toMatch(/reward|earn|coin|xp/i);
  });
});

describe("WS47 WS50 WS51 WS98 WS99: the level ring and the XP bar, only while progression is present", () => {
  function hero() {
    return within(main()).getByRole("region", { name: "Sam Example" });
  }

  function arcOf(ring: Element) {
    return ring.querySelector("svg [data-arc]");
  }

  it("keeps the ring and the XP bar out, and the rest of the hero standing, while progression is null", () => {
    renderApp(shellFixtures.member);
    expect(screen.queryByRole("img", { name: /^Level/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Sam Example" })).not.toHaveAccessibleDescription();
    expect(document.body.textContent).not.toMatch(/\blevel\b|\bLv\b|\d XP/i);
    expect(within(hero()).getByText("1", { selector: ".hud-display" })).toHaveTextContent(/^1\/3$/);
    expect(within(hero()).getByText("You've given 14 kudos and received 9.")).toBeInTheDocument();
  });

  it.each([
    ["at level 1", shellFixtures.memberAtLevel1, "Level 1, 20 XP to level 2", "1", "0 100"],
    ["past level 5", shellFixtures.memberAtLevel7, "Level 7, 500 XP to level 8", "7", `${100 / 6} 100`],
  ] as const)("draws the level ring %s filled to the level's share, one image named for the level and the XP to the next, with Level over the number in RoundHog", (_, member, name, level, dashes) => {
    renderApp(member);
    const ring = within(hero()).getByRole("img", { name });
    expect(within(ring).getByText("Level")).toHaveClass("hud-label");
    expect(within(ring).getByText(level)).toHaveClass("hud-display");
    expect(arcOf(ring)).toHaveAttribute("pathLength", "100");
    expect(arcOf(ring)).toHaveAttribute("stroke-dasharray", dashes);
    expect(ring).toHaveStyle({ width: "120px", height: "120px" });
  });

  it.each([
    ["at level 1", shellFixtures.memberAtLevel1, ["0 XP", "20 XP to level 2"], { min: "0", max: "20", now: "0", filled: "0%" }],
    ["past level 5", shellFixtures.memberAtLevel7, ["1,600 XP", "500 XP to level 8"], { min: "1500", max: "2100", now: "1600", filled: `${100 / 6}%` }],
  ] as const)("shows a full-width XP bar %s from the level's start to the next, labelled by the XP and the XP to the next level", (_, member, [xp, toNext], { min, max, now, filled }) => {
    renderApp(member);
    const bar = within(hero()).getByRole("progressbar", { name: `${xp} ${toNext}` });
    expect(bar).toHaveAttribute("aria-valuemin", min);
    expect(bar).toHaveAttribute("aria-valuemax", max);
    expect(bar).toHaveAttribute("aria-valuenow", now);
    expect(bar).toHaveClass("w-full");
    expect(bar.firstElementChild).toHaveStyle({ width: filled });
    expect(within(hero()).getByText(xp.replace(" XP", "")).closest(".tabular-nums")).not.toBeNull();
  });

  it("rings the avatar in the HUD with the hero's ring at its size, named and described as the hero ring, with the level number beside the face", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const avatar = within(screen.getByRole("banner")).getByRole("link", { name: "Sam Example, level 7" });
    expect(avatar).toHaveAccessibleDescription("Level 7, 500 XP to level 8");
    const ring = within(avatar).getByRole("img", { name: "Level 7, 500 XP to level 8" });
    expect(arcOf(ring)).toHaveAttribute("pathLength", "100");
    expect(arcOf(ring)).toHaveAttribute("stroke-dasharray", `${100 / 6} 100`);
    expect(within(ring).getByText("SE")).toBeInTheDocument();
    expect(within(ring).getByText("7")).toHaveClass("hud-display");
  });

  it("shows Lv n on the profile card beside the name, read as Level n, and still no received count", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const card = within(main()).getByRole("region", { name: "What teammates see" });
    expect(within(card).getByText("Lv 7")).toBeInTheDocument();
    expect(within(card).getByText("Level 7")).toHaveClass("sr-only");
    expect(within(card).getByText("Sam Example")).toBeInTheDocument();
    expect(card.textContent!.replace("Lv 7", "").replace("Level 7", "")).not.toMatch(/\d/);
  });

  it("shows no skill points, coins, ready pill or crates past level 5", () => {
    renderApp(shellFixtures.memberAtLevel7);
    const banner = screen.getByRole("banner");
    expect(banner.textContent).not.toMatch(/skill|coin|ready|crate/i);
    expect(hero().textContent).not.toMatch(/skill|coin|ready|crate/i);
    expect(within(main()).getByRole("region", { name: "What teammates see" }).textContent).not.toMatch(/skill|coin|ready|crate/i);
  });
});
