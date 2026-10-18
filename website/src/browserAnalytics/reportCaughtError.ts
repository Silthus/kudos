import { createContext } from "react";

export const ReportCaughtError = createContext<(error: unknown) => void>(() => undefined);
