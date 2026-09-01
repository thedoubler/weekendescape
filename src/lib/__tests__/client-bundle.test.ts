import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// The bundled lookup tables are big — airports.json is ~134 KB (6k entries) and
// cities.json ~1.8 MB. They exist to be read on the server. If a client
// component ever reaches one through its import graph, Turbopack will happily
// ship it to the browser and nobody will notice until the bundle is measured.
//
// This walks the real import graph from every "use client" entry point and
// fails if it reaches one. It is a structural guard, not a style rule: the fix
// is always to resolve the data server-side and put the result on the API
// response (see `toCoords` in the /api/weekends route).

const SRC = resolve(__dirname, "../..");
const FORBIDDEN = [
  "airports.json",
  "cities.json",
  "airport-regions.json",
  "region-names.json",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      out.push(...walk(p));
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

// Resolve an import specifier to a file on disk, or null for a bare package.
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules — not our concern
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  // Covers `import x from "y"`, `import "y"`, and `export ... from "y"`.
  return [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

// Every module reachable from `entry`, plus the path taken to get there.
function reachableFrom(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    const path = seen.get(file)!;
    for (const spec of importsOf(file)) {
      if (FORBIDDEN.some((f) => spec.endsWith(f))) {
        seen.set(spec, [...path, spec]);
        continue;
      }
      const next = resolveImport(spec, file);
      if (!next || seen.has(next)) continue;
      seen.set(next, [...path, next]);
      queue.push(next);
    }
  }
  return seen;
}

const clientEntries = walk(SRC).filter((f) =>
  /^\s*["']use client["']/.test(readFileSync(f, "utf8"))
);

describe("client bundle", () => {
  it("finds the client entry points", () => {
    // Guards the guard: if this hits zero the suite below passes vacuously.
    expect(clientEntries.length).toBeGreaterThan(0);
  });

  it.each(clientEntries.map((f) => [f.replace(`${SRC}/`, ""), f] as const))(
    "%s does not reach a server-only data table",
    (_label, entry) => {
      const reached = reachableFrom(entry);
      const offenders = [...reached.entries()].filter(([mod]) =>
        FORBIDDEN.some((f) => mod.endsWith(f))
      );
      // Report the whole chain — "cities.json is in the bundle" is useless
      // without knowing which import pulled it in.
      const trails = offenders.map(([, path]) =>
        path.map((p) => p.replace(`${SRC}/`, "")).join("\n    → ")
      );
      expect(trails, `server-only data reachable from a client component:\n    ${trails.join("\n\n    ")}`).toEqual([]);
    }
  );
});
