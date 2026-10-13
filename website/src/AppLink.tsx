import { createContext, useContext, type ComponentProps, type MouseEvent } from "react";

const NavigateContext = createContext<(href: string) => void>((href) => window.location.assign(href));

export const NavigateProvider = NavigateContext.Provider;

export function AppLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  const navigate = useContext(NavigateContext);
  const followInPlace = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} {...props} onClick={followInPlace} />;
}

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
