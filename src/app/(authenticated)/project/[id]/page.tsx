"use client";
import { selectProjectByIdAction } from "@/app/api/chat/actions";
import { appStore } from "@/app/store";
import { ProjectDropdown } from "@/components/project-dropdown";
import { ProjectSystemMessagePopup } from "@/components/project-system-message-popup";
import { ProjectMcpConfigPopup } from "@/components/project-mcp-config-popup";
import { ProjectConversationsModal } from "@/components/project-conversations-modal";
import ChatBot from "@/components/chat-bot";

import {
  Loader,
  MoreHorizontal,
  FileUp,
  Pencil,
  MessagesSquare,
  Settings2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import useSWR from "swr";
import { Button } from "ui/button";
import { notImplementedToast } from "ui/shared-toast";
import { useShallow } from "zustand/shallow";
import { generateUUID } from "lib/utils";
import { Project } from "app-types/chat";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function FeatureCard({ title, description, icon, onClick }: FeatureCardProps) {
  return (
    <div
      className="flex-1 border rounded-2xl p-4 hover:bg-card transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start">
        <div className="flex-1">
          <h3 className="font-medium mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-center h-full my-auto ml-4">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const t = useTranslations("Chat.Project");
  const {
    data: project,
    isLoading,
    mutate: fetchProject,
  } = useSWR(
    `/projects/${id}`,
    async () => {
      const project = await selectProjectByIdAction(id as string);
      if (!project) {
        router.push("/");
      }
      return project;
    },
    {
      revalidateOnFocus: false,
    },
  );

  const router = useRouter();
  const threadId = useMemo(() => generateUUID(), []);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showMcpConfig, setShowMcpConfig] = useState(false);
  const [showConversations, setShowConversations] = useState(false);

  const [appStoreMutate] = appStore(useShallow((state) => [state.mutate]));

  useEffect(() => {
    appStoreMutate({
      currentProjectId: id as string,
      currentThreadId: threadId,
    });
    return () => {
      appStoreMutate({
        currentProjectId: undefined,
        currentThreadId: undefined,
      });
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader className="size-5 animate-spin" />
      </div>
    );
  }

  const projectEmptySlot = (
    <div className="max-w-3xl mx-auto fade-in animate-in w-full">
      <div className="px-6 py-6">
        <div className="mb-4"></div>
        <div className="flex items-center gap-1">
          <h1 className="text-4xl font-semibold truncate">{project?.name}</h1>
          <div className="flex-1" />
          {project?.threads && project.threads.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowConversations(true)}
              className="mr-2"
            >
              <MessagesSquare size={16} className="mr-2" />
              View past conversations
            </Button>
          )}
          <ProjectDropdown project={project ?? { id: id as string, name: "" }}>
            <Button
              variant="ghost"
              size="icon"
              className="data-[state=open]:bg-secondary!"
            >
              <MoreHorizontal />
            </Button>
          </ProjectDropdown>
        </div>
      </div>

      <div className="flex my-4 px-4 gap-4">
        <FeatureCard
          title="Add Files"
          onClick={notImplementedToast}
          description={t("chatInThisProjectCanAccessFileContents")}
          icon={<FileUp size={18} className="text-muted-foreground" />}
        />
        <FeatureCard
          title="Add Instructions"
          description={
            project?.instructions?.systemPrompt ||
            t(
              "writeHowTheChatbotShouldRespondToThisProjectOrWhatInformationItNeeds",
            )
          }
          icon={<Pencil size={18} className="text-muted-foreground" />}
          onClick={() => {
            project && setSelectedProject(project);
          }}
        />
        <FeatureCard
          title="Configure Tools"
          description="Manage which MCP tools are available and how they behave"
          icon={<Settings2 size={18} className="text-muted-foreground" />}
          onClick={() => setShowMcpConfig(true)}
        />
      </div>

      <div className="my-8 px-4"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-w-0 relative h-full">
      <ChatBot
        threadId={threadId}
        initialMessages={[]}
        projectId={id as string}
        slots={{
          emptySlot: <div className="pt-6">{projectEmptySlot}</div>,
          inputBottomSlot: (
            <>
              <ProjectSystemMessagePopup
                isOpen={!!selectedProject}
                onOpenChange={() => setSelectedProject(null)}
                projectId={id as string}
                beforeSystemMessage={
                  selectedProject?.instructions?.systemPrompt
                }
                onSave={() => {
                  fetchProject();
                }}
              />
              <ProjectMcpConfigPopup
                isOpen={showMcpConfig}
                onOpenChange={setShowMcpConfig}
                projectId={id as string}
              />
              <ProjectConversationsModal
                isOpen={showConversations}
                onOpenChange={setShowConversations}
                project={project ?? null}
                onThreadDeleted={fetchProject}
              />
            </>
          ),
        }}
      />
    </div>
  );
}
