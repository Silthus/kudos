// PROTOTYPE, throwaway (Silthus/personal#171). Never merged.
// Round 1: three Block Kit variants of each new DM, posted to the sandbox's Slack.
// A = Chat note (one section, one button), B = Quest card (header, card, progress),
// C = Journey checklist (every onboarding quest with its state).

type Block = Record<string, unknown>;
export type Variant = { message: string; key: "A" | "B" | "C"; name: string; flags: string[]; fallback: string; blocks: Block[] };

const site = "https://different-dog-467.convex.site";
const quests = `${site}/quests`;
const book = `${site}/book`;
const appHome = "slack://app?team=T0C3US298SH&id=A0C8RU12822&tab=home";
const me = `<@${process.env.PROTOTYPE_SLACK_USER ?? "U0000000000"}>`;
const kudos = ":hedgehug:";
const settingsTabFlag = "low use: Settings tab message settings";
const reward = "+20 XP and a random hoggie";

const md = (text: string) => ({ type: "mrkdwn", text });
const plain = (text: string) => ({ type: "plain_text", text, emoji: true });
const section = (text: string, accessory?: Block): Block => ({ type: "section", text: md(text), ...(accessory && { accessory }) });
const context = (...texts: string[]): Block => ({ type: "context", elements: texts.map(md) });
const header = (text: string): Block => ({ type: "header", text: plain(text) });
const divider: Block = { type: "divider" };
const link = (label: string, url: string, primary = false): Block => ({ type: "button", text: plain(label), url, action_id: `prototype-171:${label}`, ...(primary && { style: "primary" }) });
const press = (label: string): Block => ({ type: "button", text: plain(label), action_id: `prototype-171:${label}`, value: "prototype-171" });
const actions = (...elements: Block[]): Block => ({ type: "actions", elements });
const stopMenu: Block = {
  type: "overflow",
  action_id: "prototype-171:overflow",
  options: [
    { text: plain("See all my quests"), value: "see", url: quests },
    { text: plain("Stop Monday quests"), value: "stop" },
  ],
};

type Step = { goal: string; how: string };
const sayWhy: Step = { goal: "Thank someone and say why", how: `Mention them, add ${kudos} and write a sentence about what they did.` };
const someoneNew: Step = { goal: "Thank someone you haven't thanked before", how: "A teammate from another team counts too." };
const twoDays: Step = { goal: "Say why on 2 different days", how: "Two kudos that say why, on two days this week." };
const onboarding = [sayWhy, someoneNew, twoDays];

type State = "done" | "next" | "later";

function checklist(states: State[]): Block {
  const marks: Record<State, string> = { done: "white_check_mark", next: "point_right", later: "white_circle" };
  return {
    type: "rich_text",
    elements: [
      {
        type: "rich_text_list",
        style: "bullet",
        indent: 0,
        elements: onboarding.map((step, index) => ({
          type: "rich_text_section",
          elements: [
            { type: "emoji", name: marks[states[index]], ...(states[index] === "next" && { skin_tone: 2 }) },
            { type: "text", text: ` ${step.goal}`, style: { bold: states[index] === "next", strike: states[index] === "done" } },
          ],
        })),
      },
    ],
  };
}

function progressDots(done: number) {
  return `${"🟢 ".repeat(done)}${"⚪ ".repeat(3 - done)}*Onboarding ${done} of 3*`;
}

function questCard(step: Step, index: number, done: number): Block[] {
  return [
    section(`*Onboarding quest ${index} of 3*\n*${step.goal}*\n${step.how}`, link("Show me how", quests)),
    context(`🎁 ${reward}`, progressDots(done)),
  ];
}

function chatQuest(step: Step) {
  return `:point_right::skin-tone-2: *${step.goal}.* ${step.how} ${reward}.`;
}

