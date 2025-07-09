"use server";

import { getSessionContext } from "@/lib/auth/session-context";
import { pgProjectMcpConfigRepository } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";
import type {
  ProjectMcpServerConfig,
  ProjectMcpToolConfig,
} from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";

export async function getProjectMcpConfigAction(projectId: string) {
  const { userId, organizationId } = await getSessionContext();

  return pgProjectMcpConfigRepository.getProjectMcpConfig(
    projectId,
    userId,
    organizationId,
  );
}

export async function bulkUpdateProjectMcpServersAction(
  projectId: string,
  configs: ProjectMcpServerConfig[],
) {
  await pgProjectMcpConfigRepository.bulkSetProjectMcpServerConfigs(
    projectId,
    configs,
  );

  return { success: true };
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

export async function initializeProjectMcpConfigAction(projectId: string) {
  const { userId, organizationId } = await getSessionContext();

  await pgProjectMcpConfigRepository.initializeProjectDefaults(
    projectId,
    userId,
    organizationId,
  );

  return { success: true };
}
