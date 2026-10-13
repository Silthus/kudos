import type { ReactNode } from "react";
import { HedgehogTownCrier } from "@posthog/brand/hoggies";
import { PageTitle } from "./PageTitle";

export function MaxSays({ title, tab, children, action }: { title: string; tab: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <HedgehogTownCrier size={112} title="" />
      <PageTitle tab={tab}>{title}</PageTitle>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </section>
  );
}

export function MaxLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm">
      <HedgehogTownCrier size={40} title="" className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}
