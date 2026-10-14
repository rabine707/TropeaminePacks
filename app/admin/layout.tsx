import { pageMetadata } from "@/lib/site-metadata";
export const metadata = pageMetadata(
  "Creator studio",
  "Manage the Tropeamine card catalog and collector community.",
  "/admin",
  false,
);
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
