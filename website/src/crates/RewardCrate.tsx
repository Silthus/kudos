import { aboutOf } from "../features";
import { CrateArt } from "./CrateArt";

export function RewardCrate({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <CrateArt phase="closed" width={56} Hog={aboutOf("quests").Hog} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Ready for you. Open it in Slack's App Home.</p>
      </div>
    </div>
  );
}

export function Done({ children }: { children?: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">
      <span aria-hidden="true">✓</span> Done{children !== undefined && ` · ${children}`}
    </p>
  );
}
