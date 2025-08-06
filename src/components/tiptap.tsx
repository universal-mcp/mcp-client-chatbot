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
  Ellipsis,
} from "lucide-react";
import TurndownService from "turndown";
import { marked } from "marked";
import Heading from "@tiptap/extension-heading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  isGenerating?: boolean;
  returnPlainText?: boolean;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

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
  const [visibleButtons, setVisibleButtons] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [_, setForceRender] = useState({});

  useEffect(() => {
    if (isGenerating && !isRichTextMode) {
      setIsRichTextMode(true);
    }
  }, [isGenerating, isRichTextMode]);

  const [markdownContent, setMarkdownContent] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richTextRef = useRef<HTMLDivElement>(null);

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

  const htmlToMarkdown = useCallback((html: string): string => {
    try {
      return turndownService.turndown(html);
    } catch (error) {
      console.error("Error converting HTML to markdown:", error);
      return html;
    }
  }, []);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        heading: false,
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
      Heading.configure({
        levels: [1, 2, 3, 4],
      }).extend({
        levels: [1, 2, 3, 4],
        renderHTML({ node, HTMLAttributes }) {
          const level = this.options.levels.includes(node.attrs.level)
            ? node.attrs.level
            : this.options.levels[0];
          const classes = {
            1: "text-3xl font-bold",
            2: "text-2xl font-bold",
            3: "text-xl font-bold",
            4: "text-lg font-bold",
          };
          return [
            `h${level}`,
            { ...HTMLAttributes, class: `${classes[level]}` },
            0,
          ];
        },
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (isRichTextMode) {
        onChange?.(returnPlainText ? editor.getText() : editor.getHTML());
      }
      setForceRender({});
    },
  });

  useEffect(() => {
    setMarkdownContent(value);
  }, [value]);

  useEffect(() => {
    const syncContent = async () => {
      if (editor && markdownContent !== undefined) {
        if (isRichTextMode) {
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

  useEffect(() => {
    if (!isGenerating) return;

    const timeoutId = setTimeout(() => {
      const scrollContainer = isRichTextMode
        ? richTextRef.current
        : textareaRef.current;
      if (scrollContainer) {
        requestAnimationFrame(() => {
          if (isRichTextMode) {
            const editorContent = scrollContainer.querySelector(".ProseMirror");
            const scrollableContainer = editorContent?.parentElement;
            if (scrollableContainer) {
              scrollableContainer.scrollTo({
                top: scrollableContainer.scrollHeight,
                behavior: "smooth",
              });
            }
          } else {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: "smooth",
            });
          }
        });
      }
    }, 50);

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

  const handleModeToggle = useCallback(async () => {
    if (isRichTextMode) {
      // Switch to Markdown
      const htmlContent = editor?.getHTML() || "";
      const convertedMarkdown = htmlToMarkdown(htmlContent);
      setMarkdownContent(convertedMarkdown);
      onChange?.(convertedMarkdown);
    }
    // Switch to Rich Text will be handled by useEffect
    setIsRichTextMode((prev) => !prev);
  }, [isRichTextMode, editor, htmlToMarkdown, onChange]);

  const allToolbarButtons = useMemo(
    () => {
      if (!editor) return [];
      return [
        <Button
          key="bold"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={
            !editor.can().chain().focus().toggleBold().run() || isGenerating
          }
        >
          <Bold className="h-4 w-4" />
        </Button>,
        <Button
          key="italic"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={
            !editor.can().chain().focus().toggleItalic().run() || isGenerating
          }
        >
          <Italic className="h-4 w-4" />
        </Button>,
        <div key="divider1" className="w-px h-4 bg-border mx-1" />,
        <Button
          key="h1"
          variant={
            editor.isActive("heading", { level: 1 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          disabled={isGenerating}
        >
          <Heading1 className="h-4 w-4" />
        </Button>,
        <Button
          key="h2"
          variant={
            editor.isActive("heading", { level: 2 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={isGenerating}
        >
          <Heading2 className="h-4 w-4" />
        </Button>,
        <Button
          key="h3"
          variant={
            editor.isActive("heading", { level: 3 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          disabled={isGenerating}
        >
          <Heading3 className="h-4 w-4" />
        </Button>,
        <Button
          key="h4"
          variant={
            editor.isActive("heading", { level: 4 }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
          disabled={isGenerating}
        >
          <Heading4 className="h-4 w-4" />
        </Button>,
        <div key="divider2" className="w-px h-4 bg-border mx-1" />,
        <Button
          key="bulletList"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={isGenerating}
        >
          <List className="h-4 w-4" />
        </Button>,
        <Button
          key="orderedList"
          variant={editor.isActive("orderedList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={isGenerating}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>,
        <div key="divider3" className="w-px h-4 bg-border mx-1" />,
        <Button
          key="codeBlock"
          variant={editor.isActive("codeBlock") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={isGenerating}
        >
          <CodeIcon className="h-4 w-4" />
        </Button>,
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, isGenerating, editor?.state.selection],
  );

  useEffect(() => {
    const handleResize = () => {
      setVisibleButtons(0); // Reset to trigger recalculation
    };

    if (visibleButtons === 0) {
      const timer = setTimeout(() => {
        if (toolbarRef.current) {
          const toolbarWidth = toolbarRef.current.offsetWidth;
          const buttons = Array.from(
            toolbarRef.current.querySelectorAll("button, div.w-px"),
          );
          let totalWidth = 0;
          let count = 0;
          for (const button of buttons) {
            totalWidth += (button as HTMLElement).offsetWidth + 4; // 4px gap
            if (totalWidth > toolbarWidth - 40) {
              // 40px for ellipsis
              break;
            }
            count++;
          }
          setVisibleButtons(count);
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [visibleButtons, allToolbarButtons]);

  useEffect(() => {
    setVisibleButtons(0);
  }, []);

  if (!editor) {
    return null;
  }

  const renderAll = visibleButtons === 0;
  const visibleToolbarButtons = renderAll
    ? allToolbarButtons
    : allToolbarButtons.slice(0, visibleButtons);
  const hiddenToolbarButtons = renderAll
    ? []
    : allToolbarButtons.slice(visibleButtons);

  return (
    <div
      className={`border border-input bg-background rounded-md flex flex-col ${
        className || ""
      }`}
    >
      <div className="flex items-center justify-between p-2 border-b border-input flex-shrink-0">
        <div
          ref={toolbarRef}
          className="flex items-center gap-1 flex-grow overflow-hidden"
        >
          {isRichTextMode && (
            <>
              {visibleToolbarButtons}
              {hiddenToolbarButtons.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <div className="flex flex-wrap p-2 gap-1">
                      {hiddenToolbarButtons}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        <Button
          variant={"ghost"}
          size="sm"
          onClick={handleModeToggle}
          disabled={isGenerating}
          className="flex items-center gap-1 flex-shrink-0 ml-2"
        >
          {isRichTextMode ? "Switch to Markdown" : "Switch to Rich Text"}
        </Button>
      </div>

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
