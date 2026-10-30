import type { ReactNode } from "react";
import type { BoardsNextStep } from "../../../convex/website/leaderboard";
import { firstNameOf } from "../album/teamPage";
import { SlackLink } from "../SlackLink";

type Way = "hug" | "kudos";

type StepShown = { way: Way; title: string; why: ReactNode; button: string; href: string };

type NextStepProps = { step: BoardsNextStep; emoji: ReactNode; slack: string; team: string | null };

export function NextStep({ step, emoji, slack, team }: NextStepProps) {
  const { way, title, why, button, href } = stepShownOf(step, emoji, slack, team);
  return (
    <section className="lb-next" aria-label="Your next step">
      <span className="al-way-chip">{way === "hug" ? "Hug · a reaction" : "Kudos · a message"}</span>
      <h2 className="lb-next-title ph-no-capture">{title}</h2>
      <p className="lb-next-why ph-no-capture">{why}</p>
      <SlackLink chatUrl={href} variant="primary" size="default">
        {button}
      </SlackLink>
    </section>
  );
}

function stepShownOf(step: BoardsNextStep, emoji: ReactNode, slack: string, team: string | null): StepShown {
  switch (step.kind) {
    case "lively": {
      const teammate = firstNameOf(step.teammate.name);
      return { way: "kudos", title: `Give ${teammate} a kudos`, why: <>Write {emoji} @{teammate} and what they did.{kudosGains(teammate, step)}</>, button: "Open Slack", href: slack };
    }
    case "quiet": {
      const giver = firstNameOf(step.giver.name);
      return { way: "hug", title: `Hug ${giver}'s kudos back`, why: <>{`${giver} thanked you on ${weekdayOf(step.at)}. React with `}{emoji} to their message and they get a hug back.</>, button: `Open ${giver}'s message`, href: step.permalink };
    }
    case "empty":
      return { way: "hug", title: "Give the first hug of the week", why: <>React with {emoji} to a teammate's message.{firstHugGains(step.firstHugPaysExtra, team)}</>, button: "Open Slack", href: slack };
  }
}

function kudosGains(teammate: string, { collectsHype, epicHoggiesByKudos }: Extract<BoardsNextStep, { kind: "lively" }>): string {
  if (collectsHype && epicHoggiesByKudos) return ` You collect ${teammate}'s hype emoji, and kudos are the only way to find epic hoggies.`;
  if (collectsHype) return ` You collect ${teammate}'s hype emoji.`;
  if (epicHoggiesByKudos) return " Kudos are the only way to find epic hoggies.";
  return "";
}

function firstHugGains(paysExtra: boolean, team: string | null): string {
  if (paysExtra && team !== null) return ` The first hug each day pays extra XP, and the first one this week puts you and ${team} on the board.`;
  if (paysExtra) return " The first hug each day pays extra XP.";
  if (team !== null) return ` The first one this week puts you and ${team} on the board.`;
  return "";
}

function weekdayOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "long" });
}
