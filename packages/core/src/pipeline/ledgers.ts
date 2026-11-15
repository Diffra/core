import { ledgerDocumentName, type RenderLedger } from '../context/ledger.js';
import type { ReviewBundle } from '../report/bundle.js';
import type { StorageAdapter } from '../types/index.js';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Keeps the ledger of an image in storage, named after the image's hash, and
 * puts a copy in the review bundle. Because the name comes from the image, an
 * approved candidate's ledger is already stored when it becomes a baseline.
 * Returns the bundle address, or nothing when there is no ledger.
 */
export async function storeLedger(
  storage: StorageAdapter,
  bundle: ReviewBundle,
  imageHash: string,
  ledger: RenderLedger | undefined,
): Promise<string | undefined> {
  if (!ledger) return undefined;
  const content = Buffer.from(JSON.stringify(ledger));
  try {
    const name = ledgerDocumentName(imageHash);
    if (storage.uploadDocument && !(await storage.hasDocument?.(name))) {
      await storage.uploadDocument(name, content);
    }
  } catch (err) {
    // The snapshot is still reviewable without its ledger being kept for later.
    console.warn(
      `[diffra] Warning: could not store a ledger: ${messageOf(err)}`,
    );
  }
  return bundle.addLedger(content);
}

/** Finds the ledger stored for an image and puts a copy in the review bundle. */
export async function loadLedger(
  storage: StorageAdapter,
  bundle: ReviewBundle,
  imageHash: string,
): Promise<{ url: string; ledger: RenderLedger } | undefined> {
  try {
    const content = await storage.downloadDocument?.(
      ledgerDocumentName(imageHash),
    );
    if (!content) return undefined;
    return {
      url: await bundle.addLedger(content),
      ledger: JSON.parse(content.toString('utf-8')) as RenderLedger,
    };
  } catch (err) {
    console.warn(
      `[diffra] Warning: could not read a ledger: ${messageOf(err)}`,
    );
    return undefined;
  }
}
