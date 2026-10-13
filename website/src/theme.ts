import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const storageKey = "hedgehug.theme";
const darkSystemQuery = "(prefers-color-scheme: dark)";

function storedChoice(): ThemeChoice {
  const stored = localStorage.getItem(storageKey);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function rememberChoice(choice: ThemeChoice) {
  if (choice === "system") localStorage.removeItem(storageKey);
  else localStorage.setItem(storageKey, choice);
}

function systemIsDark() {
  return window.matchMedia(darkSystemQuery).matches;
}

function useSystemDark() {
  const [dark, setDark] = useState(systemIsDark);
  useEffect(() => {
    const query = window.matchMedia(darkSystemQuery);
    const follow = () => setDark(query.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return dark;
}

export function useTheme() {
  const [choice, setChoice] = useState(storedChoice);
  const systemDark = useSystemDark();
  const dark = choice === "system" ? systemDark : choice === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const choose = useCallback((next: ThemeChoice) => {
    rememberChoice(next);
    setChoice(next);
  }, []);

  return { choice, choose };
}
