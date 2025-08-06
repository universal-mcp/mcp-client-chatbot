import { selectMcpClientsAction } from "@/app/api/mcp/actions";
import {
  getProjectMcpToolsAction,
  bulkUpdateProjectMcpToolsAction,
} from "@/app/api/mcp/project-config/actions";
import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import {
  ChartColumn,
  ChevronRight,
  Loader,
  Wrench,
  HardDriveUploadIcon,
  Code,
  Check,
} from "lucide-react";
import Link from "next/link";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSWR, { mutate } from "swr";
import { Button } from "ui/button";
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
import { AppDefaultToolkit } from "lib/ai/tools";

import { handleErrorWithToast } from "ui/shared-toast";
import { useTranslations } from "next-intl";

import { Switch } from "ui/switch";
import { useShallow } from "zustand/shallow";
import { GlobalIcon } from "ui/global-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import type { ProjectMcpToolConfig } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";

interface ToolSelectDropdownProps {
  align?: "start" | "end" | "center";
  side?: "left" | "right" | "top" | "bottom";
  disabled?: boolean;
  projectId?: string; // New prop for project context
}

export function ToolSelectDropdown({
  children,
  align,
  side,
  disabled,
  projectId,
}: PropsWithChildren<ToolSelectDropdownProps>) {
  const [appStoreMutate, toolChoice] = appStore(
    useShallow((state) => [state.mutate, state.toolChoice]),
  );
  const t = useTranslations("Chat.Tool");
  const { isLoading } = useSWR("mcp-integrations", selectMcpClientsAction, {
    refreshInterval: 1000 * 60 * 1,
    fallbackData: [],
    onError: handleErrorWithToast,
    onSuccess: (data) => {
      appStoreMutate({ mcpList: data });
    },
    revalidateOnFocus: false,
  });

  // Fetch project tool configurations if projectId is provided
  const { data: projectToolConfigs, isLoading: isProjectConfigLoading } =
    useSWR(
      projectId ? `project-mcp-tools-${projectId}` : null,
      async () => {
        if (!projectId) return [];
        return await getProjectMcpToolsAction(projectId);
      },
      {
        revalidateOnFocus: false,
        onError: handleErrorWithToast,
      },
    );

  useEffect(() => {
    appStoreMutate({ isMcpClientListLoading: isLoading });
  }, [isLoading, appStoreMutate]);

  // Local state for project tool changes
  const [localProjectToolConfigs, setLocalProjectToolConfigs] = useState<
    ProjectMcpToolConfig[]
  >([]);
  const [initialProjectToolConfigs, setInitialProjectToolConfigs] = useState<
    ProjectMcpToolConfig[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local configs when project configs are loaded
  useEffect(() => {
    if (projectToolConfigs && projectId) {
      setLocalProjectToolConfigs(projectToolConfigs);
      setInitialProjectToolConfigs(projectToolConfigs);
    }
  }, [projectToolConfigs, projectId]);

  // Check if current config differs from initial config using hash comparison
  const hasChanges = useMemo(() => {
    if (!projectId) return false;

    const createConfigHash = (configs: ProjectMcpToolConfig[]) => {
      // Sort configs to ensure consistent hash
      const sortedConfigs = [...configs].sort((a, b) => {
        const aKey = `${a.mcpServerId || "default"}:${a.toolName}`;
        const bKey = `${b.mcpServerId || "default"}:${b.toolName}`;
        return aKey.localeCompare(bKey);
      });

      return JSON.stringify(
        sortedConfigs.map((config) => ({
          mcpServerId: config.mcpServerId,
          toolName: config.toolName,
          enabled: config.enabled,
          mode: config.mode,
        })),
      );
    };

    const currentHash = createConfigHash(localProjectToolConfigs);
    const initialHash = createConfigHash(initialProjectToolConfigs);

    return currentHash !== initialHash;
  }, [projectId, localProjectToolConfigs, initialProjectToolConfigs]);

  // Handle local project tool updates (no DB call)
  const updateLocalProjectToolConfig = useCallback(
    (
      toolName: string,
      enabled: boolean,
      mode: "auto" | "manual" = "auto",
      serverId?: string,
    ) => {
      if (!projectId) return;

      const currentConfigs = localProjectToolConfigs || [];
      const mcpServerId =
        serverId === "default_tools" ? null : serverId || null;
      const existingConfigIndex = currentConfigs.findIndex(
        (config) =>
          config.toolName === toolName && config.mcpServerId === mcpServerId,
      );

      let newConfigs: ProjectMcpToolConfig[];

      if (enabled) {
        if (existingConfigIndex >= 0) {
          // Update existing config
          newConfigs = [...currentConfigs];
          newConfigs[existingConfigIndex] = {
            ...newConfigs[existingConfigIndex],
            enabled: true,
            mode,
          };
        } else {
          // Add new config
          newConfigs = [
            ...currentConfigs,
            {
              mcpServerId,
              toolName,
              enabled: true,
              mode,
            },
          ];
        }
      } else {
        if (existingConfigIndex >= 0) {
          // Remove the config
          newConfigs = currentConfigs.filter(
            (_, index) => index !== existingConfigIndex,
          );
        } else {
          // No change needed
          newConfigs = currentConfigs;
        }
      }

      setLocalProjectToolConfigs(newConfigs);
    },
    [projectId, localProjectToolConfigs],
  );

  // Save project tool changes to database
  const saveProjectToolConfigs = useCallback(async () => {
    if (!projectId) return;

    setIsSaving(true);
    try {
      await bulkUpdateProjectMcpToolsAction(projectId, localProjectToolConfigs);

      // Refetch the project configs
      mutate(`project-mcp-tools-${projectId}`);
    } catch (error) {
      console.error("Failed to save project tool config:", error);
      handleErrorWithToast(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, localProjectToolConfigs]);

  // Tool mode toggle handler for non-project context
  const handleToolModeChange = useCallback(() => {
    appStoreMutate(({ toolChoice }) => {
      return {
        toolChoice:
          toolChoice === "auto" || toolChoice === "none" ? "manual" : "auto",
      };
    });
  }, [appStoreMutate]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children ?? (
          <Button
            variant={"outline"}
            disabled={disabled}
            className={cn(
              "rounded-full font-semibold bg-secondary",
              toolChoice == "none" && "text-muted-foreground bg-transparent",
              disabled && "opacity-50 cursor-not-allowed",
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
      <DropdownMenuContent className="md:w-80" align={align} side={side}>
        {isProjectConfigLoading && projectId ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>{t("toolsSetup")}</span>
              {/* Show tool mode toggle only when outside project context */}
              {!projectId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleToolModeChange}
                    >
                      {toolChoice === "auto" || toolChoice === "none"
                        ? "Auto"
                        : "Manual"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {toolChoice === "auto" || toolChoice === "none"
                      ? t("autoToolModeDescription")
                      : t("manualToolModeDescription")}
                  </TooltipContent>
                </Tooltip>
              )}
            </DropdownMenuLabel>
            <div className="py-2">
              <McpServerSelector
                projectId={projectId}
                projectToolConfigs={
                  projectId ? localProjectToolConfigs : projectToolConfigs || []
                }
                updateProjectToolConfig={updateLocalProjectToolConfig}
              />
            </div>
            <div className="py-1">
              <DropdownMenuSeparator />
            </div>
            <AppDefaultToolKitSelector
              projectId={projectId}
              projectToolConfigs={localProjectToolConfigs}
              updateProjectToolConfig={updateLocalProjectToolConfig}
            />

            {/* Save button for project context */}
            {projectId && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button
                    onClick={saveProjectToolConfigs}
                    className="w-full"
                    size="sm"
                    disabled={isSaving || !hasChanges}
                    variant={hasChanges ? "default" : "secondary"}
                  >
                    {isSaving ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Create default tools server for project context
const createDefaultToolsServer = (): any => {
  return {
    id: "default_tools",
    name: "Default_Tools",
    toolInfo: [
      {
        name: AppDefaultToolkit.Visualization,
        description: "Chart Tools",
      },
      { name: AppDefaultToolkit.WebSearch, description: "Web Search" },
      { name: AppDefaultToolkit.Http, description: "HTTP" },
      {
        name: AppDefaultToolkit.Code,
        description: "Code",
      },
    ],
  };
};

function McpServerSelector({
  projectId,
  projectToolConfigs,
  updateProjectToolConfig,
}: {
  projectId?: string;
  projectToolConfigs: ProjectMcpToolConfig[];
  updateProjectToolConfig?: (
    toolName: string,
    enabled: boolean,
    mode?: "auto" | "manual",
    serverId?: string,
  ) => void;
}) {
  const [appStoreMutate, allowedMcpServers, mcpServerList] = appStore(
    useShallow((state) => [
      state.mutate,
      state.allowedMcpServers,
      state.mcpList,
    ]),
  );

  // Create default tools server for project context
  const allServers = useMemo(() => {
    const defaultServer = createDefaultToolsServer();
    return [defaultServer, ...mcpServerList];
  }, [mcpServerList]);

  // Create a map of project tool configs for easy lookup
  const projectToolConfigMap = useMemo(() => {
    const map = new Map<string, ProjectMcpToolConfig>();
    for (const config of projectToolConfigs) {
      const key =
        config.mcpServerId === null
          ? `default_tools:${config.toolName}`
          : `${config.mcpServerId}:${config.toolName}`;
      map.set(key, config);
    }
    return map;
  }, [projectToolConfigs]);

  const selectedMcpServerList = useMemo(() => {
    if (allServers.length === 0) return [];

    // Filter out default tools server in both contexts (they're shown in AppDefaultToolKitSelector)
    const filteredServers = allServers.filter(
      (server) => server.id !== "default_tools",
    );

    return [...filteredServers]
      .sort(
        (a, b) =>
          (a.oauthStatus?.isAuthorized ? -1 : 1) -
          (b.oauthStatus?.isAuthorized ? -1 : 1),
      )
      .map((server) => {
        // For project context, use project configs
        if (projectId) {
          const projectTools = server.toolInfo.map((tool) => {
            const key =
              server.id === "default_tools"
                ? `default_tools:${tool.name}`
                : `${server.id}:${tool.name}`;
            const config = projectToolConfigMap.get(key);

            return {
              name: tool.name,
              checked: config?.enabled ?? false,
              description: tool.description,
              mode: config?.mode ?? "auto",
            };
          });

          const enabledToolsCount = projectTools.filter(
            (t) => t.checked,
          ).length;

          return {
            id: server.id,
            serverName: server.name,
            checked: enabledToolsCount > 0,
            tools: projectTools,
            error: server.error,
            status: server.oauthStatus?.isAuthorized ?? true,
            isDefaultTools: server.id === "default_tools",
          };
        } else {
          // For global context, use existing logic
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
              mode: "auto" as const,
            })),
            error: server.error,
            status: server.oauthStatus?.isAuthorized ?? true,
            isDefaultTools: server.id === "default_tools",
          };
        }
      });
  }, [allServers, allowedMcpServers, projectId, projectToolConfigMap]);

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
            >
              <div className="flex items-center justify-center p-1 rounded bg-input/40 border">
                {server.isDefaultTools ? (
                  <Wrench className="fill-foreground size-2.5" />
                ) : (
                  <MCPIcon className="fill-foreground size-2.5" />
                )}
              </div>

              <span className={cn("truncate", !server.checked && "opacity-30")}>
                {server.serverName}
              </span>
              {Boolean(server.error) ? (
                <span
                  className={cn(
                    "text-xs text-yellow-600 ml-1 p-1 rounded flex items-center gap-1",
                  )}
                >
                  Disconnected
                </span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-80 relative">
                <McpServerToolSelector
                  tools={server.tools}
                  checked={server.checked}
                  projectId={projectId}
                  onClickAllChecked={(checked) => {
                    if (!projectId) {
                      setMcpServerTool(
                        server.id,
                        checked ? server.tools.map((t) => t.name) : [],
                      );
                    } else if (updateProjectToolConfig) {
                      // Project context - toggle all tools
                      const currentTools = server.tools.map((t) => t.name);
                      currentTools.forEach((toolName) => {
                        updateProjectToolConfig(
                          toolName,
                          checked,
                          "auto",
                          server.id,
                        );
                      });
                    }
                  }}
                  onToolClick={(toolName, checked, mode) => {
                    if (projectId && updateProjectToolConfig) {
                      // Handle project-specific tool updates
                      updateProjectToolConfig(
                        toolName,
                        checked,
                        mode,
                        server.id,
                      );
                    } else {
                      const currentTools =
                        allowedMcpServers?.[server.id]?.tools ?? [];
                      setMcpServerTool(
                        server.id,
                        checked
                          ? [...currentTools, toolName]
                          : currentTools.filter((name) => name !== toolName),
                      );
                    }
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
    mode?: "auto" | "manual";
  }[];
  onClickAllChecked: (checked: boolean) => void;
  checked: boolean;
  projectId?: string;
  onToolClick: (
    toolName: string,
    checked: boolean,
    mode?: "auto" | "manual",
  ) => void;
}

function McpServerToolSelector({
  tools,
  onClickAllChecked,
  checked,
  projectId,
  onToolClick,
}: McpServerToolSelectorProps) {
  const t = useTranslations("Common");
  const [search, setSearch] = useState("");
  const filteredTools = useMemo(() => {
    return tools.filter((tool) =>
      tool.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tools, search]);

  const isProjectContext = !!projectId;

  return (
    <div>
      <DropdownMenuLabel
        className="text-muted-foreground flex items-center gap-2"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isProjectContext) {
            onClickAllChecked(!checked);
          }
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
          className="placeholder:text-muted-foreground flex w-full text-xs outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex-1" />
        {!isProjectContext && (
          <Switch
            checked={checked}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClickAllChecked(!checked);
            }}
          />
        )}
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
                onToolClick(tool.name, !tool.checked, tool.mode);
              }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {tool.checked ? (
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="h-4 w-4 border-muted-foreground rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs mb-1 truncate">
                    {tool.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </p>
                </div>
              </div>
              {isProjectContext && tool.checked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 px-1.5 text-xs font-medium flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToolClick(
                      tool.name,
                      tool.checked,
                      tool.mode === "auto" ? "manual" : "auto",
                    );
                  }}
                >
                  {tool.mode === "auto" ? "Auto" : "Manual"}
                </Button>
              )}
            </DropdownMenuItem>
          ))
        )}
      </div>
    </div>
  );
}

function AppDefaultToolKitSelector({
  projectId,
  projectToolConfigs,
  updateProjectToolConfig,
}: {
  projectId?: string;
  projectToolConfigs: ProjectMcpToolConfig[];
  updateProjectToolConfig?: (
    toolName: string,
    enabled: boolean,
    mode?: "auto" | "manual",
    serverId?: string,
  ) => void;
}) {
  const [appStoreMutate, allowedAppDefaultToolkit] = appStore(
    useShallow((state) => [state.mutate, state.allowedAppDefaultToolkit]),
  );
  const t = useTranslations();

  // Create a map of project tool configs for default tools
  const projectDefaultToolConfigMap = useMemo(() => {
    const map = new Map<string, ProjectMcpToolConfig>();
    for (const config of projectToolConfigs) {
      if (config.mcpServerId === null) {
        map.set(config.toolName, config);
      }
    }
    return map;
  }, [projectToolConfigs]);

  const toggleAppDefaultToolkit = useCallback(
    (toolkit: AppDefaultToolkit) => {
      if (projectId && updateProjectToolConfig) {
        // Handle project-specific toggle
        const projectConfig = projectDefaultToolConfigMap.get(toolkit);
        const isCurrentlyEnabled = projectConfig?.enabled ?? false;
        updateProjectToolConfig(
          toolkit,
          !isCurrentlyEnabled,
          "auto",
          "default_tools",
        );
      } else {
        appStoreMutate((prev) => {
          const newAllowedAppDefaultToolkit = [
            ...(prev.allowedAppDefaultToolkit ?? []),
          ];
          if (newAllowedAppDefaultToolkit.includes(toolkit)) {
            newAllowedAppDefaultToolkit.splice(
              newAllowedAppDefaultToolkit.indexOf(toolkit),
              1,
            );
          } else {
            newAllowedAppDefaultToolkit.push(toolkit);
          }
          return { allowedAppDefaultToolkit: newAllowedAppDefaultToolkit };
        });
      }
    },
    [
      projectId,
      appStoreMutate,
      projectDefaultToolConfigMap,
      updateProjectToolConfig,
    ],
  );

  const defaultToolInfo = useMemo(() => {
    const raw = t.raw("Chat.Tool.defaultToolKit");
    return Object.values(AppDefaultToolkit).map((toolkit) => {
      const label = raw[toolkit] || toolkit;
      const id = toolkit;
      let icon = <Wrench className="size-3.5 text-primary" />;
      switch (toolkit) {
        case AppDefaultToolkit.Visualization:
          icon = <ChartColumn className="size-3.5 text-blue-500 stroke-3" />;
          break;
        case AppDefaultToolkit.WebSearch:
          icon = <GlobalIcon className="text-blue-400 size-3.5" />;
          break;
        case AppDefaultToolkit.Http:
          icon = <HardDriveUploadIcon className="size-3.5 text-blue-400" />;
          break;
        case AppDefaultToolkit.Code:
          icon = <Code className="size-3.5 text-blue-400" />;
          break;
      }

      // Check if this tool is enabled in project context
      const projectConfig = projectDefaultToolConfigMap.get(toolkit);
      const isEnabled = projectId
        ? (projectConfig?.enabled ?? false)
        : (allowedAppDefaultToolkit?.includes(toolkit) ?? false);

      return {
        label,
        id,
        icon,
        isEnabled,
        mode: projectConfig?.mode,
      };
    });
  }, [t, projectId, projectDefaultToolConfigMap, allowedAppDefaultToolkit]);

  return (
    <DropdownMenuGroup>
      {defaultToolInfo.map((tool) => {
        return (
          <DropdownMenuItem
            key={tool.id}
            className="cursor-pointer font-semibold text-xs"
            onClick={(e) => {
              e.preventDefault();
              toggleAppDefaultToolkit(tool.id);
            }}
          >
            {tool.icon}
            {tool.label}
            <div className="flex items-center gap-2 ml-auto">
              <Switch className="ml-auto" checked={tool.isEnabled} />
            </div>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuGroup>
  );
}
