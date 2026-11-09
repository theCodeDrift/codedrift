import { urlSearchParamPreviewSecret } from "@sanity/preview-url-secret/constants";
import { createPreviewSecret } from "@sanity/preview-url-secret/create-secret";
import {
  type DocumentActionComponent,
  useClient,
  useCurrentUser,
} from "sanity";

import { previewSource } from "./preview-source";

export const PREVIEWABLE_TYPES = new Set(["post"]);

/**
 * Mints a one-hour preview ticket with the editor"s own credentials and opens
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
  // The site"s drafts perspective serves the draft when one exists, so its
  // slug is the one that will resolve.
  const slug = ((draft ?? published)?.slug as { current?: string } | undefined)
    ?.current;

  return {
    label: "Open preview",
    disabled: !slug,
    title: slug ? undefined : "Add a slug to preview this entry",
    onHandle: () => {
      if (!slug) return;
      const origin = globalThis.location.origin;

      // Open the tab inside the click so popup blockers allow it; the URL
      // arrives once the ticket has been minted.
      const tab = globalThis.open("", "_blank");
      // Drop the back-reference: the preview page embeds third-party content
      // and is same-origin with Studio. DOM requires `null` here.
      // eslint-disable-next-line unicorn/no-null
      if (tab) tab.opener = null;

      const url = new URL(`/blog/${encodeURIComponent(slug)}`, origin);
      createPreviewSecret(
        client,
        previewSource(url.pathname),
        `${origin}/_/studio`,
        currentUser?.id,
      )
        .then(({ secret }) => {
          url.searchParams.set(urlSearchParamPreviewSecret, secret);
          if (tab) {
            tab.location.href = url.toString();
          } else {
            globalThis.open(url, "_blank", "noopener");
          }
        })
        .catch((error: unknown) => {
          tab?.close();
          console.error("Could not create a preview link", error);
        });
    },
  };
};
