import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const lockedFeatures = ["Quests", "Leaderboard", "Sticker book and achievements", "Skill tree", "Coins", "Hedgehogs"];

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

describe("WS17: the home leads with thanking, then the allowance and the counters", () => {
  it("shows the member's face and name and a headline inviting them to thank a colleague", () => {
    renderApp(shellFixtures.member);
    const hero = within(main()).getByRole("region", { name: "Thank someone for work you noticed" });
    expect(within(hero).getByText("Sam Example")).toBeInTheDocument();
    expect(within(hero).getByText("SE")).toBeInTheDocument();
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent("Thank someone for work you noticed");
    expect(within(hero).getByText(/Mention them in a Slack message with :taco:/)).toBeInTheDocument();
  });

  it("offers one action, thanking someone in Slack, which opens the member's workspace", () => {
    renderApp(shellFixtures.member);
    expect(thankInSlack()).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(thankInSlack()).toHaveAttribute("target", "_blank");
    expect(within(main()).getAllByRole("link")).toEqual([thankInSlack()]);
    expect(within(main()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("puts the kudos left out of the base and the refill in one quiet line after the action", () => {
    renderApp(shellFixtures.member);
    const allowance = within(main()).getByText(/1 of 3 kudos left today/);
    expect(allowance).toHaveTextContent(/Refills at/);
    expect(allowance.querySelector("time")).toHaveAttribute("dateTime", "2026-10-14T00:00:00.000Z");
    expect(comesBefore(thankInSlack(), allowance)).toBe(true);
  });

  it("has Max state this week's thanks in words, without forecasting", () => {
    renderApp(shellFixtures.member);
    expect(within(main()).getByText("This week you gave 2 kudos and received 1.")).toBeInTheDocument();
  });

  it("follows with the counters, this week and in total, given and received, in tabular figures", () => {
    renderApp(shellFixtures.member);
    const counters = within(main()).getByRole("table", { name: "Your kudos" });
    const rows = within(counters).getAllByRole("row").map((row) => row.textContent);
    expect(rows).toEqual(["This weekIn total", "Given214", "Received19"]);
    expect(counters).toHaveClass("tabular-nums");
    expect(comesBefore(thankInSlack(), counters)).toBe(true);
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
    const card = within(main()).getByRole("region", { name: "Your profile card" });
    expect(within(card).getByText("Sam Example")).toBeInTheDocument();
    expect(within(card).getByText("SE")).toBeInTheDocument();
    expect(card).toHaveTextContent("The kudos you receive stay private.");
    expect(card.textContent).not.toMatch(/\d/);
  });
});

describe("WS19: the later features are plain locked cards", () => {
  it("shows each later feature locked, with its name and one sentence, and no level, progress or crate", () => {
    renderApp(shellFixtures.member);
    const locked = within(main()).getByRole("region", { name: "Still locked" });
    const cards = within(locked).getAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(lockedFeatures);
    for (const card of cards) {
      expect(within(card).getByText("Locked")).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/\d|level|ready|open|crate|xp/i);
    }
    expect(within(locked).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(locked).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows no level or XP anywhere until the facts carry them", () => {
    renderApp(shellFixtures.member);
    expect(main().textContent).not.toMatch(/\blevel\b|\bXP\b/i);
  });
});

describe("WS20: a quiet week", () => {
  it("has Max point back to thanking someone in Slack, with the one action and no reward", () => {
    renderApp(shellFixtures.memberWithAQuietWeek);
    expect(within(main()).getByText("No kudos yet this week, so thank someone in Slack for something they did.")).toBeInTheDocument();
    expect(within(main()).queryByText(/This week you gave/)).not.toBeInTheDocument();
    expect(within(main()).getAllByRole("link")).toEqual([thankInSlack()]);
    const hero = within(main()).getByRole("region", { name: "Thank someone for work you noticed" });
    expect(hero.textContent).not.toMatch(/reward|earn|coin|xp/i);
  });
});
