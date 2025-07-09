"use client";

import { SidebarGroupLabel, SidebarMenuAction } from "ui/sidebar";
import Link from "next/link";
import { SidebarMenuButton, SidebarMenuSkeleton } from "ui/sidebar";
import { SidebarGroupContent, SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroup } from "ui/sidebar";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Folders,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";
import { appStore } from "@/app/store";
import { Button } from "ui/button";

import { useShallow } from "zustand/shallow";

import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import useSWR from "swr";
import { selectProjectListByUserIdAction } from "@/app/api/chat/actions";
import { handleErrorWithToast } from "ui/shared-toast";
import { CreateProjectPopup } from "../create-project-popup";
import { ProjectDropdown } from "../project-dropdown";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function AppSidebarProjects() {
  const mounted = useMounted();
  const t = useTranslations("Layout");

  const [expanded, setExpanded] = useState(false);
  const [storeMutate, currentProjectId] = appStore(
    useShallow((state) => [state.mutate, state.currentProjectId]),
  );

  const {
    data: projectList,
    isLoading,
    isValidating,
  } = useSWR("projects", selectProjectListByUserIdAction, {
    onError: handleErrorWithToast,
    fallbackData: [],
    onSuccess: (data) => storeMutate({ projectList: data }),
  });

  const visibleProjects = expanded ? projectList : projectList.slice(0, 3);
  const hasMoreProjects = projectList.length > 3;

  return (
    <SidebarGroup>
      <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/projects">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarGroupLabel className="">
              <h4 className="text-xs text-muted-foreground flex items-center gap-1 group-hover/projects:text-foreground transition-colors">
                {/* {t("projects")} */}
                Assistants
              </h4>
              <div className="flex-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <CreateProjectPopup>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover/projects:opacity-100 hover:bg-input!"
                    >
                      <Plus />
                    </Button>
                  </CreateProjectPopup>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{t("newProject")}</p>
                </TooltipContent>
              </Tooltip>
            </SidebarGroupLabel>

            {isLoading || isValidating ? (
              Array.from({ length: 2 }).map(
                (_, index) => mounted && <SidebarMenuSkeleton key={index} />,
              )
            ) : projectList.length == 0 ? (
              <div className="px-2 mt-1">
                <CreateProjectPopup>
                  <div className="py-4 px-4 hover:bg-accent rounded-2xl cursor-pointer flex justify-between items-center">
                    <div className="gap-1">
                      <p className="font-semibold mb-1">{t("createProject")}</p>
                      <p className="text-muted-foreground">
                        {t("toOrganizeIdeas")}
                      </p>
                    </div>
                    <FolderOpen className="size-4" />
                  </div>
                </CreateProjectPopup>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {visibleProjects?.map((project) => {
                  const isSelected = currentProjectId === project.id;
                  return (
                    <SidebarMenu
                      key={project.id}
                      className={"group/project mr-0"}
                    >
                      <SidebarMenuItem className="px-2 cursor-pointer">
                        <ProjectDropdown project={project} side="right">
                          <SidebarMenuButton
                            asChild
                            isActive={isSelected}
                            className="data-[state=open]:bg-input!"
                          >
                            <div className="flex gap-1">
                              <div className="p-1 rounded-md hover:bg-foreground/40">
                                <FolderOpen className="size-4" />
                              </div>

                              <Link
                                href={`/project/${project.id}`}
                                className="flex items-center min-w-0 w-full"
                              >
                                <p className="truncate">{project.name}</p>
                              </Link>
                              <SidebarMenuAction className="opacity-0 group-hover/project:opacity-100 mr-2">
                                <MoreHorizontal className="size-4" />
                              </SidebarMenuAction>
                            </div>
                          </SidebarMenuButton>
                        </ProjectDropdown>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  );
                })}

                {hasMoreProjects && (
                  <SidebarMenu className="group/project mr-0">
                    <SidebarMenuItem className="px-2 cursor-pointer">
                      <SidebarMenuButton
                        asChild
                        onClick={() => setExpanded(!expanded)}
                      >
                        <div className="flex gap-1 text-muted-foreground">
                          <div className="p-1 rounded-md hover:bg-foreground/40">
                            <Folders className="size-4" />
                          </div>

                          <p>
                            {expanded
                              ? t("showLessProjects", {
                                  count: projectList.length - 3,
                                })
                              : t("showMoreProjects", {
                                  count: projectList.length - 3,
                                })}
                          </p>

                          {expanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                )}
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
