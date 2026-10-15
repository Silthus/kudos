import { useState } from "react";

export type Answer = "landed" | "refused" | "denied" | "unreachable";

type Sent<Value> = { asked: Value; answer: Answer };

export function useSentChoice<Value>(shown: Value, send: (value: Value) => Promise<Answer>) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<Sent<Value>>();
  const [readShown, setReadShown] = useState(shown);

  if (readShown !== shown) {
    setReadShown(shown);
    if (sent !== undefined && isSuperseded(sent, readShown, shown)) setSent(undefined);
  }

  const choose = async (value: Value) => {
    if (pending) return;
    setPending(true);
    setSent(undefined);
    try {
      setSent({ asked: value, answer: await send(value) });
    } catch {
      setSent({ asked: value, answer: "unreachable" });
    } finally {
      setPending(false);
    }
  };

  return { pending, settled: sent === undefined ? undefined : settledAnswerOf(sent, shown), choose };
}

function isSuperseded<Value>({ asked, answer }: Sent<Value>, before: Value, now: Value) {
  return answer === "landed" ? before === asked : now === asked;
}

function settledAnswerOf<Value>({ asked, answer }: Sent<Value>, shown: Value): Answer | undefined {
  const readMovedToTheAsk = asked === shown;
  if (answer === "landed") return readMovedToTheAsk ? "landed" : undefined;
  return readMovedToTheAsk ? undefined : answer;
}

export function lineAfter(settled: Answer | undefined, landed: string): string {
  if (settled === "landed") return landed;
  if (settled === "refused") return "That couldn't be changed.";
  if (settled === "unreachable") return "Couldn't reach HedgeHug. Try again.";
  return "";
}

