/**
 * Produces a short team abbreviation like "GUL1", "GUL2", "LAR" from a
 * full team name — first 3 letters, uppercased, plus a trailing number
 * if the team name ends with one (e.g. "Gullhaug Team 1" -> "GUL1").
 */
export function teamAbbrev(name: string | undefined | null): string {
  if (!name) return "—";
  const trimmed = name.trim();
  const numberMatch = trimmed.match(/(\d+)\s*$/);
  const withoutNumber = numberMatch ? trimmed.slice(0, numberMatch.index).trim() : trimmed;
  const letters = withoutNumber.replace(/[^a-zA-ZæøåÆØÅ]/g, "").slice(0, 3).toUpperCase();
  return numberMatch ? `${letters}${numberMatch[1]}` : letters;
}
