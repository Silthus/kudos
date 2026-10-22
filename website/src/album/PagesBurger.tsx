import { IconBurger } from "@posthog/icons";
import { useEffect, useId, useRef } from "react";
import type { Album } from "./answer";
import type { Place } from "./place";
import { TeamsAndPages } from "./Sidebar";
import type { TopBarPopups } from "./TopBar";
import type { Popover } from "./usePopover";

type PagesBurgerProps = { album: Album; place: Place; popover: Popover<TopBarPopups> };

export function PagesBurger({ album, place, popover }: PagesBurgerProps) {
  const drawer = useId();
  const burger = useRef<HTMLButtonElement>(null);
  const open = popover.open === "pages";
  const closeOntoTheBurger = () => {
    popover.close();
    burger.current?.focus();
  };
  return (
    <span className="al-popover-anchor" ref={open ? popover.anchor : undefined}>
      <button type="button" ref={burger} className="al-top-button al-burger" aria-label="Teams and pages" aria-expanded={open} aria-controls={open ? drawer : undefined} onClick={() => popover.toggle("pages")}>
        <IconBurger />
      </button>
      {open && (
        <>
          <span className="al-drawer-backdrop" aria-hidden="true" onClick={closeOntoTheBurger} />
          <Drawer id={drawer} album={album} place={place} onFollow={popover.close} />
        </>
      )}
    </span>
  );
}

function Drawer({ id, album, place, onFollow }: { id: string; album: Album; place: Place; onFollow: () => void }) {
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    drawer.current?.focus();
  }, []);
  return (
    <nav id={id} ref={drawer} tabIndex={-1} className="al-drawer" aria-label="Album">
      <div className="al-side-panel">
        <TeamsAndPages album={album} place={place} onFollow={onFollow} />
      </div>
    </nav>
  );
}
