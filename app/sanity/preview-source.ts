/**
 * The `source` recorded on a preview ticket minted for `pathname`. Studio
 * writes it and the worker matches it, so a shared preview link unlocks that
 * entry only, not every draft in the dataset.
 */
export function previewSource(pathname: string): string {
  return `codedrift-blog-preview:${pathname}`;
}
