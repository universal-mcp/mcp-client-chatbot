"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  authorizeServerAction,
  revokeAuthorizationAction,
} from "@/app/api/mcp/oauth/actions";
import type { MCPServerInfo } from "app-types/mcp";
import { useActiveOrganization } from "@/lib/auth/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DefaultServerConfig {
  id: string;
  name: string;
  url: string;
  badgeText: string;
}

interface McpServerWithId extends MCPServerInfo {
  id: string;
  isDefault?: boolean; // Flag to identify default servers
  defaultConfig?: DefaultServerConfig; // Store default server configuration
}

// Configuration for default servers - easily extensible for future servers
const DEFAULT_SERVERS: DefaultServerConfig[] = [
  {
    id: "default-agentr",
    name: "AgentR",
    url: "https://mcp.agentr.dev/sse",
    badgeText: "Recommended",
  },
  // Add more default servers here in the future
];

export default function IntegrationsPage() {
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerCredentialType, setNewServerCredentialType] = useState<
    "personal" | "shared"
  >("personal");
  const [loadingServerId] = useState<string | null>(null);
  const [addServerModalOpen, setAddServerModalOpen] = useState(false);
  const [defaultServerModalOpen, setDefaultServerModalOpen] = useState(false);
  const [selectedDefaultServer, setSelectedDefaultServer] =
    useState<DefaultServerConfig | null>(null);
  const [defaultServerCredentialType, setDefaultServerCredentialType] =
    useState<"personal" | "shared">("personal");

  // Get organization context to determine if we're in a workspace
  const { data: activeOrganization } = useActiveOrganization();
  const isOrganizationWorkspace = !!activeOrganization?.id;

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

  // Check which default servers already exist in the user's servers
  const existingServerNames = new Set(
    mcpServers?.map((server: McpServerWithId) => server.name) || [],
  );

  // Create default server objects for servers that don't exist yet
  const availableDefaultServers = useMemo(() => {
    return DEFAULT_SERVERS.filter(
      (config) => !existingServerNames.has(config.name),
    ).map((config) => ({
      id: config.id,
      name: config.name,
      status: "disconnected" as const,
      config: {
        url: config.url,
        credentialType: "personal" as const,
      },
      toolInfo: [],
      oauthStatus: {
        required: false,
        isAuthorized: false,
        hasToken: false,
      },
      isDefault: true,
      defaultConfig: config, // Store the config for easy access
    }));
  }, [existingServerNames]);

  // Combine default servers with actual servers for display
  const displayServers = useMemo(() => {
    if (!isLoadingData && isAdmin && availableDefaultServers.length > 0) {
      return [...availableDefaultServers, ...(mcpServers || [])];
    }
    return mcpServers || [];
  }, [isLoadingData, isAdmin, availableDefaultServers, mcpServers]);

  // Handle OAuth callback success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    const serverName = params.get("server");

    if (success === "authorized" && serverName) {
      toast.success(
        `Successfully authorized ${decodeURIComponent(serverName)}`,
      );
      // Clear URL parameters
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh data to get updated auth status
      mutate();
    } else if (error) {
      const errorDescription = params.get("error_description");
      toast.error(
        `Authorization failed: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`,
      );
      // Clear URL parameters
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [mutate]);

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
          credentialType:
            isOrganizationWorkspace && isAdmin
              ? newServerCredentialType
              : "personal",
        },
        userId: "",
      });

      toast.success("Server added successfully");
      setNewServerName("");
      setNewServerUrl("");
      setNewServerCredentialType("personal");
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

  const handleConnectDefaultServer = async (
    serverConfig: DefaultServerConfig,
  ) => {
    if (!isAdmin) {
      toast.error("MCP server management can only be done by admins");
      return;
    }

    setSelectedDefaultServer(serverConfig);

    // If in workspace, show credential type selection modal
    if (isOrganizationWorkspace) {
      setDefaultServerModalOpen(true);
      return;
    }

    // Otherwise, directly add with personal credentials
    await addDefaultServer(serverConfig, "personal");
  };

  const handleDefaultServerConnect = async () => {
    if (!selectedDefaultServer) return;
    await addDefaultServer(selectedDefaultServer, defaultServerCredentialType);
    setDefaultServerModalOpen(false);
    setSelectedDefaultServer(null);
  };

  const addDefaultServer = async (
    serverConfig: DefaultServerConfig,
    credentialType: "personal" | "shared",
  ) => {
    try {
      setIsAddingServer(true);

      // Check if server name already exists (safety check)
      const exists = await existMcpClientByServerNameAction(serverConfig.name);
      if (exists) {
        toast.error(`${serverConfig.name} server already exists`);
        return;
      }

      // Add the default server
      await saveMcpClientAction({
        name: serverConfig.name,
        config: {
          url: serverConfig.url,
          credentialType,
        },
        userId: "",
      });

      toast.success(`${serverConfig.name} server added successfully`);
      mutate();
    } catch (error) {
      toast.error(
        `Failed to add ${serverConfig.name} server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleKeyDownAddServer = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      !isAddingServer &&
      newServerName.trim() &&
      newServerUrl.trim()
    ) {
      e.preventDefault();
      handleAddServer();
    }
  };

  const handleKeyDownDefaultServer = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAddingServer && selectedDefaultServer) {
      e.preventDefault();
      handleDefaultServerConnect();
    }
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
    // Find the existing server to preserve its credentialType
    const existingServer = mcpServers?.find(
      (s: McpServerWithId) => s.id === serverId,
    );
    const existingCredentialType =
      existingServer && "url" in existingServer.config
        ? (existingServer.config as any).credentialType || "personal"
        : "personal";

    await saveMcpClientAction({
      id: serverId,
      name: name,
      config: {
        url: url,
        credentialType: existingCredentialType,
      },
      userId: "",
    });
    mutate();
  };

  const handleAuthorizeServer = async (serverId: string) => {
    try {
      // Get server credential type
      const server = mcpServers?.find(
        (s: McpServerWithId) => s.id === serverId,
      );
      const credentialType =
        server && "url" in server.config
          ? (server.config as any).credentialType || "personal"
          : "personal";

      const result = await authorizeServerAction(serverId, credentialType);
      if (result.success && result.authorizationUrl) {
        // Open authorization URL in new tab
        window.open(result.authorizationUrl, "_blank", "noopener,noreferrer");
        toast.info("Please complete authorization in the new tab");
      } else {
        toast.error(result.error || "Failed to initiate authorization");
      }
    } catch (error) {
      toast.error("Failed to start authorization process");
      console.error("Authorization error:", error);
    }
  };

  const handleRevokeAuthorization = async (serverId: string) => {
    try {
      // Get server credential type
      const server = mcpServers?.find(
        (s: McpServerWithId) => s.id === serverId,
      );
      const credentialType =
        server && "url" in server.config
          ? (server.config as any).credentialType || "personal"
          : "personal";

      const result = await revokeAuthorizationAction(serverId, credentialType);
      if (result.success) {
        toast.success("Authorization revoked successfully");
        // Refresh server data to update OAuth status
        mutate();
      } else {
        toast.error(result.error || "Failed to revoke authorization");
      }
    } catch (error) {
      toast.error("Failed to revoke authorization");
      console.error("Revoke authorization error:", error);
    }
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

          {!isLoadingData && displayServers && displayServers.length > 0 && (
            <div className="space-y-4">
              {displayServers.map((server: McpServerWithId) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isLoading={loadingServerId === server.id}
                  isAdmin={isAdmin}
                  onDelete={handleDeleteServer}
                  onRefresh={handleRefreshServer}
                  onEdit={handleEditServer}
                  onAuthorize={handleAuthorizeServer}
                  onRevokeAuth={handleRevokeAuthorization}
                  onConnect={
                    server.isDefault && server.defaultConfig
                      ? () => handleConnectDefaultServer(server.defaultConfig!)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {!isLoadingData &&
            (!mcpServers || mcpServers.length === 0) &&
            !isAdmin && (
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No integrations available
                </h3>
                <p className="text-muted-foreground mb-6">
                  Contact your administrator to set up MCP server integrations
                </p>
              </div>
            )}

          {/* Add Server Button */}
          {!isLoadingData && isAdmin && (
            <div className="flex justify-center">
              <Button
                onClick={handleAddServerClick}
                variant="outline"
                size="lg"
                className="border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Server
              </Button>
            </div>
          )}

          {/* Add Server Modal */}
          <Dialog
            open={addServerModalOpen}
            onOpenChange={setAddServerModalOpen}
          >
            <DialogContent onKeyDown={handleKeyDownAddServer}>
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
                {isOrganizationWorkspace && isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="credential-type">Credential Type</Label>
                    <Select
                      value={newServerCredentialType}
                      onValueChange={(value) =>
                        setNewServerCredentialType(
                          value as "personal" | "shared",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {newServerCredentialType === "personal"
                            ? "Personal"
                            : "Shared"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">
                          <div className="space-y-1">
                            <div className="font-medium">Personal</div>
                            <div className="text-xs text-muted-foreground">
                              Each user manages their own credentials
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="shared">
                          <div className="space-y-1">
                            <div className="font-medium">Shared</div>
                            <div className="text-xs text-muted-foreground">
                              Administrators manage credentials for all users
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddServerModalOpen(false);
                    setNewServerName("");
                    setNewServerUrl("");
                    setNewServerCredentialType("personal");
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

          {/* Default Server Connect Modal */}
          <Dialog
            open={defaultServerModalOpen}
            onOpenChange={setDefaultServerModalOpen}
          >
            <DialogContent onKeyDown={handleKeyDownDefaultServer}>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Add {selectedDefaultServer?.name}
                </DialogTitle>
                <DialogDescription className="mt-3 text-muted-foreground">
                  Choose how credentials should be managed for the integration.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default-server-credential-type">
                    Credential Type
                  </Label>
                  <Select
                    value={defaultServerCredentialType}
                    onValueChange={(value) =>
                      setDefaultServerCredentialType(
                        value as "personal" | "shared",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {defaultServerCredentialType === "personal"
                          ? "Personal"
                          : "Shared"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">
                        <div className="space-y-1">
                          <div className="font-medium">Personal</div>
                          <div className="text-xs text-muted-foreground">
                            Each user manages their own credentials
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="shared">
                        <div className="space-y-1">
                          <div className="font-medium">Shared</div>
                          <div className="text-xs text-muted-foreground">
                            Administrators manage credentials for all users
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDefaultServerModalOpen(false);
                    setDefaultServerCredentialType("personal");
                    setSelectedDefaultServer(null);
                  }}
                  disabled={isAddingServer}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDefaultServerConnect}
                  disabled={isAddingServer}
                >
                  {isAddingServer && (
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Add
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
  onAuthorize: (serverId: string) => Promise<void>;
  onRevokeAuth: (serverId: string) => Promise<void>;
  onConnect?: () => Promise<void>;
}

function ServerCard({
  server,
  isLoading,
  isAdmin,
  onDelete,
  onRefresh,
  onEdit,
  onAuthorize,
  onRevokeAuth,
  onConnect,
}: ServerCardProps) {
  // Get organization context to determine if we should show credential type badge
  const { data: activeOrganization } = useActiveOrganization();
  const isOrganizationWorkspace = !!activeOrganization?.id;
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

  const handleKeyDownEdit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isEditing && editName.trim() && editUrl.trim()) {
      e.preventDefault();
      handleEdit();
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
            {/* Show credential type badge for servers in organization workspaces (but not for default servers) */}
            {isOrganizationWorkspace && !server.isDefault && (
              <Badge
                variant="secondary"
                className={`text-xs ${
                  (server.config as any).credentialType === "shared"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {(server.config as any).credentialType === "shared"
                  ? "Shared Credentials"
                  : "Personal Credentials"}
              </Badge>
            )}
            {/* Show default badge for default servers */}
            {server.isDefault && server.defaultConfig && (
              <Badge
                variant="outline"
                className="text-xs bg-blue-50 text-blue-700 border-blue-200"
              >
                {server.defaultConfig.badgeText}
              </Badge>
            )}
            {/* Show OAuth authorization status for servers */}
            {server.oauthStatus.required && (
              <Badge
                variant={
                  server.oauthStatus.isAuthorized ? "default" : "outline"
                }
                className={`text-xs ${
                  server.oauthStatus.isAuthorized
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : "bg-orange-100 text-orange-800 hover:bg-orange-100"
                }`}
              >
                {server.oauthStatus.isAuthorized
                  ? "Authorized"
                  : "Not Authorized"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Show Connect button for default servers */}
            {server.isDefault && onConnect && (
              <Button
                variant="default"
                size="sm"
                onClick={onConnect}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm border border-primary/20 hover:shadow-md transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            )}

            {/* Show regular action buttons for non-default servers */}
            {!server.isDefault && (
              <>
                {/* Show authorize button only for servers that require OAuth and user has permission */}
                {server.oauthStatus.required &&
                  (() => {
                    const isSharedCredentials =
                      isOrganizationWorkspace &&
                      (server.config as any).credentialType === "shared";
                    // Only show button if: not shared credentials OR user is admin
                    if (isSharedCredentials && !isAdmin) {
                      return null;
                    }

                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (server.oauthStatus.hasToken) {
                            onRevokeAuth(server.id);
                          } else {
                            onAuthorize(server.id);
                          }
                        }}
                        className={
                          server.oauthStatus.hasToken
                            ? "hover:bg-red-50 hover:text-red-600"
                            : "hover:bg-green-50 hover:text-green-600"
                        }
                      >
                        {server.oauthStatus.hasToken ? (
                          <>Revoke</>
                        ) : (
                          <>Connect</>
                        )}
                      </Button>
                    );
                  })()}
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
                          Are you sure you want to delete {server.name}? This
                          action cannot be undone.
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
              </>
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

      {/* Edit Modal - Only render for admin users and non-default servers */}
      {isAdmin && !server.isDefault && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent onKeyDown={handleKeyDownEdit}>
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
