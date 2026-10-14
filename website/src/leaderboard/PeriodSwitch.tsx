import { IconCheck } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import type { Period } from "../shell";
import { periods } from "./periods";

export function PeriodSwitch({ period, onChoose }: { period: Period; onChoose: (period: Period) => void }) {
  return (
    <ToggleGroup variant="outline" size="sm" aria-label="Period" value={[period]} onValueChange={(chosen) => chosen[0] && onChoose(chosen[0] as Period)}>
      {periods.map((each) => {
        const selected = each.period === period;
        return (
          <ToggleGroupItem key={each.period} value={each.period} className={selected ? "border-primary bg-fill-selected" : undefined}>
            {selected && <IconCheck data-selected-mark aria-hidden="true" className="size-3.5" />}
            {each.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
