/**
 * Getting a picture out of the app and into a conversation.
 *
 * All of the browser feature detection lives here so the screens can ask one
 * question each and stay simple. Nothing touches `navigator` at module scope:
 * the tests run in plain node, and an import must not throw there.
 */

/** Which export is running, so its row can say so and the others can wait. */
export type ExportJob = 'print' | 'share' | 'image' | 'copy';

const PNG = 'image/png';

/**
 * Whether the device's own share sheet will take a file — which on a phone is
 * the route straight into WhatsApp. Desktop browsers mostly cannot, and there
 * the row is simply not offered; saving and copying cover it.
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function' || typeof File === 'undefined') return false;
  try {
    return navigator.canShare({ files: [new File([], 'probe.png', { type: PNG })] });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

/**
 * `cancelled` is the player closing the sheet — a decision, not a failure, so
 * the caller does nothing. `unsupported` covers a browser that advertises
 * sharing and then refuses, which older Safari does once the tap that started
 * the export is too far in the past; the caller falls back to a download.
 */
export async function shareFile(file: File, title: string): Promise<ShareOutcome> {
  if (!canShareFiles()) return 'unsupported';
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    return (err as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/* --- A link ----------------------------------------------------------------
   Sending the link to a shared song. These are each called from a tap of their
   own, never at the end of the network call that made the link: a share sheet
   and a clipboard write both need the tap to be recent, and Safari's idea of
   recent does not survive a round trip to the database. */

/** Whether the device's share sheet will take a link. Most phones; few desktops. */
export function canShareLinks(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareLink(url: string, title: string): Promise<ShareOutcome> {
  if (!canShareLinks()) return 'unsupported';
  try {
    await navigator.share({ url, title });
    return 'shared';
  } catch (err) {
    return (err as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** False when the clipboard is not there or will not be written to. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function canCopyImages(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

/**
 * Takes the *promise* of the picture, not the picture. Safari only allows a
 * clipboard write from inside the tap that asked for it, and awaiting the PNG
 * first is long enough to fall outside it. Handing the promise to
 * `ClipboardItem` makes the call synchronously and lets the data follow.
 */
export async function copyPng(png: Blob | Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ [PNG]: png })]);
}
