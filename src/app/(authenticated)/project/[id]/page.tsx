"use client";

import { AssistantEditor } from "@/components/assistant-editor";
import { useParams } from "next/navigation";

export default function ProjectPage() {
  const { id } = useParams();

  return <AssistantEditor projectId={id as string} />;
}
