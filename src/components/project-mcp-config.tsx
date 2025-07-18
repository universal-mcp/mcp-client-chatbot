"use client";

import {
  bulkUpdateProjectMcpToolsAction,
  getProjectMcpToolsAction,
} from "@/app/api/mcp/project-config/actions";
import { selectMcpClientsAction } from "@/app/api/mcp/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProjectMcpToolConfig } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";
import type { MCPServerInfo } from "@/types/mcp";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Loader,
  Save,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ProjectMcpConfigProps {
  projectId?: string;
  onHasChangesUpdate?: (hasChanges: boolean) => void;
  onConfigChange?: (configs: {
    tools: ProjectMcpToolConfig[];
  }) => void;
  onSave?: () => void;
}

type MCPServerWithId = MCPServerInfo & { id: string };

type LocalServerConfig = { id: string; name: string; enabled: boolean };
type LocalToolConfig = {
  mcpServerId: string;
  toolName: string;
  enabled: boolean;
  mode: "auto" | "manual";
};

export function ProjectMcpConfig({
  projectId,
  onHasChangesUpdate,
  onConfigChange,
  onSave,
}: ProjectMcpConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerWithId[]>([]);
  const [selectedServer, setSelectedServer] = useState<MCPServerWithId | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

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

  const [hasChanges, setHasChanges] = useState(false);

  const isCreateMode = !projectId;

  useEffect(() => {
    setSearchQuery("");
  }, [selectedServer]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const servers = await selectMcpClientsAction();
        setMcpServers(servers);

        if (!isCreateMode) {
          const toolConfigsData = await getProjectMcpToolsAction(projectId);
          const toolConfigMap = new Map(
            toolConfigsData.map((c) => [`${c.mcpServerId}:${c.toolName}`, c]),
          );
          const enabledServerIds = new Set(
            toolConfigsData.map((c) => c.mcpServerId),
          );

          const initialServerConfigs = servers.map((server) => ({
            id: server.id,
            name: server.name,
            enabled: enabledServerIds.has(server.id),
          }));

          setOriginalServerConfigs(initialServerConfigs);
          setServerConfigs(initialServerConfigs);
          setOriginalToolConfigs(toolConfigMap);
          setToolConfigs(toolConfigMap);
        }
      } catch (_error) {
        toast.error("Failed to load MCP configuration");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId, isCreateMode]);

  useEffect(() => {
    if (isCreateMode) return;
    const serverChanges =
      JSON.stringify(serverConfigs) !== JSON.stringify(originalServerConfigs);
    const toolChanges =
      JSON.stringify(Array.from(toolConfigs.entries())) !==
      JSON.stringify(Array.from(originalToolConfigs.entries()));
    const newHasChanges = serverChanges || toolChanges;
    setHasChanges(newHasChanges);
    onHasChangesUpdate?.(newHasChanges);
  }, [
    serverConfigs,
    toolConfigs,
    originalServerConfigs,
    originalToolConfigs,
    onHasChangesUpdate,
    isCreateMode,
  ]);

  useEffect(() => {
    if (!isCreateMode) return;

    const toolsToSave = Array.from(toolConfigs.values()).filter(
      (config) => config.enabled,
    );

    onConfigChange?.({
      tools: toolsToSave,
    });
  }, [serverConfigs, toolConfigs, onConfigChange, isCreateMode]);

  async function handleSave() {
    if (isCreateMode || !projectId) return;

    setSaving(true);
    try {
      const currentToolConfigs = new Map(toolConfigs);
      const enabledServerIds = new Set(
        serverConfigs.filter((s) => s.enabled).map((s) => s.id),
      );

      for (const [key, config] of currentToolConfigs.entries()) {
        if (!enabledServerIds.has(config.mcpServerId) && config.enabled) {
          currentToolConfigs.set(key, { ...config, enabled: false });
        }
      }

      const toolConfigsToSave = Array.from(currentToolConfigs.values()).filter(
        (config) => config.enabled,
      );

      await bulkUpdateProjectMcpToolsAction(projectId, toolConfigsToSave);

      setToolConfigs(currentToolConfigs);
      setOriginalServerConfigs([...serverConfigs]);
      setOriginalToolConfigs(new Map(currentToolConfigs));

      toast.success("Configuration saved successfully");
      setHasChanges(false);
      setSelectedServer(null);
      onSave?.();
    } catch (_error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  function setServerEnabled(serverId: string, enabled: boolean) {
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
  }

  function handleServerToggle(serverId: string, enabled: boolean) {
    setServerEnabled(serverId, enabled);

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
  }

  function handleToolUpdate(
    serverId: string,
    toolName: string,
    update: { enabled?: boolean; mode?: "auto" | "manual" },
  ) {
    const key = `${serverId}:${toolName}`;
    setToolConfigs((prev) => {
      const newConfigs = new Map(prev);
      const existing = newConfigs.get(key) || getToolConfig(serverId, toolName);
      newConfigs.set(key, { ...existing, ...update });
      return newConfigs;
    });

    if (update.enabled) {
      const serverConfig = getServerConfig(serverId);
      if (!serverConfig || !serverConfig.enabled) {
        setServerEnabled(serverId, true);
      }
    }
  }

  function handleToggleAllTools(serverId: string, enabled: boolean) {
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

    if (enabled) {
      const serverConfig = getServerConfig(serverId);
      if (!serverConfig || !serverConfig.enabled) {
        setServerEnabled(serverId, true);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin" size={24} />
      </div>
    );
  }

  const getServerConfig = (serverId: string) => {
    return serverConfigs.find((s) => s.id === serverId);
  };

  const getToolConfig = (serverId: string, toolName: string) => {
    const key = `${serverId}:${toolName}`;
    return (
      toolConfigs.get(key) || {
        mcpServerId: serverId,
        toolName,
        enabled: false,
        mode: "auto" as const,
      }
    );
  };

  const filteredTools = selectedServer
    ? selectedServer.toolInfo.filter((tool) =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const serverListView = (
    <div>
      <div className="space-y-2">
        {mcpServers.map((server) => {
          const serverConfig = getServerConfig(server.id);
          const isEnabled = serverConfig?.enabled ?? false;

          return (
            <div
              key={server.id}
              className="flex items-center gap-4 rounded-md border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
              onClick={() => setSelectedServer(server)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    handleServerToggle(server.id, checked)
                  }
                />
              </div>
              <div className="flex-1">
                <div className="font-medium">{server.name}</div>
                <div className="text-sm text-muted-foreground">
                  {server.toolInfo.length} tools available
                </div>
              </div>

              {server.oauthStatus.isAuthorized ? (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200 bg-green-50"
                >
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-red-600 border-red-200 bg-red-50"
                >
                  Disconnected
                </Badge>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          );
        })}
      </div>
    </div>
  );

  const toolListView = selectedServer ? (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedServer(null)}
            className="shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h4 className="text-lg font-semibold">{selectedServer.name}</h4>
            <p className="text-sm text-muted-foreground">
              Configure individual tools for this integration.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor={`tool-all-enabled-${selectedServer.id}`}
            className="font-medium text-sm"
          >
            {selectedServer.toolInfo.length > 0 &&
            selectedServer.toolInfo.every(
              (tool) => getToolConfig(selectedServer.id, tool.name).enabled,
            )
              ? "Disable All Tools"
              : "Enable All Tools"}
          </Label>
          <Switch
            id={`tool-all-enabled-${selectedServer.id}`}
            checked={
              selectedServer.toolInfo.length > 0 &&
              selectedServer.toolInfo.every(
                (tool) => getToolConfig(selectedServer.id, tool.name).enabled,
              )
            }
            onCheckedChange={(checked) =>
              handleToggleAllTools(selectedServer.id, checked)
            }
          />
        </div>
      </div>
      <div className="relative my-4">
        <Input
          placeholder="Search for a tool..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background pl-10"
        />
      </div>
      <div className="flex justify-between items-center px-4 pb-2 border-b">
        <h5 className="text-sm font-medium text-muted-foreground">Tool</h5>
        <div className="w-[120px] flex justify-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1.5 cursor-help">
                <h5 className="text-sm font-medium text-muted-foreground">
                  Auto Mode?
                </h5>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  <b>Automatic:</b> Assistant can use this tool without asking.
                  <br />
                  <b>Manual:</b> Requires your approval before execution.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <ScrollArea className="h-[420px] pr-4">
        <div className="space-y-3 pt-3">
          {filteredTools.length > 0 ? (
            filteredTools.map((tool) => {
              const toolConfig = getToolConfig(selectedServer.id, tool.name);

              return (
                <div
                  key={tool.name}
                  className="flex items-start justify-between gap-4 rounded-md border p-3"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <Switch
                      id={`tool-enabled-${selectedServer.id}-${tool.name}`}
                      checked={toolConfig.enabled}
                      onCheckedChange={(checked) =>
                        handleToolUpdate(selectedServer.id, tool.name, {
                          enabled: checked,
                        })
                      }
                    />
                    <div className="space-y-1 mt-[-2px]">
                      <Label
                        htmlFor={`tool-enabled-${selectedServer.id}-${tool.name}`}
                        className="font-medium cursor-pointer"
                      >
                        {tool.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <div className="w-[120px] flex justify-center">
                    <Checkbox
                      checked={toolConfig.mode === "auto"}
                      onCheckedChange={(checked) =>
                        handleToolUpdate(selectedServer.id, tool.name, {
                          mode: checked ? "auto" : "manual",
                        })
                      }
                      disabled={!toolConfig.enabled}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">No tools found.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  ) : null;

  return (
    <div className="flex flex-col">
      <div className="pr-4 pb-4">
        {selectedServer ? toolListView : serverListView}

        {mcpServers.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Settings className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                No MCP integrations configured yet.
                <br />
                Add integrations from the Integrations page.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {!isCreateMode && mcpServers.length > 0 && (
        <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-2"
          >
            {saving ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
