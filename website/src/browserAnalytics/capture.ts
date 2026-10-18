import type { PostHog } from "posthog-js/dist/module.full.no-external";
import type { BrowserAnalytics } from "../../../convex/website/browserAnalytics";
import type { Denial } from "../../../convex/website/memberQuery";
import { captureEveryPageview, pagePropertiesOf } from "./pageviews";

export type Capture = Extract<BrowserAnalytics, { kind: "capture" }>;

export type PostHogScript = { start: (capture: Capture, name: string) => PostHog };

export type PostHogLoader = () => Promise<PostHogScript>;

export type Capturer = Pick<PostHog, "capture">;

export type CapturingChange = (capturer: Capturer | null) => void;

type Running = { capture: string; posthog?: PostHog; stopPageviews?: () => void };

type Caught = { error: unknown; page: string };

const thisPage = crypto.randomUUID();

let instances = 0;

export function browserAnalytics(load: PostHogLoader, onCapturing: CapturingChange = () => undefined) {
  let running: Running | null = null;
  let answered = false;
  let held: Caught[] = [];

  const stop = () => {
    if (running === null) return;
    const { posthog, stopPageviews } = running;
    running = null;
    stopPageviews?.();
    if (posthog === undefined) return;
    onCapturing(null);
    silence(posthog);
  };

  const start = (capture: Capture) => {
    const starting: Running = { capture: keyOf(capture) };
    running = starting;
    void load().then(
      (script) => {
        if (running !== starting) return;
        const posthog = script.start(capture, `hedgehug-${thisPage}-${++instances}`);
        posthog.opt_in_capturing({ captureEventName: false });
        posthog.register({ environment: capture.environment });
        starting.posthog = posthog;
        starting.stopPageviews = captureEveryPageview(posthog);
        onCapturing(posthog);
        for (const caught of held.splice(0)) report(posthog, caught);
      },
      () => {
        if (running === starting) running = null;
      },
    );
  };

  return {
    follow(answer: BrowserAnalytics | Denial | Error | undefined) {
      if (answer === undefined) return;
      const capture = answer instanceof Error || answer.kind !== "capture" ? null : answer;
      if (capture !== null && running?.capture === keyOf(capture)) return;
      const firstAnswerIsCapture = !answered && capture !== null;
      if (!firstAnswerIsCapture) held = [];
      answered = true;
      stop();
      if (capture !== null) start(capture);
    },
    report(error: unknown) {
      const caught = { error, page: pagePropertiesOf(window.location).page };
      if (running?.posthog !== undefined) report(running.posthog, caught);
      else held.push(caught);
    },
    stop,
  };
}

function report(posthog: PostHog, { error, page }: Caught) {
  posthog.captureException(error, { page });
}

function silence(posthog: PostHog) {
  posthog.stopSessionRecording();
  posthog.stopExceptionAutocapture();
  posthog.opt_out_capturing();
  posthog.reset();
  posthog.opt_out_capturing();
}

function keyOf({ token, host, distinctId, environment }: Capture) {
  return JSON.stringify([token, host, distinctId, environment]);
}
