import type { ReactNode } from "react";
import { HedgehogTownCrier } from "@posthog/brand/hoggies";
import type { Hoggie } from "./features";
import { PageTitle } from "./PageTitle";

type HogSaysProps = { Hog: Hoggie; title: string; tab: string; children: ReactNode; action?: ReactNode };

export function HogSays({ Hog, title, tab, children, action }: HogSaysProps) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <Hog size={112} title="" />
      <PageTitle tab={tab}>{title}</PageTitle>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </section>
  );
}

export function MaxSays(props: Omit<HogSaysProps, "Hog">) {
  return <HogSays Hog={HedgehogTownCrier} {...props} />;
}

export function MaxLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm">
      <HedgehogTownCrier size={40} title="" className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}
