"use client";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "lib/utils";
import { Check, Copy } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";

export function FileContentPopup({
  content,
  title = "File Content",
  open,
  onOpenChange,
  children,
}: {
  content: string;
  title?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const { copied, copy } = useCopy();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant={"ghost"}
            size={"sm"}
            className="text-muted-foreground text-xs"
          >
            View Content
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[80vw] min-w-[50vw]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] w-full overflow-y-auto p-2 pt-0 flex flex-col">
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-3! p-4! ml-auto")}
            onClick={() => copy(content)}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <pre className="whitespace-pre-wrap text-sm break-words p-2 bg-muted rounded-md">
            {content}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
