import { createContext, useContext, type ComponentProps, type MouseEvent } from "react";

const NavigateContext = createContext<(href: string) => void>((href) => window.location.assign(href));

export const NavigateProvider = NavigateContext.Provider;

export function useNavigate() {
  return useContext(NavigateContext);
}

export function AppLink({ href, onFollow, ...props }: ComponentProps<"a"> & { href: string; onFollow?: () => void }) {
  const navigate = useNavigate();
  const followInPlace = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onFollow?.();
    navigate(href);
  };
  return <a href={href} {...props} onClick={followInPlace} />;
}

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
