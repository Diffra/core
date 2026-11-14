import { useEffect, useState } from 'react';
import { COPIED_FEEDBACK_MS } from '../lib/constants.js';

/** Copies the current address, and reports briefly that it did. */
export function useCopyLink() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // The clipboard is unavailable, for example on some file:// pages.
    }
  };

  return { copied, copy };
}
