export const HOME_KEY = "weekendescape:home";

export function loadHome(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(HOME_KEY);
}

export function saveHome(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOME_KEY, code.toUpperCase());
}
