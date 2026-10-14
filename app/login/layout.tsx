import { pageMetadata } from "@/lib/site-metadata";
export const metadata = pageMetadata(
  "Sign in",
  "Sign in or create an account to keep your Tropeamine collection.",
  "/login",
  false,
);
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
