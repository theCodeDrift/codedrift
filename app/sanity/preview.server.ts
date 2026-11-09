import { createClient, type SanityClient } from "@sanity/client";
import {
  SECRET_TTL,
  schemaType,
  urlSearchParamPreviewSecret,
} from "@sanity/preview-url-secret/constants";

import { previewSource } from "./preview-source";

// The `drafts` perspective name needs 2025-02-19 or later. Pinned here rather
// than in SANITY_API_VERSION so published reads are untouched.
const PREVIEW_API_VERSION = "2025-02-19";

interface PreviewOptions {
  env: Env;
}

/**
 * Token-authenticated client that reads drafts in place of published
 * documents. Use only after `resolvePreview` has returned true.
 */
export function getSanityPreviewClient({ env }: PreviewOptions): SanityClient {
  return createClient({
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET,
    apiVersion: PREVIEW_API_VERSION,
    useCdn: false,
    perspective: "drafts",
    token: env.SANITY_API_READ_TOKEN,
  });
}

// `createPreviewSecret` encodes 16 random bytes as hex, then base64url without
// padding: always 43 characters. Anything else is rejected before it can cost
// a Sanity request.
const SECRET_SHAPE = /^[\w-]{43}$/;

// The library's own `validatePreviewUrl` checks the secret and its age but not
// what it was minted for, so this query adds the `source` match.
const SCOPED_SECRET_QUERY = `count(*[
  _type == $type &&
  secret == $secret &&
  source == $source &&
  dateTime(_updatedAt) > dateTime(now()) - $ttl
]) > 0`;

/**
 * True only when the request carries an unexpired preview ticket minted in
 * Studio for this exact path. A missing, malformed, forged, expired, or
 * other-path ticket returns false so the caller falls back to published
 * content without revealing why.
 */
export async function resolvePreview({
  env,
  request,
}: PreviewOptions & { request: Request }): Promise<boolean> {
  const url = new URL(request.url);
  const secret = url.searchParams.get(urlSearchParamPreviewSecret);
  if (!secret || !SECRET_SHAPE.test(secret)) return false;

  try {
    return await getSanityPreviewClient({ env })
      .withConfig({ perspective: "raw" })
      .fetch<boolean>(SCOPED_SECRET_QUERY, {
        type: schemaType,
        secret,
        source: previewSource(url.pathname),
        ttl: SECRET_TTL,
      });
  } catch (error) {
    console.error("Preview ticket validation failed", error);
    return false;
  }
}
