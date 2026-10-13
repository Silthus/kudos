import type { ReactNode } from "react";
import { HedgehogHandClasp } from "@posthog/brand/hoggies";
import { PageTitle } from "./PageTitle";

export function MaxSays({ title, tab, children, action }: { title: string; tab: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <HedgehogHandClasp size={112} title="" />
      <PageTitle tab={tab}>{title}</PageTitle>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </section>
  );
}
