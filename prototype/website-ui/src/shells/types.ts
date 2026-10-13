import type { ReactNode } from "react";
import type { ScreenId } from "../nav";

export type ShellProps = { current: ScreenId; dark: boolean; toggle: () => void; children: ReactNode };
