// Editorial building blocks for the Zine variant: RoundHog display type, one-colour bands, numbered sections.
import type { CSSProperties, ReactNode } from "react";
import { IconLock } from "@posthog/icons";
import { useRoundHog } from "../../fonts";

const displayFace: CSSProperties = { fontFamily: "RoundHog, Inter, system-ui, sans-serif", fontWeight: 700 };

type DisplayTag = "h1" | "h2" | "h3" | "p" | "span" | "blockquote";

export function Display({ as = "h2", className = "", children }: { as?: DisplayTag; className?: string; children: ReactNode }) {
  useRoundHog();
  const Tag = as;
  return (
    <Tag className={`leading-[0.92] tracking-[-0.02em] ${className}`} style={displayFace}>
      {children}
    </Tag>
  );
}

export type Ink = "tangerine" | "lemon" | "blue";

const inks: Record<Ink, CSSProperties> = {
  tangerine: { background: "#FF5C1C", color: "#141414" },
  lemon: { background: "#FFCE1C", color: "#141414" },
  blue: { background: "#106FB2", color: "#FFFFFF" },
};

export function Band({ ink, className = "", children }: { ink: Ink; className?: string; children: ReactNode }) {
  return (
    <section style={inks[ink]} className={`px-5 py-10 md:px-10 md:py-14 ${className}`}>
      {children}
    </section>
  );
}

export function Kicker({ className = "", children }: { className?: string; children: ReactNode }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${className}`}>{children}</p>;
}

export function SectionHead({ no, title, className = "" }: { no: string; title: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] ${className}`}>
      <span className="tabular-nums">No. {no}</span>
      <span className="h-px flex-1 bg-current opacity-30" />
      <span>{title}</span>
    </div>
  );
}

export function Figure({ value, caption, note, size = "md" }: { value: ReactNode; caption: ReactNode; note?: ReactNode; size?: "md" | "xl" }) {
  const valueClass = size === "xl" ? "text-[clamp(5.5rem,18vw,13rem)]" : "text-6xl md:text-7xl";
  return (
    <div className="flex flex-col gap-2 border-t-2 border-current pt-3">
      <Display as="p" className={`${valueClass} tabular-nums`}>
        {value}
      </Display>
      <p className="text-base font-semibold leading-snug md:text-lg">{caption}</p>
      {note && <p className="text-sm opacity-70">{note}</p>}
    </div>
  );
}

export function Private({ children = "Only you see this" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
      <IconLock className="size-3.5" />
      {children}
    </span>
  );
}

export function PullQuote({ text, by, when, featured = false }: { text: string; by: string; when: string; featured?: boolean }) {
  return (
    <figure className="flex flex-col gap-4">
      <Display as="blockquote" className={featured ? "text-3xl md:text-5xl" : "text-xl md:text-2xl"}>
        “{text}”
      </Display>
      <figcaption className="text-sm">
        <span className="font-semibold">{by}</span>
        <span className="opacity-70"> · {when}</span>
      </figcaption>
    </figure>
  );
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
