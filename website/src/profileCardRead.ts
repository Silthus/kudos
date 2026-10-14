import type { MyProfileCard } from "./shell";

export type ProfileCardShown = MyProfileCard | { kind: "broken" };

export type ProfileCardRead = (asking: boolean) => ProfileCardShown | undefined;
