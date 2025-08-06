"use client";

import { AgentEditor } from "@/components/agent-editor";
import { useParams } from "next/navigation";

export default function ProjectPage() {
  const { id } = useParams();

  return <AgentEditor projectId={id as string} />;
}