const firstHug: Variant[] = [
  {
    message: "Welcome on a first hug",
    key: "A",
    name: "Chat note",
    flags: [],
    fallback: "Nice, that was your first hug!",
    blocks: [
      section(
        [
          `Hey ${me} :wave::skin-tone-2: Nice, that was your first hug!`,
          `A ${kudos} reaction is a quick thanks, and it just gave you and Niko Pratt +1 XP.`,
          "Want to really make someone's day? Thank them in a message and say why. That's your first onboarding quest:",
          chatQuest(sayWhy),
        ].join("\n\n"),
      ),
      actions(link("Start your onboarding", quests, true)),
      context("Your quests, hoggies and XP live on the HedgeHug website."),
    ],
  },
  {
    message: "Welcome on a first hug",
    key: "B",
    name: "Quest card",
    flags: [],
    fallback: "Welcome to HedgeHug: your first onboarding quest",
    blocks: [
      header("🦔 Welcome to HedgeHug!"),
      section(`That ${kudos} on Niko Pratt's message was your first hug: +1 XP for you both.\nHugs are the quick thanks. The big one is a kudos that says why.`),
      divider,
      ...questCard(sayWhy, 1, 0),
      actions(link("See your quests", quests, true), link("Open App Home", appHome)),
    ],
  },
  {
    message: "Welcome on a first hug",
    key: "C",
    name: "Journey checklist",
    flags: [],
    fallback: "You just gave your first hug. Here's your onboarding journey.",
    blocks: [
      section(`*You just gave your first hug* ${kudos}\nHere's your onboarding journey. Three quests, and each one pays ${reward}:`),
      checklist(["next", "later", "later"]),
      section(`*Up next:* thank someone and say why. ${sayWhy.how}`, link("Open your journey", quests, true)),
    ],
  },
];

const firstKudos: Variant[] = [
  {
    message: "Welcome on a first thoughtful kudos given",
    key: "A",
    name: "Chat note",
    flags: [],
    fallback: "You just completed the first step of your onboarding journey",
    blocks: [
      section(
        [
          `Hey ${me} :wave::skin-tone-2: Your first kudos just landed with Juno Vale, and you said why. That's the one that counts!`,
          `:white_check_mark: You just completed the first step of your onboarding journey. ${reward} are waiting for you on the website.`,
          "Your next quest:",
          chatQuest(someoneNew),
        ].join("\n\n"),
      ),
      actions(link("Turn your new hoggie", book, true)),
    ],
  },
  {
    message: "Welcome on a first thoughtful kudos given",
    key: "B",
    name: "Quest card",
    flags: [],
    fallback: "First step done! Your next onboarding quest",
    blocks: [
      header("🎉 First step done!"),
      section(`Your kudos to Juno Vale said why. You just completed the first step of your onboarding journey, and a hoggie is waiting for you face down.`),
      context(progressDots(1)),
      divider,
      ...questCard(someoneNew, 2, 1).slice(0, 1),
      context(`🎁 ${reward}`),
      actions(link("Turn your new hoggie", book, true), link("See your quests", quests)),
    ],
  },
  {
    message: "Welcome on a first thoughtful kudos given",
    key: "C",
    name: "Journey checklist",
    flags: [],
    fallback: "You just completed the first step of your onboarding journey",
    blocks: [
      section(`*Your kudos to Juno Vale said why* :tada:\nYou just completed the first step of your onboarding journey:`),
      checklist(["done", "next", "later"]),
      section(`*Your reward:* a hoggie, face down on the website. Turn it to see who you got.`, link("Turn your hoggie", book, true)),
      context(`*Up next:* ${someoneNew.goal.toLowerCase()}. ${reward}.`),
    ],
  },
];

