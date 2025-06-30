"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Loader,
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  Eye,
  Pencil,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import useSWR from "swr";
import { toast } from "sonner";
import {
  selectMcpClientsAction,
  saveMcpClientAction,
  existMcpClientByServerNameAction,
  removeMcpClientAction,
  refreshMcpClientAction,
} from "@/app/api/mcp/actions";
import type { MCPServerInfo } from "app-types/mcp";

interface McpServerWithId extends MCPServerInfo {
  id: string;
}

export default function IntegrationsPage() {
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [loadingServerId] = useState<string | null>(null);
  const [addServerModalOpen, setAddServerModalOpen] = useState(false);

  const {
    data: mcpServers,
    isLoading,
    mutate,
  } = useSWR("mcp-integrations", selectMcpClientsAction, {
    fallbackData: [],
  });

  const { data: userRole, isLoading: isLoadingRole } = useSWR(
    "user-role",
    async () => {
      const response = await fetch("/api/user/role");
      if (!response.ok) {
        throw new Error("Failed to fetch user role");
      }
      return response.json();
    },
  );

  const isAdmin = userRole?.isAdmin ?? false;
  const isLoadingData = isLoading || isLoadingRole;

  const handleAddServer = async () => {
    if (!isAdmin) {
      toast.error("MCP server management can only be done by admins");
      return;
    }

    if (!newServerName.trim() || !newServerUrl.trim()) {
      toast.error("Please fill in both server name and URL");
      return;
    }

    try {
      setIsAddingServer(true);

      // Check if server name already exists
      const exists = await existMcpClientByServerNameAction(newServerName);
      if (exists) {
        toast.error("A server with this name already exists");
        return;
      }

      // Add the server
      await saveMcpClientAction({
        name: newServerName,
        config: {
          url: newServerUrl,
        },
        userId: "",
      });

      toast.success("Server added successfully");
      setNewServerName("");
      setNewServerUrl("");
      setAddServerModalOpen(false);
      mutate();
    } catch (error) {
      toast.error(
        `Failed to add server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleAddServerClick = () => {
    if (!isAdmin) {
      toast.error("MCP server management can only be done by admins");
      return;
    }
    setAddServerModalOpen(true);
  };

  const handleDeleteServer = async (serverId: string) => {
    await removeMcpClientAction(serverId);
    mutate();
  };

  const handleRefreshServer = async (serverId: string) => {
    await refreshMcpClientAction(serverId);
    mutate();
  };

  const handleEditServer = async (
    serverId: string,
    name: string,
    url: string,
  ) => {
    await saveMcpClientAction({
      id: serverId,
      name: name,
      config: {
        url: url,
      },
      userId: "",
    });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Integrations
          </h1>
          <p className="text-muted-foreground">
            Manage your Model Context Protocol (MCP) server connections
          </p>
        </div>

        <div className="space-y-6">
          {isLoadingData && (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoadingData && mcpServers && mcpServers.length > 0 && (
            <div className="space-y-4">
              {mcpServers.map((server: McpServerWithId) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isLoading={loadingServerId === server.id}
                  isAdmin={isAdmin}
                  onDelete={handleDeleteServer}
                  onRefresh={handleRefreshServer}
                  onEdit={handleEditServer}
                />
              ))}
            </div>
          )}

          {!isLoadingData && (!mcpServers || mcpServers.length === 0) && (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No servers configured
              </h3>
              <p className="text-muted-foreground mb-6">
                Add your first MCP server to get started with integrations
              </p>
            </div>
          )}

          {/* Add Server Button */}
          {!isLoadingData && (
            <div className="flex justify-center">
              <Button
                onClick={handleAddServerClick}
                variant="outline"
                size="lg"
                className="border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isAdmin ? (
                  <Plus className="h-5 w-5 mr-2" />
                ) : (
                  <Lock className="h-5 w-5 mr-2" />
                )}
                Add New Server
              </Button>
            </div>
          )}

          {/* Add Server Modal */}
          <Dialog
            open={addServerModalOpen}
            onOpenChange={setAddServerModalOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Server</DialogTitle>
                <DialogDescription>
                  Connect a new MCP server by providing its name and URL.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-server-name">Server Name</Label>
                  <Input
                    id="new-server-name"
                    placeholder="my-server"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-server-url">Server URL</Label>
                  <Input
                    id="new-server-url"
                    placeholder="https://example.com/mcp"
                    value={newServerUrl}
                    onChange={(e) => setNewServerUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddServerModalOpen(false);
                    setNewServerName("");
                    setNewServerUrl("");
                  }}
                  disabled={isAddingServer}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddServer} disabled={isAddingServer}>
                  {isAddingServer && (
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Add Server
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

interface ServerCardProps {
  server: McpServerWithId;
  isLoading: boolean;
  isAdmin: boolean;
  onDelete: (serverId: string) => void;
  onRefresh: (serverId: string) => void;
  onEdit: (serverId: string, name: string, url: string) => void;
}

function ServerCard({
  server,
  isLoading,
  isAdmin,
  onDelete,
  onRefresh,
  onEdit,
}: ServerCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(server.name);
  const [editUrl, setEditUrl] = useState(
    "url" in server.config ? server.config.url : "",
  );

  // Update form values when server changes (e.g., after edit)
  useEffect(() => {
    setEditName(server.name);
    setEditUrl("url" in server.config ? server.config.url : "");
  }, [server.name, server.config]);

  const statusColor = {
    connected: "bg-green-500",
    disconnected: "bg-red-500",
    loading: "bg-yellow-500",
  }[server.status];

  const statusText = {
    connected: "Connected",
    disconnected: "Disconnected",
    loading: "Connecting",
  }[server.status];

  // Obfuscate URL for non-admin users
  const getDisplayUrl = (url: string) => {
    if (isAdmin) return url;
    if (url.length <= 20) return "•".repeat(url.length);
    return (
      url.substring(0, 8) +
      "•".repeat(url.length - 16) +
      url.substring(url.length - 8)
    );
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(server.id);
      setDeleteDialogOpen(false);
      toast.success(`Server "${server.name}" deleted successfully`);
    } catch (error) {
      toast.error(
        `Failed to delete server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onRefresh(server.id);
      toast.success(`Server "${server.name}" refreshed successfully`);
    } catch (error) {
      toast.error(
        `Failed to refresh server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEdit = async () => {
    if (!editName.trim() || !editUrl.trim()) {
      toast.error("Please fill in both server name and URL");
      return;
    }

    try {
      setIsEditing(true);
      await onEdit(server.id, editName, editUrl);
      setEditModalOpen(false);
      toast.success(`Server "${editName}" updated successfully`);
    } catch (error) {
      toast.error(
        `Failed to update server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <Card className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
          <Loader className="h-6 w-6 animate-spin" />
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${statusColor}`} />
              <CardTitle className="text-lg">{server.name}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {statusText}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info("Authorization functionality coming soon");
              }}
            >
              Authorize
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                disabled={isLoading}
                className="hover:bg-green-50 hover:text-green-600"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="hover:bg-blue-50 hover:text-blue-600"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
            {isAdmin && (
              <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Server</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete {server.name}? This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting && (
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">URL:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {getDisplayUrl(
                "url" in server.config ? server.config.url : "N/A",
              )}
            </code>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Available Tools: {server.toolInfo.length}
            </span>
            {server.toolInfo.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setToolsModalOpen(true)}
                className="text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                View Tools
              </Button>
            )}
          </div>

          {/* Tools Modal */}
          <Dialog open={toolsModalOpen} onOpenChange={setToolsModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Available Tools</DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                {server.toolInfo.length > 0 ? (
                  <div className="space-y-3">
                    {server.toolInfo.map((tool) => (
                      <div
                        key={tool.name}
                        className="border rounded-lg p-4 bg-muted/30"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-2">
                              <code className="bg-background px-2 py-1 rounded text-xs font-mono">
                                {tool.name}
                              </code>
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tools available on this server</p>
                  </div>
                )}
              </ScrollArea>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setToolsModalOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>

      {/* Edit Modal - Only render for admin users */}
      {isAdmin && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Server</DialogTitle>
              <DialogDescription>
                Update the server name and URL for {server.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-server-name">Server Name</Label>
                <Input
                  id="edit-server-name"
                  placeholder="my-server"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-server-url">Server URL</Label>
                <Input
                  id="edit-server-url"
                  placeholder="https://example.com/mcp"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditModalOpen(false);
                  // Reset form to original values
                  setEditName(server.name);
                  setEditUrl("url" in server.config ? server.config.url : "");
                }}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={isEditing}>
                {isEditing && <Loader className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
