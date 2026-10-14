import { Card, CardContent } from "@posthog/quill";
import type { ReactNode } from "react";

export function SidePanel({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3 text-sm">
          <h2 id={id} className="hud-label flex items-center gap-1">
            {label}
          </h2>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
