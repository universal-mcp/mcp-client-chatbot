"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Session, User } from "better-auth";

import { AppSidebarMenus } from "./app-sidebar-menus";
import { AppSidebarThreads } from "./app-sidebar-threads";

import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import { AppSidebarUser } from "./app-sidebar-user";
import { WorkspacePicker } from "./workspace-picker";
import { PanelLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppSidebar({
  session,
}: { session?: { session: Session; user: User } }) {
  const { toggleSidebar, setOpenMobile } = useSidebar();
  const router = useRouter();
  const isMobile = useIsMobile();

  const currentPath = usePathname();

  // global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, Shortcuts.openNewChat)) {
        e.preventDefault();
        router.push("/chat");
        router.refresh();
      }
      if (isShortcutEvent(e, Shortcuts.toggleSidebar)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, toggleSidebar]);

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [currentPath, isMobile]);

  const isAuthenticated = !!session;

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarHeader className="p-2 border-b">
        {isAuthenticated ? (
          <WorkspacePicker />
        ) : (
          <div className="px-2 py-1 text-sm font-semibold">Wingmen</div>
        )}
      </SidebarHeader>

      <SidebarHeader className="p-0">
        {/* App Header */}
        <div className="p-2">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center justify-end gap-0.5">
              <SidebarMenuButton asChild className="hover:bg-transparent">
                <div
                  className="block sm:hidden"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMobile(false);
                  }}
                >
                  <PanelLeft className="size-4" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="mt-2 overflow-hidden relative">
        {isAuthenticated ? (
          <div className="flex flex-col gap-2 overflow-y-auto">
            <AppSidebarMenus />
            <AppSidebarThreads />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Welcome to Wingmen</p>
              <p className="text-xs mt-1">Sign in to get started</p>
            </div>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter className="flex flex-col items-stretch space-y-2">
        {isAuthenticated ? (
          <AppSidebarUser session={session} />
        ) : (
          <div className="p-2">
            <button
              onClick={() => router.push("/sign-in")}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold shadow hover:bg-primary/90"
            >
              Sign in
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
