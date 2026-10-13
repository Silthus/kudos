export type Environment = "sandbox" | "production";

export type Capture = { token: string; environment: Environment; host: string };

const environments: readonly string[] = ["sandbox", "production"] satisfies Environment[];
const defaultHost = "https://us.i.posthog.com";

export function captureSettings(): Capture | null {
  const token = process.env.POSTHOG_PROJECT_TOKEN;
  const environment = environmentSetting();
  if (!token || environment === null) return null;
  return { token, environment, host: process.env.POSTHOG_HOST || defaultHost };
}

export function environmentSetting(): Environment | null {
  const environment = process.env.KUDOS_ENVIRONMENT;
  return isEnvironment(environment) ? environment : null;
}

export function nativeErrorReportingOn() {
  return process.env.POSTHOG_NATIVE_ERRORS === "on";
}

function isEnvironment(value: string | undefined): value is Environment {
  return value !== undefined && environments.includes(value);
}
