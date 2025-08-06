export const dynamic = "force-dynamic";

export default function LandingPageLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <main className="relative bg-background w-full h-screen">{children}</main>
  );
}
