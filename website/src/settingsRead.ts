import type { MySettingsAnswer } from "./shell";

export type SettingsShown = MySettingsAnswer | { kind: "connecting" } | { kind: "broken" };

export type SettingsRead = (asking: boolean) => SettingsShown | undefined;
