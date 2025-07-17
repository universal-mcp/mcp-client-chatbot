import { selectMcpClientsAction } from "@/app/api/mcp/actions";
import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import { ChevronRight, Loader, Wrench } from "lucide-react";
import Link from "next/link";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";
import { Button } from "ui/button";
import { Checkbox } from "ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { MCPIcon } from "ui/mcp-icon";

import { handleErrorWithToast } from "ui/shared-toast";
import { useTranslations } from "next-intl";

import { Switch } from "ui/switch";
import { useShallow } from "zustand/shallow";

interface ToolSelectDropdownProps {
  align?: "start" | "end" | "center";
  side?: "left" | "right" | "top" | "bottom";
  disabled?: boolean;
}

export function ToolSelectDropdown({
  children,
  align,
  side,
  disabled,
}: PropsWithChildren<ToolSelectDropdownProps>) {
  const [appStoreMutate, toolChoice] = appStore(
    useShallow((state) => [state.mutate, state.toolChoice]),
  );
  const t = useTranslations("Chat.Tool");
  const { isLoading } = useSWR("mcp-list", selectMcpClientsAction, {
    refreshInterval: 1000 * 60 * 1,
    fallbackData: [],
    onError: handleErrorWithToast,
    onSuccess: (data) => {
      appStoreMutate({ mcpList: data });
    },
    revalidateOnFocus: false,
  });

  useEffect(() => {
    appStoreMutate({ isMcpClientListLoading: isLoading });
  }, [isLoading, appStoreMutate]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children ?? (
          <Button
            variant={"outline"}
            className={cn(
              "rounded-full font-semibold bg-secondary",
              toolChoice == "none" && "text-muted-foreground bg-transparent",
            )}
          >
            {isLoading ? (
              <Loader className="size-3.5 animate-spin" />
            ) : (
              <Wrench className="size-3.5 hidden sm:block" />
            )}
            Tools
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="md:w-72" align={align} side={side}>
        <DropdownMenuLabel>{t("toolsSetup")}</DropdownMenuLabel>
        <div className="py-2">
          <McpServerSelector />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function McpServerSelector() {
  const [appStoreMutate, allowedMcpServers, mcpServerList] = appStore(
    useShallow((state) => [
      state.mutate,
      state.allowedMcpServers,
      state.mcpList,
    ]),
  );

  const selectedMcpServerList = useMemo(() => {
    if (mcpServerList.length === 0) return [];
    return [...mcpServerList]
      .sort(
        (a, b) =>
          (a.oauthStatus.isAuthorized ? -1 : 1) -
          (b.oauthStatus.isAuthorized ? -1 : 1),
      )
      .map((server) => {
        const allowedTools: string[] =
          allowedMcpServers?.[server.id]?.tools ??
          server.toolInfo.map((tool) => tool.name);
        return {
          id: server.id,
          serverName: server.name,
          checked: allowedTools.length > 0,
          tools: server.toolInfo.map((tool) => ({
            name: tool.name,
            checked: allowedTools.includes(tool.name),
            description: tool.description,
          })),
          error: server.error,
          status: server.oauthStatus.isAuthorized,
        };
      });
  }, [mcpServerList, allowedMcpServers]);

  const setMcpServerTool = useCallback(
    (serverId: string, toolNames: string[]) => {
      appStoreMutate((prev) => {
        return {
          allowedMcpServers: {
            ...prev.allowedMcpServers,
            [serverId]: {
              ...(prev.allowedMcpServers?.[serverId] ?? {}),
              tools: toolNames,
            },
          },
        };
      });
    },
    [],
  );
  return (
    <DropdownMenuGroup>
      {!selectedMcpServerList.length ? (
        <div className="text-sm text-muted-foreground w-full h-full flex flex-col items-center justify-center py-6">
          <div>No MCP servers detected.</div>
          <Link href="/integrations">
            <Button
              variant={"ghost"}
              className="mt-2 text-primary flex items-center gap-1"
            >
              Add a server <ChevronRight className="size-4" />
            </Button>
          </Link>
        </div>
      ) : (
        selectedMcpServerList.map((server) => (
          <DropdownMenuSub key={server.id}>
            <DropdownMenuSubTrigger
              className="flex items-center gap-2 font-semibold cursor-pointer"
              icon={
                <div className="flex items-center gap-2 ml-auto">
                  {server.tools.filter((t) => t.checked).length > 0 ? (
                    <span className="w-5 h-5 items-center justify-center flex text-[8px] text-blue-500 font-normal rounded-full border border-border/40 bg-blue-500/5">
                      {server.tools.filter((t) => t.checked).length}
                    </span>
                  ) : null}

                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              }
              onClick={(e) => {
                e.preventDefault();
                setMcpServerTool(
                  server.id,
                  server.checked ? [] : server.tools.map((t) => t.name),
                );
              }}
            >
              <div className="flex items-center justify-center p-1 rounded bg-input/40 border">
                <MCPIcon className="fill-foreground size-2.5" />
              </div>

              <span className={cn("truncate", !server.checked && "opacity-30")}>
                {server.serverName}
              </span>
              {Boolean(server.error) ? (
                <span
                  className={cn("text-xs text-destructive ml-1 p-1 rounded")}
                >
                  error
                </span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-80 relative">
                <McpServerToolSelector
                  tools={server.tools}
                  checked={server.checked}
                  onClickAllChecked={(checked) => {
                    setMcpServerTool(
                      server.id,
                      checked ? server.tools.map((t) => t.name) : [],
                    );
                  }}
                  onToolClick={(toolName, checked) => {
                    const currentTools =
                      allowedMcpServers?.[server.id]?.tools ?? [];
                    setMcpServerTool(
                      server.id,
                      checked
                        ? [...currentTools, toolName]
                        : currentTools.filter((name) => name !== toolName),
                    );
                  }}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        ))
      )}
    </DropdownMenuGroup>
  );
}

interface McpServerToolSelectorProps {
  tools: {
    name: string;
    checked: boolean;
    description: string;
  }[];
  onClickAllChecked: (checked: boolean) => void;
  checked: boolean;
  onToolClick: (toolName: string, checked: boolean) => void;
}
function McpServerToolSelector({
  tools,
  onClickAllChecked,
  checked,
  onToolClick,
}: McpServerToolSelectorProps) {
  const t = useTranslations("Common");
  const [search, setSearch] = useState("");
  const filteredTools = useMemo(() => {
    return tools.filter((tool) =>
      tool.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tools, search]);
  return (
    <div>
      <DropdownMenuLabel
        className="text-muted-foreground flex items-center gap-2"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClickAllChecked(!checked);
        }}
      >
        <input
          autoFocus
          placeholder={t("search")}
          value={search}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="placeholder:text-muted-foreground flex w-full text-xs   outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex-1" />
        <Switch
          checked={checked}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClickAllChecked(!checked);
          }}
        />
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div className="max-h-96 overflow-y-auto">
        {filteredTools.length === 0 ? (
          <div className="text-sm text-muted-foreground w-full h-full flex items-center justify-center py-6">
            No tools available for this server.
          </div>
        ) : (
          filteredTools.map((tool) => (
            <DropdownMenuItem
              key={tool.name}
              className="flex items-center gap-2 cursor-pointer mb-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToolClick(tool.name, !tool.checked);
              }}
            >
              <div className="mx-1 flex-1 min-w-0">
                <p className="font-medium text-xs mb-1 truncate">{tool.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {tool.description}
                </p>
              </div>
              <Checkbox checked={tool.checked} className="ml-auto" />
            </DropdownMenuItem>
          ))
        )}
      </div>
    </div>
  );
}
