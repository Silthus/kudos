// PROTOTYPE, throwaway (Silthus/personal#171). Never merged.
// Round 2: one combined version per message. B's quest card is the core, A's warm copy opens it,
// and C's onboarding journey sits inside the card, crossing off what's done.
// Fitted to #170: one Monday DM from a hugs and a quests section, the quests section carries Stop and
// the link buttons (dm-link:<kind>:<destination>), Stop replaces the DM in place with a resume button,
// and a quest pays XP and an unidentified Hoggie (face down) for the member to identify on the website.
import type { Variant } from "./variants.mts";

type Block = Record<string, unknown>;

const site = "https://different-dog-467.convex.site";
const quests = `${site}/quests`;
const book = `${site}/book`;
const appHome = "slack://app?team=T0C3US298SH&id=A0C8RU12822&tab=home";
const me = `<@${process.env.PROTOTYPE_SLACK_USER ?? "U0000000000"}>`;
const kudos = ":hedgehug:";
const settingsTabFlag = "low use: Settings tab message settings";
const reward = "🎁 +20 XP and an unidentified Hoggie for your collection";
const numberWords = ["", "An", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

function waitingLine(count: number) {
  if (count === 1) return "An unidentified Hoggie for your collection is waiting for you.";
  return `${numberWords[count] ?? count} unidentified Hoggies for your collection are waiting for you.`;
}

function identifyNow(kind: DmKind, count: number, label = count === 1 ? "Identify it now" : "Identify them now") {
  return link(kind, "book", label, book, true);
}
const combined = "B card + A copy + C journey";

const md = (text: string) => ({ type: "mrkdwn", text });
const plain = (text: string) => ({ type: "plain_text", text, emoji: true });
const section = (text: string, accessory?: Block): Block => ({ type: "section", text: md(text), ...(accessory && { accessory }) });
const context = (...texts: string[]): Block => ({ type: "context", elements: texts.map(md) });
const divider: Block = { type: "divider" };
const actions = (...elements: Block[]): Block => ({ type: "actions", elements });

type DmKind = "welcome" | "monday";
const link = (kind: DmKind, destination: string, label: string, url: string, primary = false): Block => ({
  type: "button",
  text: plain(label),
  url,
  action_id: `dm-link:${kind}:${destination}`,
  ...(primary && { style: "primary" }),
});
const press = (label: string, actionId: string): Block => ({ type: "button", text: plain(label), action_id: actionId, value: "prototype-171" });

type Quest = { goal: string; how: string; needed?: { done: number; of: number; unit: string } };
const sayWhy: Quest = { goal: "Thank someone and say why", how: `Mention them, add ${kudos} and write a sentence about what they did.` };
const someoneNew: Quest = { goal: "Thank someone you haven't thanked before", how: "Someone from another team counts too." };
const twoDays: Quest = { goal: "Say why on 2 different days", how: "Two kudos that say why, on two different days.", needed: { done: 0, of: 2, unit: "days" } };
const onboarding = [sayWhy, someoneNew, twoDays];

type State = "done" | "next" | "open";
const marks: Record<State, string> = { done: "white_check_mark", next: "point_right", open: "white_circle" };

function journey(quests: Quest[], states: State[]): Block {
  return {
    type: "rich_text",
    elements: [
      {
        type: "rich_text_list",
        style: "bullet",
        indent: 0,
        elements: quests.map((quest, index) => {
          const state = states[index];
          const progress = quest.needed && state !== "done" ? [{ type: "text", text: `  ${quest.needed.done} of ${quest.needed.of} ${quest.needed.unit}`, style: { italic: true } }] : [];
          return {
            type: "rich_text_section",
            elements: [
              { type: "emoji", name: marks[state], ...(state === "next" && { skin_tone: 2 }) },
              { type: "text", text: ` ${quest.goal}`, style: { bold: state === "next", strike: state === "done" } },
              ...progress,
            ],
          };
        }),
      },
    ],
  };
}

function onboardingCard(done: number, upNext: Quest, kind: DmKind = "welcome"): Block[] {
  const states = onboarding.map((_, index): State => (index < done ? "done" : index === done ? "next" : "open"));
  return [
    section(`*Your onboarding journey* · ${done} of 3 done`),
    journey(onboarding, states),
    section(`*Up next: ${upNext.goal.toLowerCase()}.*\n${upNext.how}`, link(kind, "quests-how", "Show me how", quests)),
    context(reward),
  ];
}

const firstHug: Variant = {
  message: "Welcome on a first hug",
  key: "R2",
  name: combined,
  flags: [],
  fallback: "Nice, that was your first hug!",
  blocks: [
    section(`Hey ${me} :wave::skin-tone-2: Nice, that was your first hug!\n\nA ${kudos} reaction is a quick thanks, and it just gave you and Niko Pratt +1 XP. Want to really make someone's day? Thank them in a message and say why.\n\n${waitingLine(1)}`),
    divider,
    ...onboardingCard(0, sayWhy),
    actions(identifyNow("welcome", 1), link("welcome", "quests", "See your quests", quests)),
  ],
};

const firstKudos: Variant = {
  message: "Welcome on a first thoughtful kudos given",
  key: "R2",
  name: combined,
  flags: [],
  fallback: "You just completed the first step of your onboarding journey",
  blocks: [
    section(`Hey ${me} :wave::skin-tone-2: Your first kudos just landed with Juno Vale, and you said why. That's the one that counts! :tada:\n\nYou just completed the first step of your onboarding journey. ${waitingLine(2)}`),
    divider,
    ...onboardingCard(1, someoneNew),
    actions(identifyNow("welcome", 2), link("welcome", "quests", "See your quests", quests)),
  ],
};

const kudosReceived: Variant = {
  message: "Welcome on a thoughtful kudos received",
  key: "R2",
  name: combined,
  flags: [],
  fallback: "Juno Vale just thanked you with a kudos!",
  blocks: [
    section(`Hey ${me} :wave::skin-tone-2: Juno Vale just thanked you with a kudos!\n> _Thanks for jumping on the flaky deploy and pairing with me for an hour, you saved my afternoon_\n\nFeels good, right? :slightly_smiling_face: ${waitingLine(1)} Your first quest is to pass it on.`),
    divider,
    ...onboardingCard(0, sayWhy),
    actions(identifyNow("welcome", 1), link("welcome", "quests", "See your quests", quests)),
  ],
};

const catchUp: Variant = {
  message: "Catch-up welcome",
  key: "R2",
  name: combined,
  flags: [],
  fallback: "A hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now.",
  blocks: [
    section(`Hey ${me} :wave::skin-tone-2:\n\nA hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now :sweat_smile:\n\nHedgeHug is how we thank each other here. A ${kudos} reaction is a quick hug, and a kudos that says why is the big thanks.\n\n${waitingLine(1)}`),
    divider,
    ...onboardingCard(0, sayWhy),
    actions(identifyNow("welcome", 1), link("welcome", "quests", "See your quests", quests)),
  ],
};

const drawn: Quest[] = [
  { goal: "Thank someone and say why, 2 times", how: "", needed: { done: 0, of: 2, unit: "kudos" } },
  { goal: "Thank someone you haven't thanked in the last 30 days", how: "" },
  { goal: "Thank someone and say why on 2 different days", how: "", needed: { done: 0, of: 2, unit: "days" } },
];

const stopButton = press("Stop Monday quests", "prototype-171:stop-monday-quests");
const mondayButtonsWith = (waiting: number) => actions(identifyNow("monday", waiting, "Identify them on the website"), link("monday", "quests", "See your quests", quests), stopButton);

const mondayStandalone: Variant = {
  message: "Monday DM, quests section only (drawn quests)",
  key: "R2",
  name: combined,
  flags: [],
  fallback: "Happy Monday! Three quests for your week",
  blocks: [
    section(`Happy Monday :sun_with_face: Here are three quests for your week. Each one pays +20 XP and an unidentified Hoggie for your collection.\n\n${waitingLine(3)}`),
    journey(drawn, ["open", "open", "open"]),
    mondayButtonsWith(3),
  ],
};

const recapLines = [
  `${kudos} *Your week in hugs*`,
  `You reacted ${kudos} and gave 6 hugs (+6 XP).`,
  `Teammates reacted ${kudos} on your messages and gave you 9 hugs (+9 XP).`,
  "Your most hugged message: <https://slack.com|the deploy fix in #kudos-test>, 5 hugs.",
].join("\n");
const recapFooter = context(`<${appHome}|Change what I send you> in App Home's Settings tab.`);

const mondayInRecap: Variant = {
  message: "Monday DM, hugs section + quests section (onboarding)",
  key: "R2",
  name: combined,
  flags: [settingsTabFlag],
  fallback: "Your week in hugs, and your onboarding quests",
  blocks: [
    section(recapLines),
    divider,
    section(`*Your onboarding journey* · 1 of 3 done\nTwo quests left this week. Each one pays +20 XP and an unidentified Hoggie for your collection.\n\n${waitingLine(2)}`),
    journey(onboarding, ["done", "next", "open"]),
    mondayButtonsWith(2),
    recapFooter,
  ],
};

const stopped = (withRecap: boolean) =>
  `🔕 *Done, no more Monday quests from me.*${withRecap ? " Your hugs recap still comes on Mondays." : ""} Changed your mind? One press brings them back.`;
const resumeButton = actions(press("Turn Monday quests back on", "prototype-171:resume-monday-quests"));

const stopStandalone: Variant = {
  message: "After Stop: the quests-only DM, replaced in place",
  key: "R2",
  name: combined,
  flags: [],
  fallback: "Done, no more Monday quests from me.",
  blocks: [section(stopped(false)), resumeButton],
};

const stopInRecap: Variant = {
  message: "After Stop: the hugs + quests DM, replaced in place",
  key: "R2",
  name: combined,
  flags: [settingsTabFlag],
  fallback: "Your week in hugs. Monday quests are off.",
  blocks: [section(recapLines), divider, section(stopped(true)), resumeButton, recapFooter],
};

export const round2: Variant[][] = [[firstHug], [firstKudos], [kudosReceived], [catchUp], [mondayStandalone], [mondayInRecap], [stopStandalone], [stopInRecap]];
