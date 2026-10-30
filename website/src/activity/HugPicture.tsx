import type { ReactNode } from "react";
import type { Person } from "../../../convex/activity/entries";
import type { LoopLesson, NextStep } from "../../../convex/website/activity";
import { SlackMessage, SlackReaction, SlackText } from "../album/SlackMessage";
import { KudosMessage } from "./KudosMessage";

type Drawing = { sender: Person; at: string; words: ReactNode };

const sampleTime = "10:42";

const timeOfDay = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function HugPicture({ step, kudos }: { step: NextStep; kudos: LoopLesson }) {
  const { sender, at, words } = drawingOf(step);
  return (
    <div className="al-hug-picture" aria-hidden="true">
      <SlackMessage sender={sender} at={at}>
        <SlackText>{words}</SlackText>
        <SlackReaction emoji={kudos.kudosEmoji} image={kudos.kudosEmojiImage ?? undefined} count={1} />
      </SlackMessage>
    </div>
  );
}

function drawingOf(step: NextStep): Drawing {
  switch (step.kind) {
    case "thanked":
      return { sender: step.giver, at: timeOfDay.format(step.at), words: <KudosMessage message={step.words} look="slack" /> };
    case "empty":
      return { sender: sampleTeammate("Alex Lee"), at: sampleTime, words: "Shipped the fix for the flaky deploy, should be green now." };
    case "quiet":
      return { sender: sampleTeammate("Juno Park"), at: sampleTime, words: "Docs for the new export flow are up, comments welcome." };
  }
}

function sampleTeammate(name: string): Person {
  return { name, face: { kind: "initials", initials: name.split(" ").map((word) => word.charAt(0)).join("") } };
}
