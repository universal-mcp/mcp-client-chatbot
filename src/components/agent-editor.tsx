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
  WandSparklesIcon,
  PlusIcon,
  CornerUpLeft,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Skeleton } from "ui/skeleton";
import { handleErrorWithToast } from "ui/shared-toast";
import { toast } from "sonner";
import { Badge } from "ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "ui/popover";
import Tiptap from "@/components/tiptap";
import { ProjectConversationsModal } from "@/components/project-conversations-modal";
import { AppDefaultToolkit, DefaultToolName } from "lib/ai/tools";
import { GlobalIcon } from "ui/global-icon";
import { experimental_useObject } from "@ai-sdk/react";
import { AgentGenerateSchema } from "app-types/chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "ui/dialog";
import { Textarea } from "ui/textarea";
import { TextShimmer } from "ui/text-shimmer";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { cn, objectFlow } from "lib/utils";

type MCPServerWithId = MCPServerInfo & { id: string };

type LocalServerConfig = { id: string; name: string; enabled: boolean };
type LocalToolConfig = {
  mcpServerId: string | null; // null for default tools
  toolName: string;
  enabled: boolean;
  mode: "auto" | "manual";
};

type LocalProjectState = PartialBy<
  Omit<Project, "createdAt" | "updatedAt" | "userId">,
  "id"
> & {
  threadId?: string;
};

const defaultConfig = (): LocalProjectState => {
  return {
    name: "",
    description: "",
    instructions: {
      expert: "",
      systemPrompt: "",
    },
    threadId: undefined,
  };
};

interface AgentEditorProps {
  projectId?: string; // undefined for new project, string for existing project
  isNewProject?: boolean;
}

