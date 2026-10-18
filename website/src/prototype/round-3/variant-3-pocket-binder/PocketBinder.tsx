// PROTOTYPE (#625, round 3): variant 3 Pocket binder: people are trading cards in a nine-pocket binder, hoggies are the holo chase cards. Never merge to main.
import { IconCrown, IconGear, IconPulse, IconStar } from "@posthog/icons";
import { useCallback, useMemo, useReducer, useState, type ComponentType } from "react";
import { AppLink, useNavigate } from "../../../AppLink";
import type { VariantProps } from "../../PrototypeStage";
import { keepingTheVariant } from "../../variants";
import { useAlbum, type PackOpening } from "../album";
import { OpenBinder } from "./Binder";
import { binderOf, bookHref, hashNow, hashOfSpread, placeOf, sheetOfHoggie, sheetOfPerson } from "./binderPages";
import { Home } from "./Home";
import { PackTable } from "./PackTable";
import { Activity, Leaderboard, Settings, TrophyCase } from "./Secondary";
import "./pocketBinder.css";

const corner: { href: string; label: string; Icon: ComponentType<{ className?: string }>; page: string }[] = [
  { href: "/book/earned", label: "Milestones", Icon: IconStar, page: "earned" },
  { href: "/leaderboard", label: "Leaderboard", Icon: IconCrown, page: "leaderboard" },
  { href: "/activity", label: "Activity", Icon: IconPulse, page: "activity" },
  { href: "/settings", label: "Settings", Icon: IconGear, page: "settings" },
];

export function PocketBinder({ route, todaysPage }: VariantProps) {
  const { album, actions } = useAlbum();
  const navigate = useNavigate();
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);
  const [landing, setLanding] = useState<PackOpening | null>(null);
  const binder = useMemo(() => binderOf(album), [album]);
  const replaceTo = useCallback((href: string) => {
    window.history.replaceState(null, "", keepingTheVariant(href));
    rerender();
  }, []);
  const hash = hashNow();
  const place = placeOf(binder, album, hash);
  const land = useCallback(
    (opening: PackOpening) => {
      actions.forgetOpening();
      setLanding(opening);
      const fresh = binderOf(album);
      const sheet = opening.person.isNew ? sheetOfPerson(fresh, album, opening.person.key) : sheetOfHoggie(fresh, opening.hoggie.hoggie);
      navigate(bookHref(hashOfSpread(fresh, Math.floor(sheet / 2))));
    },
    [actions, album, navigate],
  );
  const onBook = route.page === "book" && route.bookPage !== "earned";
  const current = route.page === "book" ? (route.bookPage === "earned" ? "earned" : "book") : route.page;
  return (
    <div className="pb-root">
      <header className="pb-bar">
        <AppLink href="/" className="pb-brand">
          <span aria-hidden="true" className="pb-brand-mark">
            ✦
          </span>
          HedgeHug
        </AppLink>
        <nav aria-label="Binder" className="pb-bar-main">
          <AppLink href="/book" className="pb-bar-link" aria-current={current === "book" && place.kind === "binder" ? "page" : undefined}>
            Binder
          </AppLink>
          <AppLink href="/book#packs" className="pb-bar-link pb-bar-packs" aria-current={current === "book" && place.kind === "packs" ? "page" : undefined}>
            Packs
            {album.packs.length > 0 && <span className="pb-bar-badge">{album.packs.length}</span>}
          </AppLink>
        </nav>
        <nav aria-label="More" className="pb-corner">
          {corner.map(({ href, label, Icon, page }) => (
            <AppLink key={href} href={href} className="pb-corner-link" aria-current={current === page ? "page" : undefined}>
              <Icon className="pb-corner-icon" />
              {label}
            </AppLink>
          ))}
        </nav>
      </header>
      <main className="pb-main">
        {onBook && place.kind === "packs" && <PackTable key={place.pack ?? "first"} album={album} actions={actions} asked={place.pack} onLanded={land} />}
        {onBook && place.kind === "binder" && <OpenBinder album={album} binder={binder} spread={place.spread} lifted={place.lifted} landing={landing} onLandingSeen={() => setLanding(null)} replaceTo={replaceTo} />}
        {current === "earned" && <TrophyCase album={album} />}
        {current === "leaderboard" && <Leaderboard album={album} />}
        {current === "activity" && <Activity album={album} />}
        {current === "settings" && <Settings page={todaysPage} />}
        {(current === "home" || current === "quests" || current === "skills" || current === "not-found") && <Home album={album} />}
      </main>
    </div>
  );
}
