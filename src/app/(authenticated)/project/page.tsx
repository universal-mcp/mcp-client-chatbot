"use client";

import { appStore } from "@/app/store";
import { ProjectDropdown } from "@/components/project-dropdown";
import {
  Bot,
  Plus,
  MessageSquare,
  Sparkles,
  Code,
  Briefcase,
  GraduationCap,
  Heart,
  FileText,
  Palette,
  MoreHorizontal,
  Loader,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import { useShallow } from "zustand/shallow";

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
  expert: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ASSISTANT_TEMPLATES: AssistantTemplate[] = [
  {
    id: "coding-assistant",
    name: "Coding Assistant",
    description:
      "A programming companion that helps with code review, debugging, and best practices",
    instructions:
      "You are an expert software developer and programming mentor. Help users with:\n\n• Code review and optimization\n• Debugging complex issues\n• Explaining programming concepts clearly\n• Suggesting best practices and design patterns\n• Writing clean, maintainable code\n\nAlways provide clear explanations, include examples, and consider edge cases. Focus on teaching principles that help users become better developers.",
    expert: "software development and programming",
    icon: Code,
  },
  {
    id: "business-analyst",
    name: "Business Analyst",
    description:
      "Strategic business advisor for market analysis, planning, and decision-making",
    instructions:
      "You are a seasoned business analyst and strategic advisor. Assist users with:\n\n• Market analysis and competitive research\n• Business plan development and validation\n• Financial modeling and projections\n• Process optimization and workflow analysis\n• Risk assessment and mitigation strategies\n• Data-driven decision making\n\nProvide actionable insights backed by business principles. Ask clarifying questions to understand the specific business context and goals.",
    expert: "business analysis and strategic planning",
    icon: Briefcase,
  },
  {
    id: "learning-tutor",
    name: "Learning Tutor",
    description: "Patient educator that adapts to your learning style and pace",
    instructions:
      "You are a patient, knowledgeable tutor dedicated to helping students learn effectively. Your approach:\n\n• Adapt explanations to the user's learning level\n• Break down complex topics into manageable steps\n• Use analogies and real-world examples\n• Encourage questions and critical thinking\n• Provide practice exercises and check understanding\n• Celebrate progress and maintain motivation\n\nAlways gauge the user's current understanding before diving deeper. Make learning engaging and accessible.",
    expert: "education and tutoring",
    icon: GraduationCap,
  },
  {
    id: "wellness-coach",
    name: "Wellness Coach",
    description:
      "Supportive guide for mental health, fitness, and personal well-being",
    instructions:
      "You are a compassionate wellness coach focused on holistic health and well-being. Support users with:\n\n• Stress management and mindfulness techniques\n• Healthy lifestyle habits and routines\n• Goal setting and motivation\n• Work-life balance strategies\n• Self-care practices and mental health awareness\n• Fitness and nutrition guidance (general advice only)\n\nProvide encouraging, non-judgmental support. Always recommend professional help for serious health concerns. Focus on sustainable, positive changes.",
    expert: "wellness and personal health",
    icon: Heart,
  },
  {
    id: "content-writer",
    name: "Content Writer",
    description:
      "Creative writing assistant for blogs, marketing, and storytelling",
    instructions:
      "You are a skilled content writer and creative strategist. Help users create compelling content:\n\n• Blog posts and articles with engaging narratives\n• Marketing copy that converts and resonates\n• Social media content with strong hooks\n• Email campaigns and newsletters\n• Creative storytelling and narrative structure\n• SEO optimization and audience targeting\n\nFocus on clarity, engagement, and purpose. Understand the target audience and desired outcomes. Provide multiple variations when helpful.",
    expert: "content writing and creative storytelling",
    icon: FileText,
  },
  {
    id: "design-consultant",
    name: "Design Consultant",
    description:
      "Creative advisor for UI/UX, branding, and visual design projects",
    instructions:
      "You are an experienced design consultant with expertise in visual communication and user experience. Guide users through:\n\n• UI/UX design principles and best practices\n• Brand identity development and visual systems\n• Color theory, typography, and layout design\n• User research and design thinking methodologies\n• Design critique and improvement suggestions\n• Accessibility and inclusive design practices\n\nProvide thoughtful design rationale and consider both aesthetics and functionality. Help users understand design principles that create effective, user-centered solutions.",
    expert: "UI/UX design and visual communication",
    icon: Palette,
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

          {/* Removed category display */}
        </div>
      </CardContent>
    </Card>
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
      className="h-full cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent-foreground/20 group overflow-hidden"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors flex-shrink-0">
              <Bot className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold truncate">
                {name}
              </CardTitle>
            </div>
          </div>

          {project && (
            <div className="flex-shrink-0">
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
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MessageSquare className="size-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
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
  const router = useRouter();

  const handleTemplateClick = (template: AssistantTemplate) => {
    // Navigate directly to the new assistant page with template data
    router.push(
      `/project/new?template=${encodeURIComponent(
        JSON.stringify({
          name: template.name,
          description: template.description,
          instructions: template.instructions,
          expert: template.expert,
        }),
      )}`,
    );
  };

  return (
    <>
      <div className="flex justify-center">
        <div
          className="flex flex-wrap gap-6 justify-center"
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
    </>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("assistants");

  const [projectList, isProjectListLoading] = appStore(
    useShallow((state) => [state.projectList, state.isProjectListLoading]),
  );

  const handleAssistantClick = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  const renderAssistantsContent = () => {
    // Add loader component
    if (isProjectListLoading) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader className="size-5 animate-spin" />
          </div>
        </div>
      );
    }

    if (projectList.length === 0) {
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
          <Button className="gap-2" onClick={() => router.push("/project/new")}>
            <Plus className="size-4" />
            Create Your First Assistant
          </Button>
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div
          className="flex flex-wrap gap-6 justify-center"
          style={{ maxWidth: "1008px" }}
        >
          {projectList.map((project) => (
            <div key={project.id} className="w-80">
              <AssistantCard
                id={project.id}
                name={project.name}
                description={project.description}
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

            <Button
              className="gap-2"
              onClick={() => router.push("/project/new")}
            >
              <Plus className="size-4" />
              Add Assistant
            </Button>
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
