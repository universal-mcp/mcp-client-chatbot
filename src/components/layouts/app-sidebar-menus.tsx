"use client";
import { SidebarMenuButton } from "ui/sidebar";
import { Tooltip } from "ui/tooltip";
import { SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroupContent } from "ui/sidebar";

import { SidebarGroup } from "ui/sidebar";
import { TooltipProvider } from "ui/tooltip";
import Link from "next/link";
import { getShortcutKeyList, Shortcuts } from "lib/keyboard-shortcuts";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MCPIcon } from "ui/mcp-icon";
import { WriteIcon } from "ui/write-icon";
import { Bot } from "lucide-react";

export function AppSidebarMenus() {
  const pathname = usePathname();
  const t = useTranslations("Layout");
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem className="mb-1">
                <div
                  className={`flex items-center rounded-lg ${
                    pathname === "/" ? "bg-input!" : ""
                  }`}
                >
                  <SidebarMenuButton
                    asChild
                    className="flex font-semibold data-[active=true]:bg-transparent!"
                    isActive={pathname === "/"}
                  >
                    <Link href="/" className="flex items-center">
                      <WriteIcon className="size-4" />
                      {t("newChat")}
                      <div className="flex items-center gap-1 text-xs font-medium ml-auto opacity-0 group-hover/new-chat:opacity-100 transition-opacity">
                        {getShortcutKeyList(Shortcuts.openNewChat).map(
                          (key) => (
                            <span
                              key={key}
                              className="border w-5 h-5 flex items-center justify-center bg-accent rounded"
                            >
                              {key}
                            </span>
                          ),
                        )}
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </div>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
        <SidebarMenu>
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem className="mb-1">
                <div
                  className={`flex items-center rounded-lg ${
                    pathname === "/integrations" ? "bg-input!" : ""
                  }`}
                >
                  <SidebarMenuButton
                    asChild
                    className="font-semibold data-[active=true]:bg-transparent!"
                    isActive={pathname === "/integrations"}
                  >
                    <Link href="/integrations" className="flex items-center">
                      <MCPIcon className="size-4 fill-accent-foreground" />
                      MCP Integrations
                    </Link>
                  </SidebarMenuButton>
                </div>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
        <SidebarMenu>
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem>
                <div
                  className={`flex items-center rounded-lg ${
                    pathname === "/project" ? "bg-input!" : ""
                  }`}
                >
                  <SidebarMenuButton
                    asChild
                    className="font-semibold data-[active=true]:bg-transparent!"
                    isActive={pathname === "/project"}
                  >
                    <Link href="/project" className="flex items-center">
                      <Bot className="size-4" />
                      Agents
                    </Link>
                  </SidebarMenuButton>
                </div>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
