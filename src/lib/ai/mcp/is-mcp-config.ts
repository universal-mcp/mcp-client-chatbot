import type { MCPServerConfig, MCPRemoteConfig } from "app-types/mcp";

/**
 * Type guard to check if an object is potentially a valid remote config (sse,streamable)
 */
export function isMaybeRemoteConfig(
  config: unknown,
): config is MCPRemoteConfig {
  if (typeof config !== "object" || config === null) {
    return false;
  }
  return "url" in config && typeof config.url === "string";
}

/**
 * Type guard for MCP server config (remote-only)
 */
export function isMaybeMCPServerConfig(
  config: unknown,
): config is MCPServerConfig {
  return isMaybeRemoteConfig(config);
}
