export type Environment = "sandbox" | "production";

export type Capture = { token: string; environment: Environment; host: string };

const environments: readonly string[] = ["sandbox", "production"] satisfies Environment[];
const defaultHost = "https://us.i.posthog.com";

export function captureSettings(): Capture | null {
  const token = process.env.POSTHOG_PROJECT_TOKEN;
  const environment = process.env.KUDOS_ENVIRONMENT;
  if (!token || !isEnvironment(environment)) return null;
  return { token, environment, host: process.env.POSTHOG_HOST || defaultHost };
}

function isEnvironment(value: string | undefined): value is Environment {
  return value !== undefined && environments.includes(value);
}