export function AgentEditor({
  projectId,
  isNewProject = false,
}: AgentEditorProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [project, setProject] = useObjectState(defaultConfig());
  const [isConversationsModalOpen, setIsConversationsModalOpen] =
    useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  // MCP Configuration state
  const [mcpServers, setMcpServers] = useState<MCPServerWithId[]>([]);
  const [originalToolConfigs, setOriginalToolConfigs] = useState<
    Map<string, LocalToolConfig>
  >(new Map());
  const [serverConfigs, setServerConfigs] = useState<LocalServerConfig[]>([]);
  const [toolConfigs, setToolConfigs] = useState<Map<string, LocalToolConfig>>(
    new Map(),
  );

  // Dynamic height for description up to 4 lines
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const adjustDescriptionTextareaHeight = useCallback(() => {
    const el = descriptionRef.current;
    if (!el) return;

    // Reset height to measure content height accurately
    el.style.height = "auto";

    const styles = window.getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight || "0");
    const paddingTop = parseFloat(styles.paddingTop || "0");
    const paddingBottom = parseFloat(styles.paddingBottom || "0");
    const borderTop = parseFloat(styles.borderTopWidth || "0");
    const borderBottom = parseFloat(styles.borderBottomWidth || "0");
    const maxPx =
      lineHeight * 4 + paddingTop + paddingBottom + borderTop + borderBottom;

    const desired = Math.min(el.scrollHeight, Math.max(maxPx, 0));
    el.style.height = `${desired}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustDescriptionTextareaHeight();
  }, [project.description, adjustDescriptionTextareaHeight]);
  const [hasMcpChanges, setHasMcpChanges] = useState(false);
  const [isMcpPopupOpen, setIsMcpPopupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMcpDataLoaded, setIsMcpDataLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tiptapRef = useRef<HTMLDivElement>(null);

  // Track original project state for change detection
  const [originalProject, setOriginalProject] = useState<LocalProjectState>(
    defaultConfig(),
  );

  // Check if current project differs from original project using hash comparison
  const hasProjectChanges = useMemo(() => {
    const createProjectHash = (proj: LocalProjectState) => {
      return JSON.stringify({
        name: proj.name || "",
        description: proj.description || "",
        instructions: {
          expert: proj.instructions?.expert || "",
          systemPrompt: proj.instructions?.systemPrompt || "",
        },
      });
    };

    const currentHash = createProjectHash(project);
    const originalHash = createProjectHash(originalProject);

    return currentHash !== originalHash;
  }, [project, originalProject]);

  // Combined changes detection (project fields + MCP configuration)
  const hasAnyChanges = useMemo(() => {
    return hasProjectChanges || hasMcpChanges;
  }, [hasProjectChanges, hasMcpChanges]);

  const handleInstructionsChange = useCallback(
    (value: string) => {
      setProject({
        instructions: {
          ...project.instructions,
          systemPrompt: value || "",
        },
      });
    },
    [setProject, project.instructions],
  );

  // AI Generation state
  const [openGenerateAgentDialog, setOpenGenerateAgentDialog] = useState(false);
  const [generateAgentPrompt, setGenerateAgentPrompt] = useState("");
  const {
    object,
    submit,
    isLoading: isGenerating,
  } = experimental_useObject({
    api: "/api/chat/ai",
    schema: AgentGenerateSchema,
    onFinish(event) {
      if (event.error) {
        handleErrorWithToast(event.error);
      }
      if (event.object?.tools) {
        assignToolsByNames(event.object.tools);
      }
    },
  });

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
          description: "Chart Tools",
        },
        { name: AppDefaultToolkit.WebSearch, description: "Web Search" },
        { name: AppDefaultToolkit.Http, description: "HTTP" },
        {
          name: AppDefaultToolkit.Code,
          description: "Code",
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
      onError: (error) => {
        handleErrorWithToast(error);
        router.push(`/`);
      },
      onSuccess: (data) => {
        if (data) {
          const projectData = {
            name: data.name || "",
            description: data.description || "",
            instructions: data.instructions || { systemPrompt: "", expert: "" },
          };
          setProject(projectData);
          setOriginalProject(projectData);
        } else if (projectId) {
          toast.error(`Project not found`);
          router.push(`/`);
        }
      },
    },
  );

  // Handle template data from URL parameters for new projects
  useEffect(() => {
    if (isNewProject) {
      const templateParam = searchParams.get("template");
      const threadIdParam = searchParams.get("threadId");

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
      } else if (threadIdParam) {
        // For thread-based generation, show the AI generation dialog with threadId
        setOpenGenerateAgentDialog(true);
        setGenerateAgentPrompt("");
        // Store threadId for use in generation
        setProject((prev) => ({ ...prev, threadId: threadIdParam }));
      } else {
        // For new projects without templates, show the AI generation dialog by default
        setOpenGenerateAgentDialog(true);
      }
    }
  }, [isNewProject, searchParams]);

  // Handle streaming object updates from AI generation
  useEffect(() => {
    if (!object) return;
    objectFlow(object).forEach((data, key) => {
      setProject((prev) => {
        if (key == "name") {
          return {
            name: data as string,
          };
        }
        if (key == "description") {
          return {
            description: data as string,
          };
        }
        if (key == "role") {
          return {
            instructions: {
              ...prev.instructions,
              expert: data as string,
            },
          };
        }

        if (key == "instructions") {
          return {
            instructions: {
              ...prev.instructions,
              systemPrompt: data as string,
            },
          };
        }
        return prev;
      });
    });
  }, [object]);

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

          setServerConfigs(initialServerConfigs);
          setOriginalToolConfigs(toolConfigMap);
          setToolConfigs(toolConfigMap);
        } else {
          // For new projects, initialize with empty configs
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

  // AI Generation handlers
  const handleOpenAiGenerate = useCallback(() => {
    setOpenGenerateAgentDialog(true);
    setGenerateAgentPrompt("");
  }, []);

  const submitGenerateAgent = useCallback(() => {
    const requestBody: any = {
      message: generateAgentPrompt,
    };

    // If we have a threadId, include it in the request
    if (project.threadId) {
      requestBody.threadId = project.threadId;
    }

    submit(requestBody);
    setOpenGenerateAgentDialog(false);
    setGenerateAgentPrompt("");
  }, [generateAgentPrompt, submit, project.threadId]);

  // Handle starting a chat with the current project
  const handleStartChat = useCallback(async () => {
    if (!projectId) {
      toast.error("Please save the project first");
      return;
    }
    // Navigate to the chat page with project ID
    router.push(`/?projectId=${projectId}`);
  }, [projectId, router]);

  // Assign tools by names from AI generation
  const assignToolsByNames = useCallback(
    (toolNames: string[]) => {
      const newToolConfigs = new Map<string, LocalToolConfig>();
      const newServerConfigs = new Set<string>();

      // Handle default tools - map tool names to their corresponding toolkit
      const defaultToolMapping: Record<string, string> = {
        [DefaultToolName.CreatePieChart]: AppDefaultToolkit.Visualization,
        [DefaultToolName.CreateBarChart]: AppDefaultToolkit.Visualization,
        [DefaultToolName.CreateLineChart]: AppDefaultToolkit.Visualization,
        [DefaultToolName.CreateTable]: AppDefaultToolkit.Visualization,
        [DefaultToolName.WebSearch]: AppDefaultToolkit.WebSearch,
        [DefaultToolName.WebContent]: AppDefaultToolkit.WebSearch,
        [DefaultToolName.Http]: AppDefaultToolkit.Http,
        [DefaultToolName.PythonExecution]: AppDefaultToolkit.Code,
      };

      // Check for default tools
      Object.entries(defaultToolMapping).forEach(([toolName, toolkit]) => {
        if (toolNames.includes(toolName)) {
          const key = `default_tools:${toolkit}`;
          newToolConfigs.set(key, {
            mcpServerId: null,
            toolName: toolkit,
            enabled: true,
            mode: "auto",
          });
          newServerConfigs.add("default_tools");
        }
      });

      // Handle MCP tools
      mcpServers.forEach((server) => {
        if (server.id === "default_tools") return; // Skip default tools server as we handled it above

        server.toolInfo.forEach((tool) => {
          if (toolNames.includes(tool.name)) {
            const key = `${server.id}:${tool.name}`;
            newToolConfigs.set(key, {
              mcpServerId: server.id,
              toolName: tool.name,
              enabled: true,
              mode: "auto",
            });
            newServerConfigs.add(server.id);
          }
        });
      });

      // Update tool configs
      if (newToolConfigs.size > 0) {
        setToolConfigs((prev) => new Map([...prev, ...newToolConfigs]));
      }

      // Update server configs
      if (newServerConfigs.size > 0) {
        setServerConfigs((prev) => {
          const updated = [...prev];
          newServerConfigs.forEach((serverId) => {
            const existing = updated.find((s) => s.id === serverId);
            if (!existing) {
              const server = mcpServers.find((s) => s.id === serverId);
              if (server) {
                updated.push({
                  id: serverId,
                  name: server.name,
                  enabled: true,
                });
              }
            } else if (!existing.enabled) {
              existing.enabled = true;
            }
          });
          return updated;
        });
      }
    },
    [mcpServers],
  );

  // Track MCP changes using sorted hash approach like tool-select component
  useEffect(() => {
    const createToolConfigHash = (
      toolConfigMap: Map<string, LocalToolConfig>,
    ) => {
      // Convert Map to array and sort to ensure consistent hash
      const sortedConfigs = Array.from(toolConfigMap.entries()).sort((a, b) => {
        const [aKey] = a;
        const [bKey] = b;
        return aKey.localeCompare(bKey);
      });

      return JSON.stringify(
        sortedConfigs.map(([key, config]) => ({
          key,
          mcpServerId: config.mcpServerId,
          toolName: config.toolName,
          enabled: config.enabled,
          mode: config.mode,
        })),
      );
    };

    const currentToolHash = createToolConfigHash(toolConfigs);
    const originalToolHash = createToolConfigHash(originalToolConfigs);

    const newHasChanges = currentToolHash !== originalToolHash;
    setHasMcpChanges(newHasChanges);
  }, [toolConfigs, originalToolConfigs]);

  const saveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isNewProject) {
        // Create new project - exclude threadId from the project data
        const { threadId, ...projectData } = project;
        const newProject = await insertProjectAction({
          name: projectData.name,
          description: projectData.description,
          instructions: projectData.instructions,
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

        mutate("/api/project/list");

        toast.success("Agent created successfully");
        // Navigate to the chat page with project ID
        router.push(`/?projectId=${newProject.id}`);
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
          setOriginalToolConfigs(new Map(currentToolConfigs));
          setHasMcpChanges(false);
        }

        mutate(`/projects/${projectId}`);
        mutate("/api/project/list");
        // Reset original project state to current state after successful save
        setOriginalProject({ ...project });
        toast.success("Agent saved successfully");
      }
    } catch (error) {
      if (error instanceof Error) {
        handleErrorWithToast(error);
      } else {
        handleErrorWithToast(new Error("Failed to save agent"));
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
    router,
    projectData,
  ]);

  const handleCancelChanges = useCallback(() => {
    if (isNewProject) return;
    setProject({ ...originalProject });
    setToolConfigs(new Map(originalToolConfigs));
    setHasMcpChanges(false);
  }, [isNewProject, originalProject, originalToolConfigs]);

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

      setToolConfigs((prev) => {
        const newConfigs = new Map(prev);

        for (const tool of server.toolInfo) {
          const key = `${serverId}:${tool.name}`;

          if (enabled) {
            // Add or update tool config when server is enabled
            const existing =
              newConfigs.get(key) || getToolConfig(serverId, tool.name);
            newConfigs.set(key, { ...existing, enabled: true });
          } else {
            // Remove tool config when server is disabled
            newConfigs.delete(key);
          }
        }

        return newConfigs;
      });
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

        if (update.enabled === false) {
          // Remove the tool config entirely when disabled
          newConfigs.delete(key);
        } else {
          // Add or update the tool config when enabled or mode changed
          const existing =
            newConfigs.get(key) || getToolConfig(serverId, toolName);
          newConfigs.set(key, { ...existing, ...update });
        }

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
        <div className="sticky top-0 bg-background z-10 flex flex-col gap-4 pb-6">
          {/* Back Button - Show for all agent pages */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (hasAnyChanges) {
                  setIsLeaveConfirmOpen(true);
                } else {
                  router.push(`/project`);
                }
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </Button>
          </div>

          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isGenerating ? (
                <TextShimmer className="w-full text-2xl font-bold">
                  Generating Agent
                </TextShimmer>
              ) : (
                <p className="text-2xl font-bold">
                  {isNewProject ? "Create Agent" : t("Chat.Project.project")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isNewProject && projectData && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setIsConversationsModalOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <MessagesSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Past Conversations</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="outline"
                size="default"
                disabled={isGenerating}
                onClick={handleOpenAiGenerate}
                className="flex items-center gap-2"
              >
                <WandSparklesIcon className="h-4 w-4" />
                Generate with AI
                {isGenerating && <Loader className="h-4 w-4 animate-spin" />}
              </Button>
              <AnimatePresence mode="wait" initial={false}>
                {isNewProject ? (
                  <motion.div
                    key="create"
                    initial={{ y: -16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 16, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex"
                  >
                    <Button
                      variant="secondary"
                      size="default"
                      onClick={saveProject}
                      disabled={
                        isLoading ||
                        isGenerating ||
                        !(project.name?.trim() ?? false)
                      }
                      className="flex items-center gap-2 text-foreground bg-secondary/40 border border-foreground/40"
                    >
                      {isSaving ? (
                        <>
                          {t("Common.saving")}
                          <Loader className="size-4 animate-spin" />
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-3 w-3" />
                          Create agent
                        </>
                      )}
                    </Button>
                  </motion.div>
                ) : hasAnyChanges ? (
                  <motion.div
                    key="edit"
                    initial={{ y: -16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 16, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex items-center gap-2"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={handleCancelChanges}
                          disabled={isSaving || isGenerating}
                          aria-label="Revert changes"
                        >
                          <CornerUpLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Revert changes</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="secondary"
                      size="default"
                      onClick={saveProject}
                      disabled={isSaving || isGenerating || !hasAnyChanges}
                      className="flex items-center gap-2 px-4 justify-center text-foreground bg-secondary/40 border border-foreground/40"
                    >
                      {isSaving ? t("Common.saving") : t("Common.save")}
                      {isSaving && <Loader className="size-4 animate-spin" />}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="start"
                    initial={{ y: -16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 16, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex"
                  >
                    <Button
                      variant="secondary"
                      size="default"
                      disabled={isGenerating || !projectId}
                      onClick={handleStartChat}
                      className="flex items-center gap-2 text-foreground bg-secondary/40 border border-foreground/40"
                    >
                      <PlusIcon className="h-3 w-3" />
                      Start Chat
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Project Name */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-name" className="text-sm font-medium">
            Give your agent a name
          </Label>
          {isProjectLoading ? (
            <Skeleton className="w-full h-10" />
          ) : (
            <Input
              value={project.name || ""}
              onChange={(e) => setProject({ name: e.target.value })}
              disabled={isLoading || isGenerating}
              className="hover:bg-input bg-secondary/40 transition-colors focus-visible:bg-input! ring-0! placeholder:text-xs"
              id="project-name"
              placeholder="Deep Research"
            />
          )}
        </div>

        {/* Project Description */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-description" className="text-sm font-medium">
            Describe your agent in a few words
          </Label>
          {isProjectLoading ? (
            <Skeleton className="w-full h-10" />
          ) : (
            <Textarea
              ref={descriptionRef}
              value={project.description || ""}
              onChange={(e) => {
                setProject({ description: e.target.value });
                // After state update, adjust height on next frame for smoothness
                requestAnimationFrame(adjustDescriptionTextareaHeight);
              }}
              disabled={isLoading || isGenerating}
              rows={1}
              className="hover:bg-input bg-secondary/40 transition-colors focus-visible:bg-input! ring-0! placeholder:text-xs min-h-7 overflow-y-hidden resize-none overscroll-contain"
              id="project-description"
              placeholder="Performs deep research on a given topic"
            />
          )}
        </div>

        {/* Expert Instructions */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="project-expert" className="text-sm font-medium">
              This agent is an expert in
            </Label>
            {isProjectLoading ? (
              <Skeleton className="w-64 h-10" />
            ) : (
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
                disabled={isLoading || isGenerating}
                className="w-64 hover:bg-input bg-secondary/40 transition-colors focus-visible:bg-input! ring-0! placeholder:text-xs"
                id="project-expert"
                placeholder="collating loads of data"
              />
            )}
          </div>
        </div>

        {/* Project Instructions */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="project-instructions" className="text-sm font-medium">
            Feel free to write the agent's role, personality, knowledge and any
            other information.
          </Label>
          {isProjectLoading ? (
            <Skeleton className="w-full h-48" />
          ) : (
            <div ref={tiptapRef} className={cn(isGenerating && "relative")}>
              <Tiptap
                value={project.instructions?.systemPrompt || ""}
                onChange={handleInstructionsChange}
                placeholder="You are a helpful agent that can perform deep research and help with tasks..."
                className={isGenerating ? "pointer-events-none opacity-50" : ""}
                isGenerating={isGenerating}
              />
            </div>
          )}
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
                disabled={isLoading || isGenerating}
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
                              ? `Default: ${server?.toolInfo.find((t) => t.name === toolName)?.description || toolName}`
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
                                          {tool.description}
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

        {/* Save Button moved to top. Bottom CTA removed as requested. */}
      </div>

      {/* Past Conversations Modal - only for existing projects */}
      {!isNewProject && projectData && (
        <ProjectConversationsModal
          isOpen={isConversationsModalOpen}
          onOpenChange={setIsConversationsModalOpen}
          project={projectData}
        />
      )}

      {/* AI Generation Dialog */}
      <Dialog
        open={openGenerateAgentDialog}
        onOpenChange={setOpenGenerateAgentDialog}
      >
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-semibold">
              Generate Agent
            </DialogTitle>
            <DialogDescription className="font-medium mt-2">
              {project.threadId
                ? "I'll analyze your chat history and create an agent that can continue this type of work."
                : "Describe the agent you want to create. Be specific about its purpose, capabilities, and how it should interact with users."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Textarea */}
            <div className="space-y-3">
              <Label htmlFor="generate-prompt" className="text-sm font-medium">
                {project.threadId ? (
                  <>
                    Additional Requirements{" "}
                    <span className="text-muted-foreground">(Optional)</span>
                  </>
                ) : (
                  "Description"
                )}
              </Label>
              <Textarea
                id="generate-prompt"
                value={generateAgentPrompt}
                autoFocus
                placeholder={
                  project.threadId
                    ? "Add any additional requirements, preferences, or constraints for the agent..."
                    : "A research agent that can analyze data, create charts, and provide insights on market trends..."
                }
                onChange={(e) => setGenerateAgentPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    e.preventDefault();
                    submitGenerateAgent();
                  }
                }}
                className="min-h-32 resize-none border-muted focus:border-primary transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpenGenerateAgentDialog(false)}
                disabled={isGenerating}
              >
                {isNewProject ? "Create Manually" : "Cancel"}
              </Button>
              <Button
                onClick={submitGenerateAgent}
                disabled={
                  isGenerating ||
                  (!generateAgentPrompt.trim() && !project.threadId)
                }
                className="min-w-32"
              >
                {isGenerating ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <WandSparklesIcon className="w-4 h-4" />
                    {project.threadId ? "Generate from Chat" : "Generate"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Confirmation Dialog */}
      <Dialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave this
              page?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep editing</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => router.push(`/project`)}
              className="bg-destructive/80 hover:bg-destructive transition-colors"
            >
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
