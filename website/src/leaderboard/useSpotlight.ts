import { useCallback, useEffect, useRef, useState } from "react";
import type { MySpotlight } from "../shell";
import type { SpotlightAsk, SpotlightDraw, SpotlightKudos } from "../spotlightRead";

export type Shown = { kind: "kudos"; kudos: SpotlightKudos } | { kind: "empty" } | { kind: "missed" } | { kind: "hidden" };

export type Notice = "That's the only one so far." | "Couldn't find another thank-you. Try again.";

export type SpotlightState = { shown: Shown | undefined; notice: Notice | undefined; drawing: boolean; pressed: boolean; attempts: number };

type Press = "mount" | "try-again" | "next";

type Answered = Exclude<MySpotlight, { kind: "skipped" }>;

type Attempt = { kind: "answered"; answer: Answered } | { kind: "stopped"; resume: string } | { kind: "failed" } | { kind: "abandoned" };

type Draw = SpotlightState & { resume: string | undefined };

type Mount = { live: boolean };

const skipsPerAttempt = 10;

const nothingDrawn: Draw = { shown: undefined, notice: undefined, drawing: true, pressed: false, attempts: 0, resume: undefined };

export function useSpotlight(draw: SpotlightDraw) {
  const [state, setState] = useState<Draw>(nothingDrawn);
  const latestDraw = useRef(draw);
  const mount = useRef<Mount>({ live: false });

  useEffect(() => {
    latestDraw.current = draw;
  }, [draw]);

  const run = useCallback(async (ask: SpotlightAsk, press: Press) => {
    const drawnFor = mount.current;
    setState((drawn) => ({ ...drawn, drawing: true, pressed: drawn.pressed || press !== "mount" }));
    const attempt = await attemptFrom(latestDraw.current, ask, drawnFor);
    if (attempt.kind !== "abandoned") setState((drawn) => settled(drawn, attempt, press));
  }, []);

  useEffect(() => {
    const thisMount = { live: true };
    mount.current = thisMount;
    void run(freshSeed(), "mount");
    return () => {
      thisMount.live = false;
    };
  }, [run]);

  const next = useCallback(() => {
    if (state.drawing || state.shown?.kind !== "kudos") return;
    void run({ after: state.resume ?? state.shown.kudos.after }, "next");
  }, [run, state]);

  const tryAgain = useCallback(() => {
    if (state.drawing) return;
    void run(state.resume === undefined ? freshSeed() : { after: state.resume }, "try-again");
  }, [run, state]);

  const { shown, notice, drawing, pressed, attempts } = state;
  return { shown, notice, drawing, pressed, attempts, next, tryAgain };
}

function freshSeed(): SpotlightAsk {
  return { seed: Math.random() };
}

async function attemptFrom(draw: SpotlightDraw, ask: SpotlightAsk, mount: Mount): Promise<Attempt> {
  try {
    let next = ask;
    for (let skips = 1; ; skips++) {
      const answer = await draw(next);
      if (!mount.live) return { kind: "abandoned" };
      if (answer.kind !== "skipped") return { kind: "answered", answer };
      if (skips === skipsPerAttempt) return { kind: "stopped", resume: answer.after };
      next = { after: answer.after };
    }
  } catch {
    return mount.live ? { kind: "failed" } : { kind: "abandoned" };
  }
}

function settled(drawn: Draw, attempt: Exclude<Attempt, { kind: "abandoned" }>, press: Press): Draw {
  const idle = { ...drawn, drawing: false, attempts: drawn.attempts + 1 };
  if (attempt.kind === "answered") return { ...idle, ...shownFor(drawn, attempt.answer), resume: undefined };
  const resume = attempt.kind === "stopped" ? attempt.resume : undefined;
  if (press === "next") return { ...idle, notice: "Couldn't find another thank-you. Try again.", resume };
  return { ...idle, shown: { kind: "missed" }, notice: undefined, resume };
}

function shownFor(drawn: Draw, answer: Answered): Pick<Draw, "shown" | "notice"> {
  if (answer.kind === "empty") return { shown: { kind: "empty" }, notice: undefined };
  if (answer.kind !== "kudos") return { shown: { kind: "hidden" }, notice: undefined };
  if (drawn.shown?.kind === "kudos" && drawn.shown.kudos.after === answer.after) return { shown: drawn.shown, notice: "That's the only one so far." };
  return { shown: { kind: "kudos", kudos: answer }, notice: undefined };
}
