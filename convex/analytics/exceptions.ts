import { v, type Infer } from "convex/values";

export class ReportableError extends Error {
  override name = "ReportableError";
}

export const exceptionValidator = v.object({
  type: v.string(),
  value: v.string(),
  frames: v.array(v.object({ filename: v.string(), function: v.string(), lineno: v.number() })),
});

export type Exception = Infer<typeof exceptionValidator>;

export const reportedMarker = "[reported]";

const unexpectedError = "unexpected error";
const typeName = /^[A-Za-z_$][\w$]*$/;
const stackFrame = /^\s*at (?:(.+?) \()?(.+?):(\d+):\d+\)?$/;
const uncaughtError = /^Uncaught ([A-Za-z_$][\w$]*): (.*)$/;

export function exceptionOf(error: unknown): Exception {
  const type = typeOf(error);
  const value = error instanceof ReportableError ? error.message : unexpectedError;
  return { type, value, frames: error instanceof Error ? framesOf(error.stack ?? "") : [] };
}

export function exceptionOfJobError(error: string | undefined): Exception {
  const [, type = "Error", message = ""] = uncaughtError.exec(error?.split("\n")[0] ?? "") ?? [];
  return { type, value: type === ReportableError.name ? message : unexpectedError, frames: [] };
}

export function typeOf(error: unknown) {
  return error instanceof Error && typeName.test(error.name) ? error.name : "Error";
}

export function carriesReportedMarker(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes(reportedMarker);
}

export function postHogExceptionList({ type, value, frames }: Exception) {
  return [
    {
      type,
      value,
      mechanism: { handled: false, synthetic: false },
      stacktrace: { type: "raw", frames: frames.map((frame) => ({ platform: "custom", lang: "javascript", ...frame })) },
    },
  ];
}

function framesOf(stack: string): Exception["frames"] {
  return stack
    .split("\n")
    .flatMap((line) => {
      const [, name, filename, lineno] = stackFrame.exec(line) ?? [];
      if (filename === undefined) return [];
      return [{ filename: filename.replace(/^file:\/\//, "").replace(/\?.*$/, ""), function: functionName(name), lineno: Number(lineno) }];
    })
    .reverse();
}

function functionName(name: string | undefined) {
  return name?.replace(/^async /, "") || "<anonymous>";
}
