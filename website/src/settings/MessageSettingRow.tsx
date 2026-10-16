import { RadioGroup, RadioGroupItem, Switch } from "@posthog/quill";
import { useId } from "react";
import type { MessageKind, MessagePlace, MessageSetting, MessageSettingReply, ShellActions } from "../shell";
import { TextWithEmoji } from "../Emoji";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type MessageSettingRowProps = { setting: MessageSetting; setMessageSetting: ShellActions["setMessageSetting"] };

export const switchLook = [
  "data-[unchecked]:border-muted-foreground data-[unchecked]:[&_[data-slot=switch-thumb]]:bg-foreground",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
  "motion-reduce:transition-none motion-reduce:[&_*]:transition-none",
].join(" ");

export function MessageSettingRow({ setting, setMessageSetting }: MessageSettingRowProps) {
  const { kind, label, description, place, places } = setting;
  const titleId = useId();
  const { pending, settled, choose } = useSentChoice(place, async (asked: MessagePlace) => answerOf(await setMessageSetting(kind, asked)));
  const choosesAmongThree = places.length > 2;
  return (
    <div role="group" aria-labelledby={titleId} className={`flex gap-2 border-t py-3 first:border-t-0 first:pt-0 ${choosesAmongThree ? "flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-6" : "flex-row items-start justify-between gap-6"}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 id={titleId} className="text-sm font-semibold">
          {label}
        </h3>
        <p className="text-sm text-muted-foreground">
          <TextWithEmoji text={description} />
        </p>
        <StatusLine line={lineAfter(settled, `${label}: ${placeWords(kind, place)}.`)} />
      </div>
      {choosesAmongThree ? <PlaceChoice setting={setting} pending={pending} onChoose={choose} /> : <PlaceSwitch setting={setting} pending={pending} onChoose={choose} />}
    </div>
  );
}

type ControlProps = { setting: MessageSetting; pending: boolean; onChoose: (place: MessagePlace) => void };

function PlaceChoice({ setting: { kind, label, place, places }, pending, onChoose }: ControlProps) {
  return (
    <RadioGroup aria-label={`Where I send you ${label}`} value={place} disabled={pending} onValueChange={(chosen) => onChoose(chosen as MessagePlace)} className="flex w-auto shrink-0 flex-wrap gap-x-4 gap-y-1.5">
      {places.map((each) => (
        <label key={each} className="flex cursor-pointer items-center gap-1.5 text-sm">
          <RadioGroupItem value={each} className="border-muted-foreground" />
          {placeLabelOf(kind, each)}
        </label>
      ))}
    </RadioGroup>
  );
}

function PlaceSwitch({ setting: { label, place, places }, pending, onChoose }: ControlProps) {
  const [onPlace = "none"] = places;
  return <Switch size="sm" aria-label={label} className={`${switchLook} shrink-0`} checked={place !== "none"} disabled={pending} onCheckedChange={(on) => onChoose(on ? onPlace : "none")} />;
}

function answerOf(reply: MessageSettingReply): Answer {
  if (reply.kind === "set") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}

function placeLabelOf(kind: MessageKind, place: MessagePlace) {
  if (place === "none") return "None";
  if (place === "dm") return "As a DM";
  return kind === "celebrations" ? "In the announcement channel" : "In the channel";
}

function placeWords(kind: MessageKind, place: MessagePlace) {
  return place === "none" ? "off" : placeLabelOf(kind, place).toLowerCase().replace("dm", "DM");
}
