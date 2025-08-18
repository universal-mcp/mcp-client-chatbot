import { headers as getHeaders } from "next/headers";
import { auth } from "auth/server";
import { redirect } from "next/navigation";
import { SidebarProvider } from "ui/sidebar";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import UnauthenticatedChat from "@/components/unauthenticated-chat";
import { AppHeader } from "@/components/layouts/app-header";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const [headers] = await Promise.all([getHeaders()]);
  const session = await auth.api.getSession({ headers }).catch(() => null);

  if (session) {
    redirect("/chat");
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar session={undefined} />
      <main className="relative bg-background w-full flex flex-col h-screen">
        <AppHeader isAuthenticated={false} />
        <div className="flex-1 overflow-y-auto">
          <UnauthenticatedChat />
        </div>
      </main>
    </SidebarProvider>
  );
}
