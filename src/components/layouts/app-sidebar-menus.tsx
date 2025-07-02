"use client";
import { SidebarMenuButton, useSidebar } from "ui/sidebar";
import { Tooltip } from "ui/tooltip";
import { SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroupContent } from "ui/sidebar";

import { SidebarGroup } from "ui/sidebar";
import { TooltipProvider } from "ui/tooltip";
import Link from "next/link";
import { getShortcutKeyList, Shortcuts } from "lib/keyboard-shortcuts";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MCPIcon } from "ui/mcp-icon";
import { WriteIcon } from "ui/write-icon";

export function AppSidebarMenus() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Layout");
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem className="mb-1">
                <Link
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMobile(false);
                    router.push(`/`);
                    router.refresh();
                  }}
                >
                  <SidebarMenuButton
                    className="flex font-semibold group/new-chat"
                    isActive={pathname === "/"}
                  >
                    <WriteIcon className="size-4" />
                    {t("newChat")}
                    <div className="flex items-center gap-1 text-xs font-medium ml-auto opacity-0 group-hover/new-chat:opacity-100 transition-opacity">
                      {getShortcutKeyList(Shortcuts.openNewChat).map((key) => (
                        <span
                          key={key}
                          className="border w-5 h-5 flex items-center justify-center bg-accent rounded"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
        <SidebarMenu>
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem>
                <Link href="/integrations">
                  <SidebarMenuButton
                    className="font-semibold"
                    isActive={pathname === "/integrations"}
                  >
                    <MCPIcon className="size-4 fill-accent-foreground" />
                    MCP Integrations
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
