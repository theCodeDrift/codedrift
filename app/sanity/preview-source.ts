/**
 * Preview tickets are minted in Studio and checked by the worker. Both sides
 * import from here, so this file stays free of server-only code.
 *
 * Tickets are our own documents rather than `@sanity/preview-url-secret`'s,
 * because that library deletes every ticket older than one hour whenever a
 * new one is minted, and a preview link has to survive a 48-hour review.
 */

/** Query parameter that carries the ticket on a preview URL. */
export const PREVIEW_SEARCH_PARAM = "preview";

/** Document type for a ticket. Not in the Studio schema, so it never shows up there. */
export const PREVIEW_TICKET_TYPE = "codedrift.previewTicket";

/**
 * ID prefix for tickets. An ID with a dot in it is private in a public
 * dataset, so a ticket can only be read with a token.
 */
export const PREVIEW_TICKET_ID_PREFIX = "drafts.codedrift-preview-ticket.";

/** How long a preview link works, in seconds. */
export const PREVIEW_TICKET_TTL = 48 * 60 * 60;

/**
 * The `source` recorded on a preview ticket minted for `pathname`. Studio
 * writes it and the worker matches it, so a shared preview link unlocks that
 * entry only, not every draft in the dataset.
 */
export function previewSource(pathname: string): string {
  return `codedrift-blog-preview:${pathname}`;
}
