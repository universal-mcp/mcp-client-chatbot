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
}

const Tiptap = ({
  value = "",
  onChange,
  placeholder,
  className,
  returnPlainText = true,
}: TiptapProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "",
      }),
      Code,
    ],
    content: value || "",
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Return plain text instead of HTML
      const text = returnPlainText ? editor.getText() : editor.getHTML();
      onChange?.(text);
    },
  });

  useEffect(() => {
    if (
      editor &&
      value !== (returnPlainText ? editor.getText() : editor.getHTML())
    ) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor, returnPlainText]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`border border-input bg-background rounded-md ${className || ""}`}
    >
      <div className="flex items-center gap-1 p-2 border-b border-input">
        <Button
          variant={editor.isActive("bold") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("italic") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={
            editor.isActive("heading", { level: 1 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 2 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 3 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          variant={
            editor.isActive("heading", { level: 4 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
        >
          <Heading4 className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("orderedList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={editor.isActive("codeBlock") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeIcon className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="resize-none min-h-[200px] max-h-[400px] w-full px-3 py-2 text-sm focus-visible:outline-none"
      />
    </div>
  );
};

export default Tiptap;
