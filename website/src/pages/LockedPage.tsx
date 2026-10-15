import { IconLock } from "@posthog/icons";
import { buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { hogOf, sentenceOf } from "../features";
import { PageTitle } from "../PageTitle";
import type { Feature, MemberProfile } from "../shell";

type LockedPageProps = { feature: Feature; name: string; level: number; member: MemberProfile };

export function LockedPage({ feature, name, level, member }: LockedPageProps) {
  const Hog = hogOf(feature);
  return (
    <section className="hud-panel mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-lg border bg-card px-4 py-10 text-center text-card-foreground md:py-14">
      <span className="relative inline-flex">
        <span data-silhouette className="hog-silhouette">
          <Hog size={128} title="" className="h-auto w-28 md:w-32" />
        </span>
        <span data-padlock className="absolute -bottom-1 -right-2 flex size-9 items-center justify-center rounded-full bg-foreground text-background ring-4 ring-card">
          <IconLock aria-hidden="true" className="size-4" />
        </span>
      </span>
      <PageTitle tab={name} size="display">
        <span className="hud-label mb-3 block">{name}</span>
        <span className="block">{`Unlocks at level ${level}`}</span>
      </PageTitle>
      <p className="max-w-md text-balance text-base">{sentenceOf(feature, member)}</p>
      <AppLink href="/" className={`${buttonVariants({ variant: "primary" })} mt-2`}>
        Back to your profile
      </AppLink>
    </section>
  );
}
