"use server";

import { pgProjectMcpConfigRepository } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";
import type { ProjectMcpToolConfig } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";

export async function getProjectMcpToolsAction(
  projectId: string,
): Promise<ProjectMcpToolConfig[]> {
  return pgProjectMcpConfigRepository.getProjectMcpTools(projectId);
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
