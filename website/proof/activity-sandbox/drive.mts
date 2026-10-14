import { avery, blake, casey, drew, edit, eventsSent, give, join, pause, remove, type Sent } from "./slackEvents.mts";

const reasons = [
  "for pairing on the flaky deploy until it was green",
  "for the calm review that caught the off-by-one",
  "for writing the onboarding notes I wish I'd had",
  "for staying late to get the release notes right",
  "for the clearest bug report this quarter",
  "for unblocking the design review with a quick prototype",
  "for taking the on-call swap without a second thought",
  "for the patient walkthrough of the billing flow",
  "for turning a vague ticket into three crisp ones",
];

for (const person of [avery, blake, casey, drew]) await join(person);
await pause(4000);

const history: Sent[] = [];
const privately: Sent[] = [];
for (let daysAgo = 9; daysAgo >= 1; daysAgo -= 1) {
  const reason = reasons[daysAgo - 1];
  history.push(await give({ from: blake, to: [avery], words: reason, daysAgo, minutes: 300 }));
  if (daysAgo % 2 === 1) privately.push(await give({ from: casey, to: [avery], words: daysAgo === 3 ? "" : `quietly, ${reason}`, daysAgo, minutes: 240, channel: "private" }));
  history.push(await give({ from: avery, to: daysAgo % 3 === 0 ? [blake, casey, drew] : [blake, casey], words: daysAgo === 4 ? "" : `right back at you ${reason}`, daysAgo, minutes: 180 }));
}

await edit(history[0], "for pairing on the flaky deploy until it was green, and for the follow-up runbook");
await remove(history[2]);
await edit(privately[0], "quietly, for turning a vague ticket into three crisp ones, and for the handover doc");
await remove(privately[2]);

await give({ from: blake, to: [casey, drew], words: "for the live demo that made the roadmap click", daysAgo: 0, minutes: 30 });
await give({ from: drew, to: [avery], words: "for answering every question in the launch channel today", daysAgo: 0, minutes: 10 });

console.log(JSON.stringify({ eventsSent: eventsSent(), edited: [history[0].ts, privately[0].ts], deleted: [history[2].ts, privately[2].ts] }));
