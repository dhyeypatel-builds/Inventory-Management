/**
 * Copy text to the clipboard, working in both secure and insecure contexts.
 *
 * `navigator.clipboard` only exists over HTTPS (or localhost). The app is often
 * reached over plain HTTP (e.g. http://<ip>:8080), where that API is undefined,
 * so we fall back to a hidden <textarea> + execCommand('copy').
 *
 * Returns true on success, false if both strategies fail.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Preferred path: async Clipboard API (secure contexts only).
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy approach (e.g. permission denied).
    }
  }

  // Legacy fallback: select a detached textarea and let the browser copy it.
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Keep it out of view and out of the layout/scroll flow.
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