const kudosReceived: Variant[] = [
  {
    message: "Welcome on a thoughtful kudos received",
    key: "A",
    name: "Chat note",
    flags: [],
    fallback: "Juno Vale just thanked you with a kudos!",
    blocks: [
      section(
        [
          `Hey ${me} :wave::skin-tone-2: Juno Vale just thanked you with a kudos!`,
          "> _Thanks for jumping on the flaky deploy and pairing with me for an hour, you saved my afternoon_",
          "Feels good, right? :slightly_smiling_face: That earned you XP, and your first onboarding quest is to pass it on:",
          chatQuest(sayWhy),
        ].join("\n\n"),
      ),
      actions(link("See your kudos", book, true)),
    ],
  },
  {
    message: "Welcome on a thoughtful kudos received",
    key: "B",
    name: "Quest card",
    flags: [],
    fallback: "Juno Vale thanked you",
    blocks: [
      header("💌 Juno Vale thanked you"),
      section("> _Thanks for jumping on the flaky deploy and pairing with me for an hour, you saved my afternoon_"),
      context("Welcome to HedgeHug, where we thank each other for the help that usually goes unnoticed."),
      divider,
      ...questCard({ ...sayWhy, goal: "Pass it on: thank someone and say why" }, 1, 0),
      actions(link("See your kudos", book, true), link("See your quests", quests)),
    ],
  },
  {
    message: "Welcome on a thoughtful kudos received",
    key: "C",
    name: "Journey checklist",
    flags: [],
    fallback: "Juno Vale thanked you. Here's your onboarding journey.",
    blocks: [
      section(`*Juno Vale thanked you* ${kudos}\n> _Thanks for jumping on the flaky deploy and pairing with me for an hour, you saved my afternoon_`),
      section(`Now it's your turn. Here's your onboarding journey, each quest pays ${reward}:`),
      checklist(["next", "later", "later"]),
      actions(link("Open your journey", quests, true), link("See your kudos", book)),
    ],
  },
];

const pipe = "A hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now.";

const catchUp: Variant[] = [
  {
    message: "Catch-up welcome",
    key: "A",
    name: "Chat note",
    flags: [],
    fallback: pipe,
    blocks: [
      section(
        [
          `Hey ${me} :wave::skin-tone-2:`,
          `${pipe} :sweat_smile:`,
          `HedgeHug is how we thank each other here. A ${kudos} reaction is a quick hug, and a kudos that says why is the big thanks.`,
          "Your first onboarding quest:",
          chatQuest(sayWhy),
        ].join("\n\n"),
      ),
      actions(link("Start your onboarding", quests, true)),
    ],
  },
  {
    message: "Catch-up welcome",
    key: "B",
    name: "Quest card",
    flags: [],
    fallback: pipe,
    blocks: [
      header("🔧 This welcome got stuck in the pipe"),
      section(`${pipe}\nWelcome to HedgeHug, where we thank each other for the help that usually goes unnoticed.`),
      divider,
      ...questCard(sayWhy, 1, 0),
      actions(link("See your quests", quests, true), link("Open App Home", appHome)),
    ],
  },
  {
    message: "Catch-up welcome",
    key: "C",
    name: "Journey checklist",
    flags: [],
    fallback: pipe,
    blocks: [
      context(`🦔🔧 _plop_ ${pipe}`),
      section(`*Welcome to HedgeHug!* Here's your onboarding journey. Three quests, each one pays ${reward}:`),
      checklist(["next", "later", "later"]),
      section(`*Start here:* thank someone and say why. ${sayWhy.how}`, link("Open your journey", quests, true)),
    ],
  },
];

const drawn = ["Thank someone and say why, 2 times", "Thank someone you haven't thanked in the last 30 days", "Thank someone and say why on 2 different days"];

const mondayStandalone: Variant[] = [
  {
    message: "Monday DM, standalone, drawn quests",
    key: "A",
    name: "One line",
    flags: [],
    fallback: "Your quests this week",
    blocks: [section(`🗓️ *Your quests this week:* ${drawn.map((goal) => goal.toLowerCase()).join(" · ")}. <${quests}|See them>`, press("Stop Monday quests"))],
  },
  {
    message: "Monday DM, standalone, drawn quests",
    key: "B",
    name: "Short list",
    flags: [],
    fallback: "Three quests for your week",
    blocks: [
      section("Happy Monday :sun_with_face: Three quests for your week, each one pays " + `${reward}:`),
      {
        type: "rich_text",
        elements: [{ type: "rich_text_list", style: "bullet", indent: 0, elements: drawn.map((goal) => ({ type: "rich_text_section", elements: [{ type: "text", text: goal }] })) }],
      },
      actions(link("See your quests", quests, true), press("Stop Monday quests")),
    ],
  },
  {
    message: "Monday DM, standalone, drawn quests",
    key: "C",
    name: "Spotlight",
    flags: [],
    fallback: "This week's quest",
    blocks: [
      section(`*This week's quest* 🗓️\n${drawn[1]}. ${reward}.`, stopMenu),
      context(`+2 more: ${drawn[0].toLowerCase()} · ${drawn[2].toLowerCase()}. <${quests}|See all three>`),
    ],
  },
];

