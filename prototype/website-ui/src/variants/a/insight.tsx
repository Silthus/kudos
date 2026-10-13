// PROTOTYPE insight tile, Max-style sentence and RoundHog hero numbers shared by the Dashboard screens.
import type { ReactNode } from "react";
import { IconLock, IconSparkles } from "@posthog/icons";
import { Card } from "@posthog/quill";
import { useRoundHog } from "../../fonts";

export function Insight({ title, description, actions, children, className = "", hero = false }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; hero?: boolean }) {
  return (
    <Card size="sm" className={`flex flex-col gap-0 p-0 ${hero ? "ring-1 ring-primary/30" : ""} ${className}`}>
      <div className="flex items-start gap-3 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </Card>
  );
}

const tagTone = {
  default: "bg-muted text-foreground",
  info: "bg-info text-info-foreground",
  success: "bg-success text-success-foreground",
};

export function Tag({ variant = "default", className = "", children }: { variant?: keyof typeof tagTone; className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium [&_svg]:size-3 ${tagTone[variant]} ${className}`}>{children}</span>;
}

export function BigNumber({ value, unit, className = "" }: { value: ReactNode; unit?: ReactNode; className?: string }) {
  useRoundHog();
  return (
    <div className={`flex items-baseline gap-1.5 ${className}`}>
      <span className="text-4xl leading-none tabular-nums" style={{ fontFamily: "RoundHog" }}>
        {value}
      </span>
      {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
    </div>
  );
}

export function StatTile({ label, value, unit, hint, children, accent }: { label: string; value: ReactNode; unit?: ReactNode; hint?: ReactNode; children?: ReactNode; accent?: boolean }) {
  return (
    <Card size="sm" className={`flex flex-col gap-2 p-4 ${accent ? "border-primary/50 bg-primary/5" : ""}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <BigNumber value={value} unit={unit} />
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {children}
    </Card>
  );
}

export function MaxLine({ children, lines = [] }: { children?: ReactNode; lines?: Array<string | undefined> }) {
  const extra = lines.filter((l): l is string => Boolean(l));
  return (
    <div className="flex gap-3 rounded-md border border-dashed bg-muted/50 px-3 py-2.5 text-sm">
      <IconSparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-col gap-1">
        {children && (
          <p>
            <span className="font-semibold">Max</span> <span className="text-muted-foreground">·</span> {children}
          </p>
        )}
        {extra.map((line) => (
          <p key={line} className="flex items-center gap-1.5 text-muted-foreground">
            <IconLock className="size-3.5 shrink-0" />
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

export function Private({ children = "Only you" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <IconLock className="size-3" />
      {children}
    </span>
  );
}
