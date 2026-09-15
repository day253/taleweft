import { diffChars, type Change } from "diff";

/** Bound edit cost for unusually long rewritten paragraphs. */
export function compareText(original: string, current: string) {
  const precise = diffChars(original, current, {
    maxEditLength: 3000,
    timeout: 25,
  });
  const changes: Change[] = precise ?? [
    {
      value: original,
      count: Array.from(original).length,
      added: false,
      removed: true,
    },
    {
      value: current,
      count: Array.from(current).length,
      added: true,
      removed: false,
    },
  ];
  return {
    changes,
    coarse: !precise,
    added: changes.filter((c) => c.added).reduce((n, c) => n + c.count, 0),
    removed: changes.filter((c) => c.removed).reduce((n, c) => n + c.count, 0),
  };
}
