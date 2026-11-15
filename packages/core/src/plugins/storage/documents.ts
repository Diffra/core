/** Folder, in every storage backend, that holds named JSON documents. */
export const DOCUMENTS_DIR = 'documents';

const DOCUMENT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Checks a document name before it becomes part of a path or object key. A
 * name is a single plain file name, so it can never leave the documents folder.
 */
export function assertDocumentName(name: string): string {
  if (!DOCUMENT_NAME.test(name) || name.includes('..')) {
    throw new Error(`Invalid document name: ${JSON.stringify(name)}`);
  }
  return name;
}
