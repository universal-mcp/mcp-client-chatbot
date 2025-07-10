"use client";
import { insertProjectAction } from "@/app/api/chat/actions";
import { Lightbulb, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import React, {
  KeyboardEvent,
  PropsWithChildren,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { safe } from "ts-safe";
import { Button } from "ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { handleErrorWithToast } from "ui/shared-toast";
import { useTranslations } from "next-intl";
import { ProjectMcpConfig } from "./project-mcp-config";
import type { ProjectMcpToolConfig } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";

export function CreateProjectPopup({ children }: PropsWithChildren) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [step, setStep] = useState<"details" | "mcpConfig">("details");
  const [mcpConfig, setMcpConfig] = useState<{
    tools: ProjectMcpToolConfig[];
  }>({ tools: [] });

  const router = useRouter();

  const handleCreate = async () => {
    safe(() => setIsLoading(true))
      .map(() => insertProjectAction({ name, mcpConfig }))
      .watch(() => setIsLoading(false))
      .ifOk(() => setIsOpen(false))
      .ifOk(() => toast.success(t("Chat.Project.projectCreated")))
      .ifOk(() => mutate("projects"))
      .ifOk((project) => router.push(`/project/${project.id}`))
      .ifFail(handleErrorWithToast);
  };

  const handleEnterKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && name.trim()) {
      if (step === "details") {
        setStep("mcpConfig");
      } else {
        handleCreate();
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setStep("details");
      setMcpConfig({ tools: [] });
    }
  }, [isOpen]);

  const renderDetailsStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t("Chat.Project.project")}</DialogTitle>
        <DialogDescription asChild>
          <div className="my-2 p-4 flex bg-muted rounded-lg gap-2">
            <div className="px-2">
              <Lightbulb className="size-4 text-accent-foreground animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-accent-foreground mb-1">
                {t("Chat.Project.whatIsAProject")}
              </p>
              {t(
                "Chat.Project.aProjectAllowsYouToOrganizeYourFilesAndCustomInstructionsInOneConvenientPlace",
              )}
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 w-full">
        <Label htmlFor="name">{t("Chat.Project.projectName")}</Label>
        <Input
          autoFocus
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleEnterKey}
          placeholder={t("Chat.Project.enterNameForNewProject")}
          className="w-full bg-card"
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setIsOpen(false)}>
          {t("Common.cancel")}
        </Button>
        <Button
          onClick={() => setStep("mcpConfig")}
          disabled={!name.trim()}
          variant={"secondary"}
        >
          {t("Common.next")}
        </Button>
      </DialogFooter>
    </>
  );

  const renderMcpConfigStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Configure MCP Tools (Optional)</DialogTitle>
        <DialogDescription>
          Choose which tools the assistant can use in this project.
        </DialogDescription>
      </DialogHeader>
      <div className="flex-grow overflow-hidden">
        <ProjectMcpConfig onConfigChange={setMcpConfig} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setStep("details")}>
          {t("Common.back")}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          onClick={handleCreate}
          variant={"secondary"}
        >
          {isLoading && <Loader className="size-4 animate-spin" />}
          {t("Common.create")}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={
          step === "details"
            ? "sm:max-w-[500px] bg-card"
            : "max-w-5xl w-[50rem] min-w-[50rem] max-h-[90vh] flex flex-col bg-card"
        }
      >
        {step === "details" ? renderDetailsStep() : renderMcpConfigStep()}
      </DialogContent>
    </Dialog>
  );
}
