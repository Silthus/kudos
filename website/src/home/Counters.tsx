import { Card, CardContent } from "@posthog/quill";
import type { MemberProfile } from "../shell";

export function Counters({ member: { thisWeek, lifetime } }: { member: MemberProfile }) {
  return (
    <Card size="sm">
      <CardContent>
        <table className="w-full text-sm tabular-nums">
          <caption className="hud-label pb-2 text-left">Your kudos</caption>
          <thead>
            <tr className="text-muted-foreground">
              <td />
              <th scope="col" className="pb-1 text-right font-medium">This week</th>
              <th scope="col" className="pb-1 text-right font-medium">In total</th>
            </tr>
          </thead>
          <tbody>
            <CounterRow label="Given" thisWeek={thisWeek.given} lifetime={lifetime.given} />
            <CounterRow label="Received" thisWeek={thisWeek.received} lifetime={lifetime.received} />
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CounterRow({ label, thisWeek, lifetime }: { label: string; thisWeek: number; lifetime: number }) {
  return (
    <tr className="border-t">
      <th scope="row" className="py-2 text-left font-medium">{label}</th>
      <td className="py-2 text-right">{thisWeek}</td>
      <td className="py-2 text-right">{lifetime}</td>
    </tr>
  );
}
