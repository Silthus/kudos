import { writeFileSync } from "node:fs";
import { click, hug, join, pause, required, slackRead, storedShapeOf, thanks, type Person, type Sent } from "./slack.mts";

const madeUp = required("KUDOS_MADE_UP");
const postChannel = required("KUDOS_PUBLIC_CHANNEL");
const cast = required("KUDOS_CAST");
const step = process.argv[2] ?? "join";
const madeUpKudosChannel = `C0PRFSLKKUD${cast}`;
const lastWednesday = Date.parse("2026-10-14T09:00:00Z");
const minuteMs = 60_000;

const person = (tag: string, name: string, admin = false): Person => ({ id: `U0PRFSLK${tag}${cast}`, name, workspace: madeUp, admin });

const admin = person("ADM", "Perrin Vale", true);
const giver = person("GIV", "Saoirse Pellow");
const recipients = [person("RC1", "Anouk Brightwater"), person("RC2", "Dmitri Hollis"), person("RC3", "Ines Quarry")];
const hugger = person("HUG", "Calla Wren");
const everyone = [admin, giver, ...recipients, hugger];

if (step === "join") {
  for (const one of everyone) console.log(`team_join ${one.id} (${one.name}) answered ${await join(one)}`);
} else if (step === "week") {
  const kudos: Sent = await thanks(giver, recipients, "thank you for carrying the migration weekend together and writing the handover notes everyone used on Monday", { channel: madeUpKudosChannel, at: lastWednesday });
  console.log(`thoughtful kudos ${giver.id} -> ${recipients.map(({ id }) => id).join(", ")} in ${madeUpKudosChannel} at ts ${kudos.ts}`);
  await pause(15_000);
  for (const one of [hugger, admin]) console.log(`hug by ${one.id} answered ${await hug(one, kudos)}`);
  console.log(JSON.stringify({ step, kudos: { channel: kudos.channel, ts: kudos.ts }, at: new Date(lastWednesday).toISOString(), plus: minuteMs }));
} else if (step === "post-on") {
  console.log(`setMondayPost on answered ${await click(admin, { type: "setMondayPost", on: true, timeZone: "Europe/Berlin" })}`);
} else if (step === "post-off") {
  console.log(`setMondayPost off answered ${await click(admin, { type: "setMondayPost", on: false })}`);
} else if (step === "read-post") {
  const out = process.env.KUDOS_OUT ?? "/tmp/slack-proof/monday-118.json";
  const history = await slackRead("conversations.history", { channel: postChannel, limit: "5" });
  const newest = (history.messages ?? []).filter(({ bot_id }) => bot_id !== undefined).slice(0, 1).map(storedShapeOf);
  const proof = { madeUpWorkspace: madeUp, postChannel, readAt: new Date().toISOString(), history: { ok: history.ok, error: history.error }, newest };
  writeFileSync(out, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof, null, 2));
} else {
  throw new Error(`unknown step ${step}: join, week, post-on, post-off or read-post`);
}
