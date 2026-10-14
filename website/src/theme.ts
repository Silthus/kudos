import { useEffect, useState, useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const storageKey = "hedgehug.theme";
const darkSystemQuery = "(prefers-color-scheme: dark)";

let choiceStorageRefused: ThemeChoice | undefined;

function storedChoice(): ThemeChoice {
  if (choiceStorageRefused !== undefined) return choiceStorageRefused;
  const stored = readStorage();
  return stored === "light" || stored === "dark" ? stored : "system";
}

function readStorage() {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function rememberChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, choice);
    choiceStorageRefused = undefined;
  } catch {
    choiceStorageRefused = choice;
  }
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

const choiceListeners = new Set<() => void>();

function followChoice(listener: () => void) {
  choiceListeners.add(listener);
  return () => choiceListeners.delete(listener);
}

function choose(next: ThemeChoice) {
  rememberChoice(next);
  choiceListeners.forEach((listener) => listener());
}

export function useTheme() {
  const choice = useSyncExternalStore(followChoice, storedChoice);
  const systemDark = useSystemDark();
  const dark = choice === "system" ? systemDark : choice === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return { choice, choose };
}
