import { versionLine, versionParts } from '../lib/version';

/**
 * Which build is running: on the account screen, and at the foot of the
 * sidebar. Two spans rather than one string so the 234px sidebar can stack
 * them while the account screen keeps them on one line — the separator between
 * them is real text rather than a CSS `::before`, so it survives being copied
 * and read aloud; the sidebar simply hides it.
 *
 * `title` carries the whole thing as one string, which is what you want when
 * you are copying it into a message rather than reading it out.
 */
export default function VersionLine({ className }: { className?: string }) {
  const { number, build } = versionParts();
  if (!number && !build) return null;
  return (
    <p className={className ? `version-line ${className}` : 'version-line'} title={versionLine()}>
      {number && <span>{number}</span>}
      {number && build && <span className="version-dot"> · </span>}
      {build && <span>{build}</span>}
    </p>
  );
}
