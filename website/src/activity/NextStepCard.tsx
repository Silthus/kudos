import type { ReactNode } from "react";
import type { LoopLesson, NextStep } from "../../../convex/website/activity";
import { firstNameOf } from "../album/teamPage";
import { NamedEmoji } from "../Emoji";
import { SlackLink } from "../SlackLink";

type StepShown = { title: string; why: ReactNode; button: string; href: string };

type NextStepCardProps = { step: NextStep; kudos: LoopLesson; slack: string };

export function NextStepCard({ step, kudos, slack }: NextStepCardProps) {
  const { title, why, button, href } = stepShownOf(step, <NamedEmoji name={kudos.kudosEmoji} image={kudos.kudosEmojiImage ?? undefined} />, slack);
  return (
    <section className="al-next-step" aria-label="Your next step">
      <div className="al-next-step-words">
        <span className="al-way-chip">Hug · a reaction</span>
        <h2 className="al-next-step-title">{title}</h2>
        <p className="al-next-step-why">{why}</p>
        <SlackLink chatUrl={href} variant="primary" size="lg">
          {button}
        </SlackLink>
      </div>
    </section>
  );
}

function stepShownOf(step: NextStep, emoji: ReactNode, slack: string): StepShown {
  switch (step.kind) {
    case "thanked": {
      const giver = firstNameOf(step.giver.name);
      return { title: `Hug ${giver}'s kudos back`, why: <>{`${giver} thanked you on ${weekdayOf(step.at)}. React with `}{emoji} to their message and they get a hug back.</>, button: `Open ${giver}'s message`, href: step.permalink };
    }
    case "empty":
      return { title: "Give your first hug", why: <>React with {emoji} to a teammate's message in Slack. That's a hug: they see it, and you both get XP.</>, button: "Open Slack", href: slack };
    case "quiet":
      return { title: "Hug a message today", why: <>React with {emoji} to a teammate's message.{step.firstHugPaysExtra && " Your first hug each day pays extra XP."}</>, button: "Open Slack", href: slack };
  }
}

function weekdayOf(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "long" });
}
