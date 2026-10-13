import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";

export type Redemption = "none" | "redeeming" | "failed";

type RedeemCode = (provider: undefined, params: { code: string }) => Promise<unknown>;

function codeFromAddress() {
  return new URLSearchParams(window.location.search).get("code");
}

function takeCodeOffAddress() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export function useCodeRedemption(): Redemption {
  const redeem = useAuthActions().signIn as unknown as RedeemCode;
  const [code] = useState(codeFromAddress);
  const [redemption, setRedemption] = useState<Redemption>(code === null ? "none" : "redeeming");
  const started = useRef(false);

  useEffect(() => {
    if (code === null || started.current) return;
    started.current = true;
    takeCodeOffAddress();
    redeem(undefined, { code }).then(
      () => setRedemption("none"),
      () => setRedemption("failed"),
    );
  }, [code, redeem]);

  return redemption;
}
