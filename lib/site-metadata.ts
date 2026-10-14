import type { Metadata } from "next";
export const SITE_URL = "https://tropeaminepacks.vercel.app";
export const SITE_NAME = "Tropeamine Packs";
export const SITE_DESCRIPTION =
  "Collect the characters you love. Open packs, complete your binder, and shape the next chapter.";
export const PUBLIC_ROUTES = [
  "/",
  "/discover",
  "/packs",
  "/requests",
  "/showcase",
  "/albums",
  "/odds",
  "/terms",
  "/privacy",
  "/data",
] as const;
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  index = true,
): Metadata {
  const fullTitle = `${title} — ${SITE_NAME}`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      type: "website",
      siteName: SITE_NAME,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Tropeamine Packs — A shelf beyond the story",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/opengraph-image"],
    },
  };
}
