"use client";

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
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
  Type,
  FileText,
} from "lucide-react";
import TurndownService from "turndown";
import { marked } from "marked";

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  isGenerating?: boolean;
  returnPlainText?: boolean;
}

// Configure marked for consistent HTML output
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Configure Turndown for consistent markdown output
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

const MarkdownEditor = ({
  value = "",
  onChange,
  placeholder,
  className,
  isGenerating = false,
  returnPlainText = false,
}: MarkdownEditorProps) => {
  const [isRichTextMode, setIsRichTextMode] = useState(true);

  // Auto-switch to rich text mode when text is streaming
  useEffect(() => {
    if (isGenerating && !isRichTextMode) {
      setIsRichTextMode(true);
    }
  }, [isGenerating, isRichTextMode]);
  const [markdownContent, setMarkdownContent] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richTextRef = useRef<HTMLDivElement>(null);

  // Convert markdown to HTML
  const markdownToHtml = useCallback(
    async (markdown: string): Promise<string> => {
      try {
        return await marked(markdown);
      } catch (error) {
        console.error("Error converting markdown to HTML:", error);
        return markdown;
      }
    },
    [],
  );

  // Convert HTML to markdown
  const htmlToMarkdown = useCallback((html: string): string => {
    try {
      return turndownService.turndown(html);
    } catch (error) {
      console.error("Error converting HTML to markdown:", error);
      return html;
    }
  }, []);

  // Memoize editor extensions to prevent recreation
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false, // Disable default code block to use custom one
      }),
      Placeholder.configure({
        placeholder: placeholder || "",
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Code,
      CodeBlock.configure({
        exitOnTripleEnter: true,
        exitOnArrowDown: true,
      }),
    ],
    [placeholder],
  );

  // Memoize editor configuration
  const editorConfig = useMemo(
    () => ({
      extensions,
      content: "",
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        if (isRichTextMode) {
          onChange?.(returnPlainText ? editor.getText() : editor.getHTML());
        }
      },
    }),
    [extensions, isRichTextMode, onChange, returnPlainText],
  );

  // Initialize Tiptap editor
  const editor = useEditor(editorConfig);

  // Sync markdown content with prop value only when value actually changes
  useEffect(() => {
    setMarkdownContent(value);
  }, [value]);

  // Handle mode switching and content synchronization
  useEffect(() => {
    const syncContent = async () => {
      if (editor && markdownContent !== undefined) {
        if (isRichTextMode) {
          // Switching to rich text mode - convert markdown to HTML
          const htmlContent = await markdownToHtml(markdownContent);
          const currentHtml = editor.getHTML();
          if (htmlContent !== currentHtml) {
            editor.commands.setContent(htmlContent);
          }
        }
      }
    };

    syncContent();
  }, [editor, isRichTextMode, markdownContent, markdownToHtml]);

  // Auto-scroll functionality for streaming text - debounced for performance
  useEffect(() => {
    if (!isGenerating) return;

    const timeoutId = setTimeout(() => {
      const scrollContainer = isRichTextMode
        ? richTextRef.current
        : textareaRef.current;
      if (scrollContainer) {
        requestAnimationFrame(() => {
          if (isRichTextMode) {
            // For rich text mode, find the EditorContent scrollable container
            const editorContent = scrollContainer.querySelector(".ProseMirror");
            const scrollableContainer = editorContent?.parentElement;
            if (scrollableContainer) {
              scrollableContainer.scrollTo({
                top: scrollableContainer.scrollHeight,
                behavior: "smooth",
              });
            }
          } else {
            // For markdown mode, scroll the textarea
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: "smooth",
            });
          }
        });
      }
    }, 50); // Debounce scroll updates during streaming

    return () => clearTimeout(timeoutId);
  }, [markdownContent, isGenerating, isRichTextMode]);

  const handleMarkdownChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setMarkdownContent(newValue);
      onChange?.(newValue);
    },
    [onChange],
  );

  const handleSwitchToRichText = useCallback(async () => {
    if (!isRichTextMode) {
      // Switching from markdown to rich text - content will be converted in useEffect
      setIsRichTextMode(true);
    }
  }, [isRichTextMode]);

  const handleSwitchToMarkdown = useCallback(async () => {
    if (isRichTextMode) {
      // Switching from rich text to markdown - convert HTML to markdown
      const htmlContent = editor?.getHTML() || "";
      const convertedMarkdown = htmlToMarkdown(htmlContent);
      setMarkdownContent(convertedMarkdown);
      onChange?.(convertedMarkdown);
      setIsRichTextMode(false);
    }
  }, [isRichTextMode, editor, htmlToMarkdown, onChange]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`border border-input bg-background rounded-md flex flex-col ${className || ""}`}
    >
      {/* Header with toolbar and mode toggle */}
      <div className="flex items-center justify-between p-2 border-b border-input flex-shrink-0">
        {/* Rich text toolbar - only show in rich text mode */}
        <div className="flex items-center gap-1">
          {isRichTextMode && (
            <>
              <Button
                variant={
                  editor.isActive("bold") && !isGenerating ? "default" : "ghost"
                }
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={
                  !editor.can().chain().focus().toggleBold().run() ||
                  isGenerating
                }
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={
                  editor.isActive("italic") && !isGenerating
                    ? "default"
                    : "ghost"
                }
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={
                  !editor.can().chain().focus().toggleItalic().run() ||
                  isGenerating
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
                  editor.isActive("bulletList") && !isGenerating
                    ? "default"
                    : "ghost"
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
                  editor.isActive("codeBlock") && !isGenerating
                    ? "default"
                    : "ghost"
                }
                size="sm"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                disabled={isGenerating}
              >
                <CodeIcon className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Mode toggle - moved to the right */}
        <div className="flex items-center gap-1">
          <Button
            variant={isRichTextMode ? "default" : "ghost"}
            size="sm"
            onClick={handleSwitchToRichText}
            disabled={isGenerating}
            className="flex items-center gap-1"
          >
            <Type className="h-4 w-4" />
            Rich Text
          </Button>
          <Button
            variant={!isRichTextMode ? "default" : "ghost"}
            size="sm"
            onClick={handleSwitchToMarkdown}
            disabled={isGenerating}
            className="flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            Markdown
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isRichTextMode ? (
          <div ref={richTextRef} className="h-full">
            <EditorContent
              editor={editor}
              className="h-full min-h-[250px] max-h-[250px] w-full px-3 py-2 text-sm focus-visible:outline-none overflow-y-auto overscroll-contain"
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={markdownContent}
            onChange={handleMarkdownChange}
            placeholder={placeholder}
            disabled={isGenerating}
            className="h-full min-h-[244px] w-full px-3 py-4 text-sm focus-visible:outline-none overflow-y-auto overscroll-contain resize-none bg-transparent border-none"
          />
        )}
      </div>
    </div>
  );
};

export default memo(MarkdownEditor);
