"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getProjectMcpConfigAction,
  bulkUpdateProjectMcpServersAction,
  bulkUpdateProjectMcpToolsAction,
} from "@/app/api/mcp/project-config/actions";
import { selectMcpClientsAction } from "@/app/api/mcp/actions";
import { Loader, Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MCPServerInfo } from "@/types/mcp";

interface ProjectMcpConfigProps {
  projectId: string;
  onHasChangesUpdate?: (hasChanges: boolean) => void;
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
}: ProjectMcpConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerWithId[]>([]);

  // Original configurations from database
  const [originalServerConfigs, setOriginalServerConfigs] = useState<
    LocalServerConfig[]
  >([]);
  const [originalToolConfigs, setOriginalToolConfigs] = useState<
    Map<string, LocalToolConfig>
  >(new Map());

  // Local configurations being edited
  const [serverConfigs, setServerConfigs] = useState<LocalServerConfig[]>([]);
  const [toolConfigs, setToolConfigs] = useState<Map<string, LocalToolConfig>>(
    new Map(),
  );

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    // Check if there are any changes
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
  ]);

  async function loadData() {
    try {
      setLoading(true);
      const [servers, config] = await Promise.all([
        selectMcpClientsAction(),
        getProjectMcpConfigAction(projectId),
      ]);

      setMcpServers(servers);

      // Set both original and current configs
      setOriginalServerConfigs(config.servers);
      setServerConfigs(config.servers);

      setOriginalToolConfigs(new Map(config.tools));
      setToolConfigs(new Map(config.tools));
    } catch (error) {
      toast.error("Failed to load MCP configuration");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Prepare server configs
      const serverConfigsToSave = serverConfigs.map((config) => ({
        mcpServerId: config.id,
        enabled: config.enabled,
      }));

      // Prepare tool configs
      const toolConfigsToSave = Array.from(toolConfigs.values());

      // Save both in parallel
      await Promise.all([
        bulkUpdateProjectMcpServersAction(projectId, serverConfigsToSave),
        bulkUpdateProjectMcpToolsAction(projectId, toolConfigsToSave),
      ]);

      // Update original configs to reflect saved state
      setOriginalServerConfigs([...serverConfigs]);
      setOriginalToolConfigs(new Map(toolConfigs));

      toast.success("Configuration saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save configuration");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Reset to original configs
    setServerConfigs([...originalServerConfigs]);
    setToolConfigs(new Map(originalToolConfigs));
    setHasChanges(false);
  }

  function handleServerToggle(serverId: string, enabled: boolean) {
    setServerConfigs((prev) => {
      const existing = prev.find((s) => s.id === serverId);
      if (existing) {
        return prev.map((s) => (s.id === serverId ? { ...s, enabled } : s));
      } else {
        // Add new config for this server
        const server = mcpServers.find((s) => s.id === serverId);
        if (server) {
          return [...prev, { id: serverId, name: server.name, enabled }];
        }
      }
      return prev;
    });
  }

  function handleToolUpdate(
    serverId: string,
    toolName: string,
    update: { enabled?: boolean; mode?: "auto" | "manual" },
  ) {
    const key = `${serverId}:${toolName}`;
    setToolConfigs((prev) => {
      const newConfigs = new Map(prev);
      const existing = newConfigs.get(key);

      if (existing) {
        newConfigs.set(key, { ...existing, ...update });
      } else {
        // Create new config
        newConfigs.set(key, {
          mcpServerId: serverId,
          toolName,
          enabled: update.enabled ?? true,
          mode: update.mode ?? "auto",
        });
      }

      return newConfigs;
    });
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
        enabled: true,
        mode: "auto" as const,
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">MCP Integrations</h3>
          {hasChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved changes
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Configure which MCP tools are available in this project and how they
          behave.
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {mcpServers.map((server) => {
          const serverConfig = getServerConfig(server.id);
          const isEnabled = serverConfig?.enabled ?? true;

          return (
            <AccordionItem key={server.id} value={server.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 w-full">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      handleServerToggle(server.id, checked)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{server.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {server.toolInfo.length} tools available
                    </div>
                  </div>
                  {server.status === "connected" ? (
                    <div className="text-xs text-green-600">Connected</div>
                  ) : (
                    <div className="text-xs text-red-600">Disconnected</div>
                  )}
                </div>
              </AccordionTrigger>

              <AccordionContent>
                {!isEnabled ? (
                  <div className="text-sm text-muted-foreground p-4">
                    This integration is disabled for this project.
                  </div>
                ) : (
                  <div className="space-y-3 pt-4">
                    {server.toolInfo.map((tool) => {
                      const toolConfig = getToolConfig(server.id, tool.name);

                      return (
                        <div
                          key={tool.name}
                          className="flex items-start justify-between gap-4 rounded-md border p-3"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                              <Switch
                                id={`tool-enabled-${server.id}-${tool.name}`}
                                checked={toolConfig.enabled}
                                onCheckedChange={(checked) =>
                                  handleToolUpdate(server.id, tool.name, {
                                    enabled: checked,
                                  })
                                }
                              />
                              <Label
                                htmlFor={`tool-enabled-${server.id}-${tool.name}`}
                                className="font-medium cursor-pointer"
                              >
                                {tool.name}
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground pl-[36px]">
                              {tool.description}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Execution Mode
                            </Label>
                            <Select
                              value={toolConfig.mode}
                              onValueChange={(value: "auto" | "manual") =>
                                handleToolUpdate(server.id, tool.name, {
                                  mode: value,
                                })
                              }
                              disabled={!toolConfig.enabled}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">Automatic</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

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

      {/* Action buttons */}
      {mcpServers.length > 0 && (
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={!hasChanges || saving}
          >
            Cancel
          </Button>
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
