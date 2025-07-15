"use server";

import { getSessionContext } from "@/lib/auth/session-context";
import { pgProjectMcpConfigRepository } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";
import type { ProjectMcpToolConfig } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";

export async function getProjectMcpConfigAction(projectId: string | null) {
  if (!projectId) {
    return null;
  }
  const { userId, organizationId } = await getSessionContext();

  return pgProjectMcpConfigRepository.getProjectMcpConfig(
    projectId,
    userId,
    organizationId,
  );
}

export async function bulkUpdateProjectMcpToolsAction(
  projectId: string,
  configs: ProjectMcpToolConfig[],
) {
  await pgProjectMcpConfigRepository.bulkSetProjectMcpToolConfigs(
    projectId,
    configs,
  );

  return { success: true };
}

export async function initializeProjectMcpConfigAction(_projectId: string) {
  await pgProjectMcpConfigRepository.initializeProjectDefaults();

  return { success: true };
}
