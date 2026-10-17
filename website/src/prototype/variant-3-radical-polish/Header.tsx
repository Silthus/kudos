// PROTOTYPE (#625): the Radical polish header: primary nav, a visible More row, coins and the level chip. Never merge to main.
import { IconBook, IconCart, IconGear, IconHome, IconListCheck, IconPeople, IconPulse, IconStar, IconFlag } from "@posthog/icons";
import type { ComponentType, ReactNode } from "react";
import { AppLink } from "../../AppLink";
import { useCountUp } from "../../countUp";
import { HedgehogHeart } from "../../hoggies";
import { MemberFace } from "../art";
import type { World } from "../world";
import type { Section } from "./address";
import { Coin, LevelBar } from "./motion";
import { useStage } from "./stage";

type NavItem = { section: Section; href: string; label: string; Icon: ComponentType<{ className?: string }>; counter?: number };

export function Header({ world, section }: { world: World; section: Section }) {
  const firstTeam = world.teams.find(({ mine }) => mine)?.team ?? world.teams[0]?.team ?? "";
  const rewardsWaiting = world.quests.filter(({ state }) => state === "finished").length;
  const primary: NavItem[] = [
    { section: "home", href: "/", label: "Home", Icon: IconHome },
    { section: "collection", href: "/book#hoggies/common", label: "Collection", Icon: IconBook },
    { section: "teams", href: `/book#teams/${firstTeam}`, label: "Teams", Icon: IconPeople },
    { section: "quests", href: "/quests", label: "Quests", Icon: IconListCheck, counter: rewardsWaiting },
  ];
  const more: NavItem[] = [
    { section: "store", href: "/book#store", label: "Store", Icon: IconCart, counter: world.packs.length },
    { section: "earned", href: "/book/earned", label: "Achievements", Icon: IconStar },
    { section: "activity", href: "/activity", label: "Activity", Icon: IconPulse },
    { section: "leaderboard", href: "/leaderboard", label: "Leaderboard", Icon: IconFlag },
  ];
  return (
    <header className="v3-header">
      <div className="v3-header-in">
        <AppLink href="/" className="v3-logo" aria-label="HedgeHug, home">
          <HedgehogHeart size={30} />
          <span>HedgeHug</span>
        </AppLink>
        <nav aria-label="Main" className="v3-nav v3-nav-primary">
          {primary.map((item) => (
            <NavLink key={item.section} item={item} current={section} />
          ))}
        </nav>
        <nav aria-label="More" className="v3-nav v3-nav-more">
          {more.map((item) => (
            <NavLink key={item.section} item={item} current={section} quiet />
          ))}
          <span className="v3-nav-rule" aria-hidden="true" />
          <NavLink item={{ section: "settings", href: "/settings", label: "Settings", Icon: IconGear }} current={section} quiet />
        </nav>
        <Status world={world} />
      </div>
    </header>
  );
}

function NavLink({ item: { section, href, label, Icon, counter }, current, quiet = false }: { item: NavItem; current: Section; quiet?: boolean }) {
  return (
    <AppLink href={href} className={quiet ? "v3-link v3-link-quiet" : "v3-link"} aria-current={section === current ? "page" : undefined}>
      <Icon className="v3-link-icon" />
      <span>{label}</span>
      {counter !== undefined && counter > 0 && <Counter>{counter}</Counter>}
    </AppLink>
  );
}

function Counter({ children }: { children: ReactNode }) {
  return <span className="v3-counter">{children}</span>;
}

function Status({ world }: { world: World }) {
  const { shownLevel, shownCoins } = useStage();
  const coins = useCountUp(shownCoins);
  return (
    <div className="v3-status">
      <AppLink href="/book#store" className="v3-chip" aria-label={`${shownCoins} coins, open the store`}>
        <Coin />
        <span className="v3-num">{coins}</span>
      </AppLink>
      <AppLink href="/" className="v3-chip v3-level-chip" aria-label={`${world.me.name}, level ${shownLevel.level}`}>
        <MemberFace face={world.me.face} className="v3-chip-face" />
        <span className="v3-level-chip-text">
          <span className="v3-level-chip-level">Lv {shownLevel.level}</span>
          <LevelBar level={shownLevel} size="sm" label={`${shownLevel.toNext} XP to level ${shownLevel.level + 1}`} />
        </span>
      </AppLink>
    </div>
  );
}
