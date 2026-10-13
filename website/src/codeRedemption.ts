import { useEffect, useState } from "react";

function codeFromSlackPending() {
  return new URLSearchParams(window.location.search).has("code");
}

export function useCodeRedemptionFailed(authLoading: boolean) {
  const [codePending] = useState(codeFromSlackPending);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!codePending || !authLoading) return;
    const fail = () => setFailed(true);
    window.addEventListener("unhandledrejection", fail);
    return () => window.removeEventListener("unhandledrejection", fail);
  }, [codePending, authLoading]);

  return failed;
}
