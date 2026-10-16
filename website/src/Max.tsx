import type { ReactNode } from "react";
import { HedgehogTownCrier } from "./hoggies";
import { PageTitle } from "./PageTitle";

type SaysProps = { title: string; tab: string; children: ReactNode; action?: ReactNode };

export function MaxSays(props: SaysProps) {
  return <Says art={<HedgehogTownCrier size={112} />} {...props} />;
}

export function Says({ art, title, tab, children, action }: SaysProps & { art: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      {art}
      <PageTitle tab={tab}>{title}</PageTitle>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </section>
  );
}

export function MaxLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm">
      <HedgehogTownCrier size={40} className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}
