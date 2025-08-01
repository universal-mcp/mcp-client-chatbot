"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Code from "@tiptap/extension-code";
import { useEffect } from "react";
import { Button } from "ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Code as CodeIcon,
} from "lucide-react";

interface TiptapProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  returnPlainText?: boolean;
  isGenerating?: boolean;
}

const Tiptap = ({
  value = "",
  onChange,
  placeholder,
  className,
  returnPlainText = false, // Changed default to false to preserve HTML formatting
  isGenerating = false,
}: TiptapProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "",
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Code,
    ],
    content: value || "",
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Return HTML by default to preserve all formatting
      const content = returnPlainText ? editor.getText() : editor.getHTML();
      onChange?.(content);
    },
  });

  useEffect(() => {
    if (
      editor &&
      value !== (returnPlainText ? editor.getText() : editor.getHTML())
    ) {
      // Use a more efficient update method for streaming content
      const currentContent = returnPlainText
        ? editor.getText()
        : editor.getHTML();
      if (
        value &&
        value.length > currentContent.length &&
        value.startsWith(currentContent)
      ) {
        // For streaming updates, append only the new content
        const newContent = value.slice(currentContent.length);
        if (newContent) {
          editor.commands.insertContent(newContent);
        }
      } else {
        // For complete replacements, set the full content
        editor.commands.setContent(value || "");
      }
    }
  }, [value, editor, returnPlainText]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`border border-input bg-background rounded-md flex flex-col ${className || ""}`}
    >
      <div className="flex items-center gap-1 p-2 border-b border-input flex-shrink-0">
        <Button
          variant={
            editor.isActive("bold") && !isGenerating ? "default" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={
            !editor.can().chain().focus().toggleBold().run() || isGenerating
          }
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("italic") && !isGenerating ? "default" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={
            !editor.can().chain().focus().toggleItalic().run() || isGenerating
          }
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={
            editor.isActive("heading", { level: 1 }) && !isGenerating
              ? "default"
              : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          disabled={isGenerating}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 2 }) && !isGenerating
              ? "default"
              : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={isGenerating}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 3 }) && !isGenerating
              ? "default"
              : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          disabled={isGenerating}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 4 }) && !isGenerating
              ? "default"
              : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
          disabled={isGenerating}
        >
          <Heading4 className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={
            editor.isActive("bulletList") && !isGenerating ? "default" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={isGenerating}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("orderedList") && !isGenerating
              ? "default"
              : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={isGenerating}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={
            editor.isActive("codeBlock") && !isGenerating ? "default" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={isGenerating}
        >
          <CodeIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <EditorContent
          editor={editor}
          className="h-full min-h-[200px] max-h-[300px] w-full px-3 py-2 text-sm focus-visible:outline-none overflow-y-auto overscroll-contain"
        />
      </div>
    </div>
  );
};

export default Tiptap;
