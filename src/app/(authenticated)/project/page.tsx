"use client";

import {
  selectProjectListByUserIdAction,
  insertProjectAction,
} from "@/app/api/chat/actions";
import { CreateProjectPopup } from "@/components/create-project-popup";
import { ProjectDropdown } from "@/components/project-dropdown";
import {
  Bot,
  Plus,
  Loader,
  MessageSquare,
  Sparkles,
  Code,
  Briefcase,
  GraduationCap,
  Heart,
  FileText,
  Palette,
  MoreHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { handleErrorWithToast } from "ui/shared-toast";
import { Badge } from "ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { toast } from "sonner";
import { safe } from "ts-safe";

interface AssistantCardProps {
  id: string;
  name: string;
  description?: string;
  lastActiveAt?: string;
  onClick: () => void;
  project?: any; // Full project object for dropdown
}

interface AssistantTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const ASSISTANT_TEMPLATES: AssistantTemplate[] = [
  {
    id: "coding-assistant",
    name: "Coding Assistant",
    description:
      "A programming companion that helps with code review, debugging, and best practices",
    instructions:
      "You are an expert software developer and programming mentor. Help users with:\n\n• Code review and optimization\n• Debugging complex issues\n• Explaining programming concepts clearly\n• Suggesting best practices and design patterns\n• Writing clean, maintainable code\n\nAlways provide clear explanations, include examples, and consider edge cases. Focus on teaching principles that help users become better developers.",
    icon: Code,
    category: "Development",
  },
  {
    id: "business-analyst",
    name: "Business Analyst",
    description:
      "Strategic business advisor for market analysis, planning, and decision-making",
    instructions:
      "You are a seasoned business analyst and strategic advisor. Assist users with:\n\n• Market analysis and competitive research\n• Business plan development and validation\n• Financial modeling and projections\n• Process optimization and workflow analysis\n• Risk assessment and mitigation strategies\n• Data-driven decision making\n\nProvide actionable insights backed by business principles. Ask clarifying questions to understand the specific business context and goals.",
    icon: Briefcase,
    category: "Business",
  },
  {
    id: "learning-tutor",
    name: "Learning Tutor",
    description: "Patient educator that adapts to your learning style and pace",
    instructions:
      "You are a patient, knowledgeable tutor dedicated to helping students learn effectively. Your approach:\n\n• Adapt explanations to the user's learning level\n• Break down complex topics into manageable steps\n• Use analogies and real-world examples\n• Encourage questions and critical thinking\n• Provide practice exercises and check understanding\n• Celebrate progress and maintain motivation\n\nAlways gauge the user's current understanding before diving deeper. Make learning engaging and accessible.",
    icon: GraduationCap,
    category: "Education",
  },
  {
    id: "wellness-coach",
    name: "Wellness Coach",
    description:
      "Supportive guide for mental health, fitness, and personal well-being",
    instructions:
      "You are a compassionate wellness coach focused on holistic health and well-being. Support users with:\n\n• Stress management and mindfulness techniques\n• Healthy lifestyle habits and routines\n• Goal setting and motivation\n• Work-life balance strategies\n• Self-care practices and mental health awareness\n• Fitness and nutrition guidance (general advice only)\n\nProvide encouraging, non-judgmental support. Always recommend professional help for serious health concerns. Focus on sustainable, positive changes.",
    icon: Heart,
    category: "Health & Wellness",
  },
  {
    id: "content-writer",
    name: "Content Writer",
    description:
      "Creative writing assistant for blogs, marketing, and storytelling",
    instructions:
      "You are a skilled content writer and creative strategist. Help users create compelling content:\n\n• Blog posts and articles with engaging narratives\n• Marketing copy that converts and resonates\n• Social media content with strong hooks\n• Email campaigns and newsletters\n• Creative storytelling and narrative structure\n• SEO optimization and audience targeting\n\nFocus on clarity, engagement, and purpose. Understand the target audience and desired outcomes. Provide multiple variations when helpful.",
    icon: FileText,
    category: "Creative",
  },
  {
    id: "design-consultant",
    name: "Design Consultant",
    description:
      "Creative advisor for UI/UX, branding, and visual design projects",
    instructions:
      "You are an experienced design consultant with expertise in visual communication and user experience. Guide users through:\n\n• UI/UX design principles and best practices\n• Brand identity development and visual systems\n• Color theory, typography, and layout design\n• User research and design thinking methodologies\n• Design critique and improvement suggestions\n• Accessibility and inclusive design practices\n\nProvide thoughtful design rationale and consider both aesthetics and functionality. Help users understand design principles that create effective, user-centered solutions.",
    icon: Palette,
    category: "Design",
  },
];

interface TemplateCardProps {
  template: AssistantTemplate;
  onClick: () => void;
}

function TemplateCard({ template, onClick }: TemplateCardProps) {
  const IconComponent = template.icon;

  return (
    <Card
      className="h-full cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent-foreground/20 group"
      onClick={onClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <IconComponent className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold truncate">
                {template.name}
              </CardTitle>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {template.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {template.category}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TemplateModalProps {
  template: AssistantTemplate | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (template: AssistantTemplate) => void;
  isAdding: boolean;
}

function TemplateModal({
  template,
  isOpen,
  onOpenChange,
  onAdd,
  isAdding,
}: TemplateModalProps) {
  if (!template) return null;

  const IconComponent = template.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconComponent className="size-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{template.name}</DialogTitle>
              <DialogDescription className="text-base mt-1">
                {template.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Category</h4>
            <Badge variant="secondary">{template.category}</Badge>
          </div>

          <div>
            <h4 className="font-medium mb-2">Assistant Instructions</h4>
            <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap h-40 overflow-y-auto">
              {template.instructions}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onAdd(template)}
            disabled={isAdding}
            className="gap-2"
          >
            {isAdding && <Loader className="size-4 animate-spin" />}
            Add Assistant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssistantCard({
  id,
  name,
  description,
  lastActiveAt,
  onClick,
  project,
}: AssistantCardProps) {
  const t = useTranslations("Chat.Project");

  const formatLastActive = (dateString?: string) => {
    if (!dateString || dateString === "1970-01-01 00:00:00")
      return "Never used";

    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent card click when clicking on dropdown
    if ((e.target as HTMLElement).closest("[data-dropdown-trigger]")) {
      return;
    }
    onClick();
  };

  return (
    <Card
      key={id}
      className="h-full cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent-foreground/20 group"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Bot className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold truncate">
                {name}
              </CardTitle>
            </div>
          </div>

          {project && (
            <ProjectDropdown project={project}>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                data-dropdown-trigger
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </ProjectDropdown>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {description ||
              t(
                "writeHowTheChatbotShouldRespondToThisProjectOrWhatInformationItNeeds",
              )}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {formatLastActive(lastActiveAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesContent() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<AssistantTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();
  const t = useTranslations("Chat.Project");

  const handleTemplateClick = (template: AssistantTemplate) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleAddTemplate = async (template: AssistantTemplate) => {
    setIsAdding(true);

    safe(() =>
      insertProjectAction({
        name: template.name,
        instructions: {
          systemPrompt: template.instructions,
        },
        mcpConfig: { tools: [] },
      }),
    )
      .watch(() => setIsAdding(false))
      .ifOk(() => setIsModalOpen(false))
      .ifOk(() => toast.success(t("projectCreated")))
      .ifOk(() => mutate("projects"))
      .ifOk((project) => router.push(`/project/${project.id}`))
      .ifFail(handleErrorWithToast);
  };

  return (
    <>
      <div className="flex justify-center">
        <div
          className="flex flex-wrap gap-6 justify-start"
          style={{ maxWidth: "1008px" }}
        >
          {ASSISTANT_TEMPLATES.map((template) => (
            <div key={template.id} className="w-80">
              <TemplateCard
                template={template}
                onClick={() => handleTemplateClick(template)}
              />
            </div>
          ))}
        </div>
      </div>

      <TemplateModal
        template={selectedTemplate}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onAdd={handleAddTemplate}
        isAdding={isAdding}
      />
    </>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("assistants");

  const {
    data: projects = [],
    isLoading,
    isValidating,
  } = useSWR("projects", selectProjectListByUserIdAction, {
    onError: handleErrorWithToast,
    revalidateOnFocus: false,
  });

  const handleAssistantClick = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  const renderAssistantsContent = () => {
    if (isLoading || isValidating) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader className="size-5 animate-spin" />
          </div>
        </div>
      );
    }

    if (projects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <Bot className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No assistants yet</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            Create your first assistant to get started with organized
            conversations and custom instructions.
          </p>
          <CreateProjectPopup>
            <Button className="gap-2">
              <Plus className="size-4" />
              Create Your First Assistant
            </Button>
          </CreateProjectPopup>
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div
          className="flex flex-wrap gap-6 justify-start"
          style={{ maxWidth: "1008px" }}
        >
          {projects.map((project) => (
            <div key={project.id} className="w-80">
              <AssistantCard
                id={project.id}
                name={project.name}
                description={(project as any).instructions?.systemPrompt}
                lastActiveAt={(project as any).lastThreadAt}
                onClick={() => handleAssistantClick(project.id)}
                project={project}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-center p-6">
          <div
            className="flex items-center justify-between w-full"
            style={{ maxWidth: "1008px" }}
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Assistants
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your AI assistants and their configurations
              </p>
            </div>

            <CreateProjectPopup>
              <Button className="gap-2">
                <Plus className="size-4" />
                Add Assistant
              </Button>
            </CreateProjectPopup>
          </div>
        </div>
      </div>

      {/* Content with Tabs */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="flex justify-center mb-6">
              <TabsList>
                <TabsTrigger value="assistants" className="gap-2">
                  <Bot className="size-4" />
                  My Assistants
                </TabsTrigger>
                <TabsTrigger value="templates" className="gap-2">
                  <Sparkles className="size-4" />
                  Templates
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="assistants" className="mt-0">
              {renderAssistantsContent()}
            </TabsContent>

            <TabsContent value="templates" className="mt-0">
              <TemplatesContent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