const recapLines = [
  `${kudos} *Your week in hugs*`,
  `You reacted ${kudos} and gave 6 hugs (+6 XP).`,
  `Teammates reacted ${kudos} on your messages and gave you 9 hugs (+9 XP).`,
  "Your most hugged message: <https://slack.com|the deploy fix in #kudos-test>, 5 hugs.",
];
const recapFooter = context(`<${appHome}|Change what I send you> in App Home's Settings tab.`);

const mondayInRecap: Variant[] = [
  {
    message: "Monday DM, inside the hugs recap, onboarding quests",
    key: "A",
    name: "One line",
    flags: [settingsTabFlag],
    fallback: "Your week in hugs, and this week's quest",
    blocks: [
      section([...recapLines, "", `🗓️ *This week:* your next onboarding quest is to ${someoneNew.goal.toLowerCase()}. <${quests}|See your quests>`].join("\n"), press("Stop Monday quests")),
      recapFooter,
    ],
  },
  {
    message: "Monday DM, inside the hugs recap, onboarding quests",
    key: "B",
    name: "Short list",
    flags: [settingsTabFlag],
    fallback: "Your week in hugs, and your onboarding quests",
    blocks: [
      section(recapLines.join("\n")),
      divider,
      section(`*Your onboarding quests this week*, each one pays ${reward}:`),
      checklist(["done", "next", "later"]),
      actions(link("See your quests", quests, true), press("Stop Monday quests")),
      recapFooter,
    ],
  },
  {
    message: "Monday DM, inside the hugs recap, onboarding quests",
    key: "C",
    name: "Spotlight",
    flags: [settingsTabFlag],
    fallback: "Your week in hugs, and this week's quest",
    blocks: [
      section(recapLines.join("\n")),
      section(`*This week's quest* 🗓️\n${someoneNew.goal}. ${reward}.`, stopMenu),
      context(`Onboarding 1 of 3 done · then ${twoDays.goal.toLowerCase()}`),
      recapFooter,
    ],
  },
];

const turnBackOn = `<${appHome}|Turn them back on> under *Quests and Journey* in App Home's Settings tab.`;

const stopReply: Variant[] = [
  {
    message: "Stop Monday quests: the reply",
    key: "A",
    name: "New message",
    flags: [settingsTabFlag],
    fallback: "No more Monday quests",
    blocks: [section(`Done :white_check_mark: No more Monday quests from me.\n\nYour hugs recap still comes on Mondays.\n\nChanged your mind? ${turnBackOn}`)],
  },
  {
    message: "Stop Monday quests: the reply",
    key: "B",
    name: "Edited in place",
    flags: [settingsTabFlag],
    fallback: "Your week in hugs. Monday quests are off.",
    blocks: [section(recapLines.join("\n")), context(`🔕 Monday quests are off. ${turnBackOn}`), recapFooter],
  },
  {
    message: "Stop Monday quests: the reply",
    key: "C",
    name: "With undo",
    flags: [settingsTabFlag],
    fallback: "Monday quests are off",
    blocks: [section("🔕 *Monday quests are off.* Your hugs recap stays.", press("Undo")), context(`You can also change it under *Quests and Journey* in App Home's Settings tab.`)],
  },
];

export const messages: Variant[][] = [firstHug, firstKudos, kudosReceived, catchUp, mondayStandalone, mondayInRecap, stopReply];

export function labelOf({ message, key, name, flags }: Variant) {
  return `🧪 *Prototype #171* · ${message} · *${key} (${name})*${flags.length === 0 ? "" : ` · ${flags.join(" · ")}`}`;
}

export function labelled(variant: Variant) {
  return [{ type: "context", elements: [{ type: "mrkdwn", text: labelOf(variant) }] }, ...variant.blocks];
}

