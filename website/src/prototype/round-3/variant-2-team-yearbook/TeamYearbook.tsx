// PROTOTYPE (#625, round 3) Team yearbook: a calm, people-first yearbook of the teammates you've thanked. Never merge to main.
import { HedgehogSitting } from "../../../hoggies";
import { AppLink } from "../../../AppLink";
import { MemberFace } from "../../art";
import type { VariantProps } from "../../PrototypeStage";
import { useAlbum } from "../album";
import { Album } from "./Album";
import { Home } from "./Home";
import { ActivityPage, LeaderboardPage, MilestonesPage } from "./Pages";
import "./yearbook.css";

type Section = "home" | "album" | "milestones" | "leaderboard" | "activity" | "settings";

export function TeamYearbook({ route, todaysPage }: VariantProps) {
  const section = sectionOf(route);
  return (
    <div className="ty">
      <TopNav current={section} />
      <div className="ty-body">
        {section === "home" && <Home />}
        {section === "album" && <Album />}
        {section === "milestones" && <MilestonesPage />}
        {section === "leaderboard" && <LeaderboardPage />}
        {section === "activity" && <ActivityPage />}
        {section === "settings" && <div className="ty-settings">{todaysPage}</div>}
        {route.page === "not-found" && <NotFound />}
      </div>
    </div>
  );
}

function sectionOf(route: VariantProps["route"]): Section | null {
  if (route.page === "book") return route.bookPage === "earned" ? "milestones" : "album";
  if (route.page === "leaderboard" || route.page === "activity" || route.page === "settings") return route.page;
  if (route.page === "not-found") return null;
  return "home";
}

const links: { section: Section; label: string; href: string }[] = [
  { section: "home", label: "Home", href: "/" },
  { section: "album", label: "Album", href: "/book" },
  { section: "milestones", label: "Milestones", href: "/book/earned" },
  { section: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
  { section: "activity", label: "Activity", href: "/activity" },
  { section: "settings", label: "Settings", href: "/settings" },
];

function TopNav({ current }: { current: Section | null }) {
  const { album } = useAlbum();
  return (
    <header className="ty-nav">
      <AppLink href="/" className="ty-brand">
        <HedgehogSitting size={30} />
        <span>HedgeHug</span>
      </AppLink>
      <nav aria-label="Yearbook" className="ty-nav-links">
        {links.map(({ section, label, href }) => (
          <AppLink key={section} href={href} aria-current={section === current ? "page" : undefined} className="ty-nav-link">
            {label}
            {section === "album" && album.packs.length > 0 && <span className="ty-nav-dot" aria-label={`${album.packs.length} packs waiting`}>{album.packs.length}</span>}
          </AppLink>
        ))}
      </nav>
      <span className="ty-nav-me">
        <MemberFace face={album.me.face} className="ty-nav-face" />
        <span className="ty-nav-name">{album.me.name}</span>
      </span>
    </header>
  );
}

function NotFound() {
  return (
    <section className="ty-page ty-narrow">
      <h1 className="ty-title">This page isn't in the yearbook</h1>
      <p className="ty-muted">
        <AppLink href="/" className="ty-link">
          Back to your people
        </AppLink>
      </p>
    </section>
  );
}
