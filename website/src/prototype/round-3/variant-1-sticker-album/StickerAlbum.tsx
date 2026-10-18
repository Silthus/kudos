// PROTOTYPE (#625, round 3): variant 1, the website is a World Cup-style sticker album on a calm desk. Never merge to main.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { VariantProps } from "../../PrototypeStage";
import { keepingTheVariant } from "../../variants";
import { useAlbum, type Album, type PackOpening } from "../album";
import { AppLink, useNavigate } from "../../../AppLink";
import { OpenAlbum } from "./Album";
import { Cover } from "./Cover";
import { PacksPlace } from "./Packs";
import { ActivitySheet, LeaderboardSheet, SettingsSheet } from "./Sheets";
import { hrefOfSpread, landingTeamOf, personHref, placeAt, plural, spreadsOf, stickerNumbersOf, type Landing } from "./model";
import "./stickerAlbum.css";

const stageWidth = 1200;

const stageHeight = 700;

export function StickerAlbum({ route, todaysPage }: VariantProps) {
  const { album, actions } = useAlbum();
  const navigate = useNavigate();
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [landing, setLanding] = useState<Landing | null>(null);
  const pushedPerson = useRef(false);
  const phone = usePhone();
  const scale = useFit(phone);
  const spreads = useMemo(() => spreadsOf(album), [album]);
  const numbers = useMemo(() => stickerNumbersOf(album), [album]);

  useEffect(() => {
    window.addEventListener("hashchange", rerender);
    window.addEventListener("popstate", rerender);
    return () => {
      window.removeEventListener("hashchange", rerender);
      window.removeEventListener("popstate", rerender);
    };
  }, []);

  useEffect(() => {
    if (route.page !== "book") setLanding(null);
  }, [route.page]);

  const place = route.page === "book" ? placeAt(window.location, spreads, album) : null;

  const flip = useCallback(
    (index: number) => {
      const spread = spreads[index];
      if (spread === undefined) return;
      window.history.replaceState(null, "", keepingTheVariant(hrefOfSpread(spread)));
      rerender();
    },
    [spreads],
  );

  const openPerson = useCallback(
    (key: string) => {
      pushedPerson.current = true;
      navigate(personHref(key));
    },
    [navigate],
  );

  const closePerson = useCallback(() => {
    if (pushedPerson.current) {
      pushedPerson.current = false;
      window.history.back();
      return;
    }
    const index = place?.view === "album" ? place.index : 0;
    navigate(hrefOfSpread(spreads[index]!));
  }, [navigate, place, spreads]);

  const stick = (opening: PackOpening) => {
    const team = opening.person.isNew ? landingTeamOf(opening, album) : null;
    setLanding({ opening, step: team === null ? "hoggie" : "person", team });
    navigate(team === null ? `/book#hoggies/${opening.hoggie.rarity}` : `/book#teams/${team}`);
  };

  const landingNext = () => {
    if (landing === null) return;
    setLanding({ ...landing, step: "hoggie" });
    navigate(`/book#hoggies/${landing.opening.hoggie.rarity}`);
  };

  const landingDone = () => {
    setLanding(null);
    actions.forgetOpening();
  };

  const body = (() => {
    if (route.page === "leaderboard") return <LeaderboardSheet album={album} />;
    if (route.page === "activity") return <ActivitySheet album={album} />;
    if (route.page === "settings") return <SettingsSheet todaysPage={todaysPage} />;
    if (place === null) return <Cover album={album} />;
    if (place.view === "packs") return <PacksPlace album={album} actions={actions} spreads={spreads} onStick={stick} />;
    return <OpenAlbum album={album} spreads={spreads} numbers={numbers} index={place.index} person={place.person} phone={phone} landing={landing} onFlip={flip} onOpenPerson={openPerson} onClosePerson={closePerson} onLandingNext={landingNext} onLandingDone={landingDone} />;
  })();

  return (
    <div className={`sa ${phone ? "sa-phone" : ""}`}>
      <Stage scale={scale} phone={phone}>
        {body}
      </Stage>
      <Strip album={album} route={route} place={place} />
    </div>
  );
}

function Stage({ scale, phone, children }: { scale: number; phone: boolean; children: ReactNode }) {
  if (phone) return <div className="sa-stage-phone">{children}</div>;
  return (
    <div className="sa-stage-box" style={{ width: stageWidth * scale, height: stageHeight * scale }}>
      <div className="sa-stage" style={{ width: stageWidth, height: stageHeight, transform: `scale(${scale})` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

function Strip({ album, route, place }: { album: Album; route: VariantProps["route"]; place: ReturnType<typeof placeAt> | null }) {
  const onEarned = route.page === "book" && window.location.pathname.endsWith("/book/earned");
  const links = [
    { href: "/", label: "Cover", current: route.page !== "book" && route.page !== "leaderboard" && route.page !== "activity" && route.page !== "settings" },
    { href: "/book", label: "Album", current: place?.view === "album" && !onEarned },
    { href: "/book/earned", label: "Milestones", current: onEarned },
    { href: "/leaderboard", label: "Leaderboard", current: route.page === "leaderboard" },
    { href: "/activity", label: "Activity", current: route.page === "activity" },
    { href: "/settings", label: "Settings", current: route.page === "settings" },
  ];
  return (
    <nav className="sa-strip" aria-label="Album">
      {album.packs.length > 0 && (
        <AppLink href="/book#packs" className={`sa-strip-packs ${place?.view === "packs" ? "sa-strip-current" : ""}`} aria-current={place?.view === "packs" ? "page" : undefined}>
          {plural(album.packs.length, "pack")} to open
        </AppLink>
      )}
      {links.map(({ href, label, current }) => (
        <AppLink key={href} href={href} className={current ? "sa-strip-current" : undefined} aria-current={current ? "page" : undefined}>
          {label}
        </AppLink>
      ))}
    </nav>
  );
}

function usePhone() {
  const [phone, setPhone] = useState(() => window.innerWidth < 760);
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return phone;
}

function useFit(phone: boolean) {
  const fit = () => Math.min(1, (window.innerWidth - 64) / stageWidth, (window.innerHeight - 200) / stageHeight);
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [phone]);
  return phone ? 1 : scale;
}
