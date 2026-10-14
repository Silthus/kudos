import { AppLink } from "../AppLink";

const tabs = [
  { tab: "character", label: "Character", href: "/" },
  { tab: "activity", label: "Activity", href: "/activity" },
] as const;

type MemberTab = (typeof tabs)[number]["tab"];

const tabLook = "relative inline-flex min-h-9 items-center px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-md";

const currentLook = "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary";

const idleLook = "text-muted-foreground hover:text-foreground";

export function MemberTabs({ current }: { current: MemberTab }) {
  return (
    <nav aria-label="Your page" className="border-b">
      <ul className="flex gap-1">
        {tabs.map(({ tab, label, href }) => (
          <li key={tab}>
            <AppLink href={href} aria-current={tab === current ? "page" : undefined} className={`${tabLook} ${tab === current ? currentLook : idleLook}`}>
              {label}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
