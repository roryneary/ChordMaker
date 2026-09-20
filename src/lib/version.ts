/**
 * Which build is running, in words the player can read out to you.
 *
 * The version is the number you quote; the commit and date are what answer
 * "is the phone on the build I just deployed?" — a question a hand-bumped
 * number cannot answer, because forgetting to bump it looks exactly like a
 * stale cache. See `vite.config.ts` for where the three values come from.
 */

/** The `version` in package.json, inlined at build time. */
export const APP_VERSION: string = __APP_VERSION__;
/** Seven characters of the deployed commit, or '' where git was not available. */
export const BUILD_COMMIT: string = __BUILD_COMMIT__;
/** When the bundle was built, ISO, or '' if the stamp failed. */
export const BUILD_DATE: string = __BUILD_DATE__;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * "20 Sep 2026", spelled out by hand and read in UTC.
 *
 * Not `toLocaleDateString`: this string exists to be read out and matched
 * against a deploy log, so it has to say the same thing on every device. The
 * device's locale would not (`en-GB` alone gives "20/09/2026"), and even a
 * fixed locale would not — ICU renames months between versions, which is how
 * en-GB's short September became "Sept". The month is a word rather than a
 * number for the older reason: 09/10 is two different days on two continents.
 */
export function buildDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

/**
 * The line in its two halves: the number you quote, and the build behind it.
 *
 * Two rather than one because the sidebar is 234px wide and the account screen
 * is not — the same string has to sit on one line in one place and stack in the
 * other, and a string that has already been joined cannot. Anything the build
 * could not stamp comes back empty and is simply left out: "Version 1.0.0 ·  · "
 * would read like a fault in the app rather than in the stamp.
 */
export function versionParts(
  version: string = APP_VERSION,
  commit: string = BUILD_COMMIT,
  date: string = BUILD_DATE,
): { number: string; build: string } {
  return {
    number: version ? `Version ${version}` : '',
    build: [commit, buildDay(date)].filter(Boolean).join(' · '),
  };
}

/** The same thing as one string, for reading out and for copying in one piece. */
export function versionLine(
  version: string = APP_VERSION,
  commit: string = BUILD_COMMIT,
  date: string = BUILD_DATE,
): string {
  const { number, build } = versionParts(version, commit, date);
  return [number, build].filter(Boolean).join(' · ');
}
