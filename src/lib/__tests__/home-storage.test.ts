import { describe, it, expect, beforeEach } from "vitest";
import { loadHome, saveHome } from "@/lib/home-storage";

describe("home-storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing saved", () => {
    expect(loadHome()).toBeNull();
  });

  it("saves an uppercased code and loads it back", () => {
    saveHome("bcn");
    expect(loadHome()).toBe("BCN");
  });
});
