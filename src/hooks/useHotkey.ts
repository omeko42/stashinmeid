'use client';

import { useEffect } from 'react';

/**
 * Panggil handler saat kombinasi tombol ditekan.
 *
 * `combo` ditulis sebagai 'mod+k' - 'mod' berarti Ctrl di Windows/Linux dan
 * Cmd di macOS.
 */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];

    const onKeyDown = (event: KeyboardEvent) => {
      const modPressed = event.metaKey || event.ctrlKey;
      const wantsMod = parts.includes('mod');

      if (wantsMod && !modPressed) return;
      if (!wantsMod && (event.metaKey || event.ctrlKey || event.altKey)) return;

      if (event.key.toLowerCase() === key) {
        event.preventDefault();
        handler(event);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [combo, handler, enabled]);
}
