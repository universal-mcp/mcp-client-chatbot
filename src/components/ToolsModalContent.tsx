"use client";

import { ReactNode, useState, useMemo } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import JsonView from "@/components/ui/json-view";
import { Input } from "@/components/ui/input";
import { MCPToolInfo } from "app-types/mcp";
import { Wrench } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Helper function to check if schema is empty
const isEmptySchema = (schema: any): boolean => {
  if (!schema) return true;
  // Check properties first if available, otherwise check the schema itself
  const dataToCheck = schema.properties || schema;
  return Object.keys(dataToCheck).length === 0;
};

interface ToolsModalContentProps {
  tools: MCPToolInfo[];
  serverName: string;
  title?: ReactNode;
}

export function ToolsModalContent({
  tools,
  serverName,
  title,
}: ToolsModalContentProps) {
  const [search, setSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<MCPToolInfo | null>(null);

  const filteredTools = useMemo(() => {
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tools, search]);

  if (selectedTool) {
    return (
      <div className="flex flex-col h-[70vh] px-4">
        <div className="flex-shrink-0">
          <button
            onClick={() => setSelectedTool(null)}
            className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors mb-4"
          >
            ← Back
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DialogHeader className="px-0">
            <DialogTitle className="text-lg font-semibold mb-1">
              {selectedTool.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              {selectedTool.description}
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />

          <div className="flex items-center gap-2 mb-4">
            <h5 className="text-xs font-medium">Input Schema</h5>
          </div>
          {selectedTool.inputSchema ? (
            <div className="bg-card card p-4 rounded">
              {!isEmptySchema(selectedTool.inputSchema) ? (
                <JsonView
                  data={
                    selectedTool.inputSchema?.properties ||
                    selectedTool.inputSchema
                  }
                />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No schema properties available
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No schema properties available
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70vh] px-4">
      <div className="flex-shrink-0">
        <DialogHeader className="px-0">
          <DialogTitle className="flex items-center gap-2 mb-2">
            {title || `${serverName} Tools`}
          </DialogTitle>
          <DialogDescription>
            Available tools and their descriptions
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="mb-4"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 pr-2">
          {filteredTools.length === 0 ? (
            <Alert className="cursor-pointer py-8">
              <Wrench className="size-3.5" />
              <div className="flex w-full gap-2 items-center">
                <div className="flex-1 min-w-0">
                  <AlertTitle>No tools found</AlertTitle>
                  <AlertDescription>
                    {search
                      ? "No tools match your search."
                      : "No tools available on this server."}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTools.map((tool) => (
                <Alert
                  key={tool.name}
                  onClick={() => setSelectedTool(tool)}
                  className="cursor-pointer hover:bg-input transition-colors"
                >
                  <Wrench className="size-3.5" />
                  <div className="flex w-full gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <AlertTitle className="text-sm font-medium mb-2">
                        <code className="bg-background px-2 py-1 rounded text-xs font-mono">
                          {tool.name}
                        </code>
                      </AlertTitle>
                      <AlertDescription className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
