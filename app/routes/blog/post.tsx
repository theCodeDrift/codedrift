import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";
import { data, useLoaderData } from "react-router";

import type { Route } from "./+types/post";
import Content from "~/components/content";
import { PortableText, type ImageConfig } from "~/components/portable-text";
import { cloudflareEnvironmentContext } from "~/context";
import { getSanityClient } from "~/sanity/client";
import {
  getSanityPreviewClient,
  resolvePreview,
} from "~/sanity/preview.server";
import { POST_BY_SLUG_QUERY } from "~/sanity/queries";
import { buildSignedOgImageUrl } from "~/og";
import { SITE, absoluteUrl, pageMeta } from "~/seo";

interface TagReference {
  _id: string;
  name: string;
  slug: { current: string };
}

interface PostEntry {
  _id: string;
  _updatedAt?: string;
  title: string;
  slug: { current: string };
  /** Unset on a draft that has never been published; only reachable in preview. */
  publishedAt?: string;
  /** Author-set revision date; drives the visible "Updated" line. */
  updatedAt?: string;
  excerpt?: string;
  heroImage?: SanityImageSource & { alt?: string };
  body: unknown[];
  tags?: TagReference[];
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found — The CodeDrift" }];
  const { post, imageConfig, ogCard, preview } = loaderData;
  const path = `/blog/${post.slug.current}`;
  const description =
    post.excerpt ?? `${post.title} — long-form writing by ${SITE.author}.`;
  // Prefer the post's hero image as the share image; otherwise the signed card.
  const heroImage = post.heroImage
    ? createImageUrlBuilder(imageConfig)
        .image(post.heroImage)
        .width(1200)
        .height(630)
        .fit("crop")
        .auto("format")
        .url()
    : undefined;
  const ogImage = heroImage ?? ogCard;

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post._updatedAt ?? post.publishedAt,
    author: { "@id": SITE.personId },
    publisher: { "@id": SITE.personId },
    mainEntityOfPage: absoluteUrl(path),
    url: absoluteUrl(path),
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(ogImage ? { image: [ogImage] } : {}),
  };

  const tags = [
    ...pageMeta({
      title: `${post.title} — The CodeDrift`,
      description,
      path,
      image: ogImage,
      type: "article",
    }),
  ];
  // A preview is noindex and an unpublished post has no true publish date,
  // so the BlogPosting entity is left out.
  if (preview || !post.publishedAt) {
    return [...tags, { name: "robots", content: "noindex, nofollow" }];
  }
  return [...tags, { "script:ld+json": blogPosting }];
}

const PREVIEW_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  // A thrown 404 under a valid ticket still has the ticket in its URL.
  return errorHeaders ?? loaderHeaders;
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const preview = await resolvePreview({ env, request });
  const client = preview
    ? getSanityPreviewClient({ env })
    : getSanityClient({ env });
  const post = await client.fetch<PostEntry | null>(POST_BY_SLUG_QUERY, {
    slug: params.slug,
  });

  if (!post) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router idiom: throwing a `data()` response surfaces as a 404 to the framework.
    throw data(undefined, {
      status: 404,
      headers: preview ? PREVIEW_HEADERS : undefined,
    });
  }

  const imageConfig: ImageConfig = {
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET,
  };

  // Don't let a signing/runtime failure 500 the post page; fall back to the
  // static default share image and surface the error for observability.
  let ogCard: string | undefined;
  try {
    ogCard = await buildSignedOgImageUrl(post.title, env.OG_SIGNATURE);
  } catch (error) {
    console.error(
      "buildSignedOgImageUrl failed for post",
      post.slug.current,
      error,
    );
  }
  return data(
    { post, imageConfig, ogCard, preview },
    preview ? { headers: PREVIEW_HEADERS } : undefined,
  );
}

export default function BlogPost() {
  const { post, imageConfig } = useLoaderData<typeof loader>();
  const heroSource = post.heroImage
    ? createImageUrlBuilder(imageConfig)
        .image(post.heroImage)
        .width(1600)
        .auto("format")
        .url()
    : undefined;
  const updatedAt = post.updatedAt;

  return (
    <div className="w-full flex-shrink-0 flex-col lg:w-auto">
      <div className="max-w-reading mx-2 lg:mx-0">
        <header className="mb-6">
          {post.publishedAt ? (
            <time
              dateTime={post.publishedAt}
              className="font-mono text-sm text-gray-500 dark:text-gray-400"
            >
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          ) : (
            <span className="text-secondary-500 font-mono text-sm font-bold">
              Draft preview
            </span>
          )}
          {updatedAt ? (
            <time
              dateTime={updatedAt}
              className="font-mono text-sm text-gray-500 dark:text-gray-400"
            >
              {" · Updated "}
              {new Date(updatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          ) : undefined}
          <h1 className="font-title mt-1 text-5xl font-bold">{post.title}</h1>
          {post.tags && post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag._id}
                  className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : undefined}
        </header>

        {heroSource ? (
          <img
            src={heroSource}
            alt={post.heroImage?.alt ?? post.title}
            className="mb-6 w-full rounded-md"
            loading="lazy"
          />
        ) : undefined}

        <Content>
          <PortableText value={post.body} imageConfig={imageConfig} />
        </Content>
      </div>
    </div>
  );
}
