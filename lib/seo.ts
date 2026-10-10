import type {Metadata} from 'next';

// Keep production canonicals stable on preview deployments and query variants.
export const siteUrl = 'https://tropeaminepacks.vercel.app';
export const publicPaths = ['/', '/discover', '/series', '/packs', '/albums', '/odds', '/terms', '/privacy', '/data'] as const;
export const privatePaths = ['/admin', '/binder', '/quests', '/requests', '/login', '/auth', '/api', '/showcase', '/preview'];
export const privateMetadata: Metadata = {robots: {index: false, follow: false}};

export function canonicalMetadata(path: string): Metadata {
  return {alternates: {canonical: new URL(path, siteUrl).href}};
}
