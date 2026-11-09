import {
  type DocumentActionComponent,
  useClient,
  useCurrentUser,
} from "sanity";

import {
  PREVIEW_SEARCH_PARAM,
  PREVIEW_TICKET_ID_PREFIX,
  PREVIEW_TICKET_TTL,
  PREVIEW_TICKET_TYPE,
  previewSource,
} from "./preview-source";

export const PREVIEWABLE_TYPES = new Set(["post"]);

/** 32 random bytes as base64url without padding: always 43 characters. */
function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * Mints a 48-hour preview ticket with the editor's own credentials and opens
 * the entry at its real `/blog/<slug>` URL. A document action rather than
 * `document.productionUrl`, because Studio re-resolves `productionUrl` on every
 * edit, which would write a ticket each time an editor pauses typing.
 */
export const OpenPreviewAction: DocumentActionComponent = ({
  draft,
  published,
}) => {
  const client = useClient({ apiVersion: "2025-02-19" });
  const currentUser = useCurrentUser();
  // The site's drafts perspective serves the draft when one exists, so its
  // slug is the one that will resolve.
  const slug = ((draft ?? published)?.slug as { current?: string } | undefined)
    ?.current;

  return {
    label: "Open preview (48h link)",
    disabled: !slug,
    title: slug ? undefined : "Add a slug to preview this entry",
    onHandle: () => {
      if (!slug) return;
      const origin = globalThis.location.origin;

      // Open the tab inside the click so popup blockers allow it; the URL
      // arrives once the ticket has been minted.
      const tab = globalThis.open("", "_blank");
      // Drop the back-reference: the preview page is same-origin with Studio.
      // DOM requires `null` here.
      // eslint-disable-next-line unicorn/no-null
      if (tab) tab.opener = null;

      const url = new URL(`/blog/${encodeURIComponent(slug)}`, origin);
      const secret = generateSecret();
      client
        .create({
          _id: `${PREVIEW_TICKET_ID_PREFIX}${crypto.randomUUID()}`,
          _type: PREVIEW_TICKET_TYPE,
          secret,
          source: previewSource(url.pathname),
          userId: currentUser?.id,
          expiresAt: new Date(
            Date.now() + PREVIEW_TICKET_TTL * 1000,
          ).toISOString(),
        })
        .then(() => {
          url.searchParams.set(PREVIEW_SEARCH_PARAM, secret);
          if (tab) {
            tab.location.href = url.toString();
          } else {
            globalThis.open(url, "_blank", "noopener");
          }
          // Expired tickets are dead weight; clear them out, best effort.
          return client.delete({
            query: `*[_type == $type && dateTime(_updatedAt) <= dateTime(now()) - $ttl]`,
            params: { type: PREVIEW_TICKET_TYPE, ttl: PREVIEW_TICKET_TTL },
          });
        })
        .catch((error: unknown) => {
          console.error("Could not create a preview link", error);
        });
    },
  };
};
