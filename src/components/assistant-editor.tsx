"use client";

import {
  insertProjectAction,
  selectProjectByIdAction,
  updateProjectAction,
} from "@/app/api/chat/actions";
import {
  bulkUpdateProjectMcpToolsAction,
  getProjectMcpToolsAction,
} from "@/app/api/mcp/project-config/actions";
import { selectMcpClientsAction } from "@/app/api/mcp/actions";
import { useObjectState } from "@/hooks/use-object-state";
import { Project } from "app-types/chat";
import { MCPServerInfo } from "app-types/mcp";
import {
  Loader,
  ChevronDown,
  Check,
  Search,
  MessagesSquare,
  Settings,
  ArrowLeft,
  XIcon,
  ChartColumn,
  Wrench,
  HardDriveUploadIcon,
  Code,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { handleErrorWithToast } from "ui/shared-toast";
import { toast } from "sonner";
import { Badge } from "ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "ui/popover";
import Tiptap from "@/components/tiptap";
import { ProjectConversationsModal } from "@/components/project-conversations-modal";
import { AppDefaultToolkit } from "lib/ai/tools";
import { GlobalIcon } from "ui/global-icon";

type MCPServerWithId = MCPServerInfo & { id: string };

type LocalServerConfig = { id: string; name: string; enabled: boolean };
type LocalToolConfig = {
  mcpServerId: string | null; // null for default tools
  toolName: string;
  enabled: boolean;
  mode: "auto" | "manual";
};

const defaultConfig = () => ({
  name: "",
  description: "",
  instructions: {
    systemPrompt: "",
    expert: "",
  },
});

interface AssistantEditorProps {
  projectId?: string; // undefined for new project, string for existing project
  onSave?: (project: Project) => void;
  isNewProject?: boolean;
}

export function AssistantEditor({
  projectId,
  onSave,
  isNewProject = false,
}: AssistantEditorProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [project, setProject] = useObjectState(defaultConfig());
  const [isConversationsModalOpen, setIsConversationsModalOpen] =
    useState(false);

  // MCP Configuration state
  const [mcpServers, setMcpServers] = useState<MCPServerWithId[]>([]);
  const [originalServerConfigs, setOriginalServerConfigs] = useState<
    LocalServerConfig[]
  >([]);
  const [originalToolConfigs, setOriginalToolConfigs] = useState<
    Map<string, LocalToolConfig>
  >(new Map());
  const [serverConfigs, setServerConfigs] = useState<LocalServerConfig[]>([]);
  const [toolConfigs, setToolConfigs] = useState<Map<string, LocalToolConfig>>(
    new Map(),
  );
  const [hasMcpChanges, setHasMcpChanges] = useState(false);
  const [isMcpPopupOpen, setIsMcpPopupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMcpDataLoaded, setIsMcpDataLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Create default tools server
  const createDefaultToolsServer = useCallback((): MCPServerWithId => {
    return {
      id: "default_tools", // Special ID for default tools (UI only)
      name: "Default_Tools",
      config: {
        url: "default://tools",
        credentialType: "personal",
      },
      toolInfo: [
        {
          name: AppDefaultToolkit.Visualization,
          description: "Create a pie chart",
        },
        { name: AppDefaultToolkit.WebSearch, description: "Search the web" },
        { name: AppDefaultToolkit.Http, description: "Send an http request" },
        {
          name: AppDefaultToolkit.Code,
          description: "Execute simple python code",
        },
      ],
      oauthStatus: {
        required: false,
        isAuthorized: true,
        hasToken: true,
      },
    };
  }, []);

  // Get icon for default tool
  const getDefaultToolIcon = useCallback((toolName: AppDefaultToolkit) => {
    switch (toolName) {
      case AppDefaultToolkit.Visualization:
        return <ChartColumn className="size-3.5 text-blue-500 stroke-3" />;
      case AppDefaultToolkit.WebSearch:
        return <GlobalIcon className="text-blue-400 size-3.5" />;
      case AppDefaultToolkit.Http:
        return <HardDriveUploadIcon className="size-3.5 text-blue-400" />;
      case AppDefaultToolkit.Code:
        return <Code className="size-3.5 text-blue-400" />;
      default:
        return <Wrench className="size-3.5 text-primary" />;
    }
  }, []);

  // Load project data with threads (only for existing projects)
  const { data: projectData, isLoading: isProjectLoading } = useSWR(
    projectId ? `/projects/${projectId}` : null,
    async () => {
      if (!projectId) return null;
      const project = await selectProjectByIdAction(projectId);
      if (!project) {
        router.push("/");
      }
      return project;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateIfHidden: false,
      onError: (error) => {
        handleErrorWithToast(error);
        router.push(`/`);
      },
      onSuccess: (data) => {
        if (data) {
          setProject({
            name: data.name || "",
            description: data.description || "",
            instructions: data.instructions || { systemPrompt: "", expert: "" },
          });
        } else if (projectId) {
          toast.error(`Project not found`);
          router.push(`/`);
        }
      },
    },
  );

  // Ensure project state is synchronized with loaded data
  useEffect(() => {
    if (projectData && !isProjectLoading && !isNewProject) {
      setProject({
        name: projectData.name || "",
        description: projectData.description || "",
        instructions: projectData.instructions || {
          systemPrompt: "",
          expert: "",
        },
      });
    }
  }, [projectData, isProjectLoading, isNewProject]);

  // Handle template data from URL parameters for new projects
  useEffect(() => {
    if (isNewProject) {
      const templateParam = searchParams.get("template");
      if (templateParam) {
        try {
          const template = JSON.parse(decodeURIComponent(templateParam));
          setProject({
            name: template.name || "",
            description: template.description || "",
            instructions: {
              systemPrompt: template.instructions || "",
              expert: template.expert || "",
            },
          });
        } catch (error) {
          console.error("Failed to parse template data:", error);
        }
      }
    }
  }, [isNewProject, searchParams]);

  // Load MCP data
  useEffect(() => {
    async function loadMcpData() {
      try {
        const servers = await selectMcpClientsAction();
        const defaultServer = createDefaultToolsServer();
        const allServers = [defaultServer, ...servers];
        setMcpServers(allServers);

        if (projectId) {
          const toolConfigsData = await getProjectMcpToolsAction(projectId);
          const toolConfigMap = new Map();

          // Process tool configs from database
          for (const config of toolConfigsData) {
            if (config.mcpServerId === null) {
              // Default tool - use special key
              toolConfigMap.set(`default_tools:${config.toolName}`, config);
            } else {
              // MCP tool - use server ID
              toolConfigMap.set(
                `${config.mcpServerId}:${config.toolName}`,
                config,
              );
            }
          }

          const enabledServerIds = new Set(
            toolConfigsData
              .filter((c) => c.mcpServerId !== null)
              .map((c) => c.mcpServerId as string),
          );

          const initialServerConfigs = allServers.map((server) => ({
            id: server.id || "unknown",
            name: server.name,
            enabled: enabledServerIds.has(server.id || "unknown"),
          }));

          setOriginalServerConfigs(initialServerConfigs);
          setServerConfigs(initialServerConfigs);
          setOriginalToolConfigs(toolConfigMap);
          setToolConfigs(toolConfigMap);
        } else {
          // For new projects, initialize with empty configs
          setOriginalServerConfigs([]);
          setServerConfigs([]);
          setOriginalToolConfigs(new Map());
          setToolConfigs(new Map());
        }

        setIsMcpDataLoaded(true);
      } catch (error) {
        console.error("Failed to load MCP configuration:", error);
        if (error instanceof Error) {
          handleErrorWithToast(error);
        } else {
          handleErrorWithToast(new Error("Failed to load MCP configuration"));
        }
        setIsMcpDataLoaded(true); // Set to true even on error to prevent infinite loading
      }
    }

    loadMcpData();
  }, [projectId, createDefaultToolsServer]);

  // Track MCP changes
  useEffect(() => {
    const serverChanges =
      JSON.stringify(serverConfigs) !== JSON.stringify(originalServerConfigs);
    const toolChanges =
      JSON.stringify(Array.from(toolConfigs.entries())) !==
      JSON.stringify(Array.from(originalToolConfigs.entries()));
    const newHasChanges = serverChanges || toolChanges;
    setHasMcpChanges(newHasChanges);
  }, [serverConfigs, toolConfigs, originalServerConfigs, originalToolConfigs]);

  const saveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isNewProject) {
        // Create new project
        const newProject = await insertProjectAction({
          name: project.name,
          description: project.description,
          instructions: project.instructions,
        });

        // Save MCP configuration for new project
        const currentToolConfigs = new Map(toolConfigs);
        const enabledServerIds = new Set(
          serverConfigs.filter((s) => s.enabled).map((s) => s.id),
        );

        for (const [key, config] of currentToolConfigs.entries()) {
          // For default tools (null serverId), always allow them to be enabled
          if (
            config.mcpServerId !== null &&
            !enabledServerIds.has(config.mcpServerId as string) &&
            config.enabled
          ) {
            currentToolConfigs.set(key, { ...config, enabled: false });
          }
        }

        // Save all enabled tools (including default tools with null serverId)
        const toolConfigsToSave = Array.from(
          currentToolConfigs.values(),
        ).filter((config) => config.enabled);

        if (toolConfigsToSave.length > 0) {
          await bulkUpdateProjectMcpToolsAction(
            newProject.id,
            toolConfigsToSave,
          );
        }

        mutate("projects");
        toast.success("Assistant created successfully");

        if (onSave) {
          onSave(newProject);
        } else {
          router.push(`/project/${newProject.id}`);
        }
      } else if (projectId) {
        // Update existing project
        await updateProjectAction(projectId, {
          name: project.name,
          description: project.description,
          instructions: project.instructions,
        });

        // Only save MCP configuration if there are changes
        if (hasMcpChanges) {
          const currentToolConfigs = new Map(toolConfigs);
          const enabledServerIds = new Set(
            serverConfigs.filter((s) => s.enabled).map((s) => s.id),
          );

          for (const [key, config] of currentToolConfigs.entries()) {
            // For default tools (null serverId), always allow them to be enabled
            if (
              config.mcpServerId !== null &&
              !enabledServerIds.has(config.mcpServerId as string) &&
              config.enabled
            ) {
              currentToolConfigs.set(key, { ...config, enabled: false });
            }
          }

          // Save all enabled tools (including default tools with null serverId)
          const toolConfigsToSave = Array.from(
            currentToolConfigs.values(),
          ).filter((config) => config.enabled);

          await bulkUpdateProjectMcpToolsAction(projectId, toolConfigsToSave);

          setToolConfigs(currentToolConfigs);
          setOriginalServerConfigs([...serverConfigs]);
          setOriginalToolConfigs(new Map(currentToolConfigs));
          setHasMcpChanges(false);
        }

        mutate(`/projects/${projectId}`);
        toast.success("Assistant saved successfully");

        if (onSave && projectData) {
          onSave(projectData);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        handleErrorWithToast(error);
      } else {
        handleErrorWithToast(new Error("Failed to save assistant"));
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    projectId,
    project,
    serverConfigs,
    toolConfigs,
    hasMcpChanges,
    isNewProject,
    onSave,
    router,
    projectData,
  ]);

  const handleServerToggle = useCallback(
    (serverId: string, enabled: boolean) => {
      setServerConfigs((prev) => {
        const existing = prev.find((s) => s.id === serverId);
        if (existing) {
          return prev.map((s) => (s.id === serverId ? { ...s, enabled } : s));
        }
        const server = mcpServers.find((s) => s.id === serverId);
        return server
          ? [...prev, { id: serverId, name: server.name, enabled }]
          : prev;
      });

      const server = mcpServers.find((s) => s.id === serverId);
      if (!server) return;

      const newToolUpdates = new Map<string, LocalToolConfig>();
      for (const tool of server.toolInfo) {
        const key = `${serverId}:${tool.name}`;
        const existing =
          toolConfigs.get(key) || getToolConfig(serverId, tool.name);
        newToolUpdates.set(key, { ...existing, enabled });
      }

      setToolConfigs((prev) => new Map([...prev, ...newToolUpdates]));
    },
    [mcpServers, toolConfigs],
  );

  const handleToolUpdate = useCallback(
    (
      serverId: string,
      toolName: string,
      update: { enabled?: boolean; mode?: "auto" | "manual" },
    ) => {
      const key = `${serverId}:${toolName}`;
      setToolConfigs((prev) => {
        const newConfigs = new Map(prev);
        const existing =
          newConfigs.get(key) || getToolConfig(serverId, toolName);
        newConfigs.set(key, { ...existing, ...update });
        return newConfigs;
      });

      if (update.enabled) {
        const serverConfig = getServerConfig(serverId);
        if (!serverConfig || !serverConfig.enabled) {
          setServerConfigs((prev) => {
            const existing = prev.find((s) => s.id === serverId);
            if (existing) {
              return prev.map((s) =>
                s.id === serverId ? { ...s, enabled: true } : s,
              );
            }
            const server = mcpServers.find((s) => s.id === serverId);
            return server
              ? [...prev, { id: serverId, name: server.name, enabled: true }]
              : prev;
          });
        }
      }
    },
    [mcpServers],
  );

  const getServerConfig = useCallback(
    (serverId: string) => {
      return serverConfigs.find((s) => s.id === serverId);
    },
    [serverConfigs],
  );

  const getToolConfig = useCallback(
    (serverId: string, toolName: string) => {
      const key = `${serverId}:${toolName}`;
      return (
        toolConfigs.get(key) || {
          mcpServerId: serverId === "default_tools" ? null : serverId,
          toolName,
          enabled: false,
          mode: "auto" as const,
        }
      );
    },
    [toolConfigs],
  );

  // Filter servers and tools based on search query
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) {
      return mcpServers;
    }

    return mcpServers
      .map((server) => {
        const filteredTools = server.toolInfo.filter((tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );

        if (filteredTools.length === 0) {
          return null;
        }

        return {
          ...server,
          toolInfo: filteredTools,
        };
      })
      .filter(Boolean) as MCPServerWithId[];
  }, [mcpServers, searchQuery]);

  const isLoading = (!isNewProject && isProjectLoading) || isSaving;
  const isFullyLoaded = isNewProject || (!isProjectLoading && isMcpDataLoaded);

  // Calculate selected tools count for display
  const selectedToolsCount = useMemo(() => {
    return Array.from(toolConfigs.values()).filter((config) => config.enabled)
      .length;
  }, [toolConfigs]);

  // Show loading state until all data is loaded
  if (!isFullyLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="flex flex-col gap-6 px-8 pb-4 max-w-3xl mx-auto min-h-full">
        <div className="sticky top-0 bg-background z-10 flex flex-col gap-4 pb-6 pt-4">
          {/* Back Button - Only for new projects */}
          {isNewProject && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </Button>
            </div>
          )}

          {/* Title */}
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">
              {isNewProject ? "Create Assistant" : t("Chat.Project.project")}
            </p>
            {!isNewProject && projectData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConversationsModalOpen(true)}
                className="flex items-center gap-2"
              >
                <MessagesSquare className="h-4 w-4" />
                Past conversations
                {projectData?.threads && projectData.threads.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {projectData.threads.length}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Project Name */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-name" className="text-sm font-medium">
            Give your assistant a name
          </Label>
          <Input
            value={project.name || ""}
            onChange={(e) => setProject({ name: e.target.value })}
            disabled={isLoading}
            className="hover:bg-input bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0! placeholder:text-xs"
            id="project-name"
            placeholder="Deep Research"
          />
        </div>

        {/* Project Description */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-description" className="text-sm font-medium">
            Describe your assistant in a few words
          </Label>
          <Input
            value={project.description || ""}
            onChange={(e) => setProject({ description: e.target.value })}
            disabled={isLoading}
            className="hover:bg-input bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0! placeholder:text-xs"
            id="project-description"
            placeholder="Performs deep research on a given topic"
          />
        </div>

        {/* Expert Instructions */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="project-expert" className="text-sm font-medium">
              This assistant is an expert in
            </Label>
            <Input
              value={project.instructions?.expert || ""}
              onChange={(e) =>
                setProject({
                  instructions: {
                    ...project.instructions,
                    expert: e.target.value || "",
                  },
                })
              }
              disabled={isLoading}
              className="w-64 hover:bg-input bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0! placeholder:text-xs"
              id="project-expert"
              placeholder="collating loads of data"
            />
          </div>
        </div>

        {/* Project Instructions */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-instructions" className="text-sm font-medium">
            Feel free to write the agent's role, personality, knowledge and any
            other information.
          </Label>
          <Tiptap
            value={project.instructions?.systemPrompt || ""}
            onChange={(value) =>
              setProject({
                instructions: {
                  ...project.instructions,
                  systemPrompt: value || "",
                },
              })
            }
            placeholder="You are a helpful assistant that can perform deep research and help with tasks..."
          />
        </div>

        {/* Tool Configuration */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-tools" className="text-sm font-medium">
            Tools
          </Label>
          <Popover open={isMcpPopupOpen} onOpenChange={setIsMcpPopupOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={triggerRef}
                variant="outline"
                className="w-full justify-between hover:bg-input bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0! min-h-12 p-3 h-auto"
                disabled={isLoading}
              >
                <div className="flex flex-col items-start gap-2 flex-1 min-w-0">
                  {selectedToolsCount > 0 && (
                    <div className="flex flex-wrap gap-1 w-full">
                      {Array.from(toolConfigs.entries()).map(
                        ([key, config]) => {
                          if (!config.enabled) return null;

                          const [serverId, toolName] = key.split(":");
                          const server = mcpServers.find(
                            (s) => s.id === serverId,
                          );
                          const serverName = server?.name || "Unknown Server";

                          // For default tools, don't show server name
                          const displayName =
                            serverId === "default_tools"
                              ? `Default: ${toolName}`
                              : `${serverName}: ${toolName}`;

                          return (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-background hover:bg-secondary/80 hover:ring-1 hover:ring-destructive transition-all cursor-pointer group"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToolUpdate(serverId, toolName, {
                                  enabled: false,
                                });
                              }}
                            >
                              <span className="text-xs">{displayName}</span>
                              <span className="ml-2">
                                <XIcon className="size-2.5 text-muted-foreground group-hover:text-destructive" />
                              </span>
                            </Badge>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
                {isMcpPopupOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 ml-2 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 ml-2 flex-shrink-0 rotate-180" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              align="start"
              side="top"
              sideOffset={4}
              style={{
                width: triggerRef.current?.offsetWidth
                  ? `${triggerRef.current.offsetWidth}px`
                  : "100%", // eslint-disable-line react/no-unescaped-entities
              }}
            >
              <div className="max-h-96 overflow-y-auto">
                {/* Sticky Search Bar */}
                <div className="sticky top-0 bg-card z-10 p-4 pb-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tools..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10"
                    />
                  </div>
                </div>
                <div className="p-4 pt-2">
                  <div className="space-y-3">
                    {filteredServers.map((server) => {
                      const serverConfig = getServerConfig(server.id);
                      const isEnabled = serverConfig?.enabled ?? false;
                      const enabledToolsCount = server.toolInfo.filter(
                        (tool) => getToolConfig(server.id, tool.name).enabled,
                      ).length;

                      // Handle default tools differently
                      if (server.name === "Default_Tools") {
                        return (
                          <div key={server.id} className="space-y-2">
                            {/* Default Tools List */}
                            <div className="">
                              {server.toolInfo.map((tool) => {
                                const toolConfig = getToolConfig(
                                  server.id,
                                  tool.name,
                                );
                                return (
                                  <div
                                    key={tool.name}
                                    className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer rounded-md"
                                    onClick={() => {
                                      if (toolConfig.enabled) {
                                        handleToolUpdate(server.id, tool.name, {
                                          enabled: false,
                                        });
                                      } else {
                                        handleToolUpdate(server.id, tool.name, {
                                          enabled: true,
                                        });
                                      }
                                    }}
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="flex items-center gap-2">
                                        {getDefaultToolIcon(
                                          tool.name as AppDefaultToolkit,
                                        )}
                                        <span className="text-sm font-medium">
                                          {tool.name}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex justify-end">
                                      {toolConfig.enabled ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <div className="h-4 w-4 border-muted-foreground rounded" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Handle MCP servers normally
                      return (
                        <div key={server.id} className="space-y-2">
                          {/* Server Header */}
                          <div className="flex items-center justify-between p-2 rounded-lg border-2 bg-muted/30 hover:bg-muted/50">
                            <div
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => {
                                const newEnabled = !isEnabled;
                                handleServerToggle(server.id, newEnabled);
                              }}
                            >
                              {server.oauthStatus.isAuthorized ? (
                                <div className="h-2 w-2 bg-green-500 rounded-full" />
                              ) : (
                                <div className="h-2 w-2 bg-red-500 rounded-full" />
                              )}
                              <div className="flex-1">
                                <div className="text-sm font-semibold">
                                  {server.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {enabledToolsCount} of{" "}
                                  {server.toolInfo.length} tools
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tools List */}
                          <div className="">
                            {server.toolInfo.map((tool) => {
                              const toolConfig = getToolConfig(
                                server.id,
                                tool.name,
                              );
                              return (
                                <div
                                  key={tool.name}
                                  className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer rounded-md"
                                  onClick={() => {
                                    if (toolConfig.enabled) {
                                      handleToolUpdate(server.id, tool.name, {
                                        enabled: false,
                                      });
                                    } else {
                                      handleToolUpdate(server.id, tool.name, {
                                        enabled: true,
                                      });
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {toolConfig.enabled ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <div className="h-4 w-4 border-muted-foreground rounded" />
                                    )}
                                    <span className="text-sm font-medium">
                                      {tool.name}
                                    </span>
                                  </div>
                                  <div className="w-[60px] flex justify-end">
                                    {toolConfig.enabled ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-3 text-xs font-medium"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToolUpdate(
                                            server.id,
                                            tool.name,
                                            {
                                              mode:
                                                toolConfig.mode === "auto"
                                                  ? "manual"
                                                  : "auto",
                                            },
                                          );
                                        }}
                                      >
                                        {toolConfig.mode === "auto"
                                          ? "Auto"
                                          : "Manual"}
                                      </Button>
                                    ) : (
                                      <div className="w-[60px] h-6" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {filteredServers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <Settings className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground text-center">
                          {searchQuery.trim()
                            ? "No tools found matching your search."
                            : "No MCP integrations configured yet.\nAdd integrations from the Integrations page."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2 pb-4">
          <Button onClick={saveProject} disabled={isLoading}>
            {isSaving
              ? t("Common.saving")
              : isNewProject
                ? "Create Assistant"
                : t("Common.save")}
            {isSaving && <Loader className="size-4 animate-spin" />}
          </Button>
        </div>
      </div>

      {/* Past Conversations Modal - only for existing projects */}
      {!isNewProject && projectData && (
        <ProjectConversationsModal
          isOpen={isConversationsModalOpen}
          onOpenChange={setIsConversationsModalOpen}
          project={projectData}
        />
      )}
    </div>
  );
}
