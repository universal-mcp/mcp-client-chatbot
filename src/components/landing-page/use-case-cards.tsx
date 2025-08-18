"use client";

import type * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "lib/utils";
import {
  Code2,
  FileText,
  Database,
  BarChart3,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface UseCase {
  title: string;
  prompt: string;
}

interface CategoryCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  useCases: UseCase[];
}

interface UseCaseCardsProps {
  onCardClick: (prompt: string) => void;
  className?: string;
}

export default function UseCaseCards({
  onCardClick,
  className,
}: UseCaseCardsProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [, setDropdownPosition] = useState({ left: 0, width: 0 });
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const categories: CategoryCard[] = [
    {
      id: "development",
      title: "Development",
      icon: <Code2 size={16} />,
      useCases: [
        {
          title: "Code Review",
          prompt:
            "Review this code for best practices, potential bugs, and suggest improvements:",
        },
        {
          title: "Debug Code",
          prompt:
            "Help me debug this code and identify the root cause of the issue:",
        },
        {
          title: "Optimize Performance",
          prompt:
            "Analyze this code for performance bottlenecks and suggest optimizations:",
        },
        {
          title: "Add Features",
          prompt:
            "Help me implement this new feature with clean, maintainable code:",
        },
      ],
    },
    {
      id: "documentation",
      title: "Documentation",
      icon: <FileText size={16} />,
      useCases: [
        {
          title: "API Documentation",
          prompt:
            "Generate comprehensive API documentation with examples for this endpoint:",
        },
        {
          title: "README File",
          prompt:
            "Create a detailed README file for this project with setup and usage instructions:",
        },
        {
          title: "Code Comments",
          prompt:
            "Add clear, helpful comments to explain this code functionality:",
        },
        {
          title: "User Guide",
          prompt:
            "Write a user-friendly guide explaining how to use this application:",
        },
      ],
    },
    {
      id: "analysis",
      title: "Analysis",
      icon: <BarChart3 size={16} />,
      useCases: [
        {
          title: "Data Insights",
          prompt:
            "Analyze this dataset and provide key insights, trends, and actionable recommendations:",
        },
        {
          title: "Performance Metrics",
          prompt:
            "Help me interpret these performance metrics and suggest improvements:",
        },
        {
          title: "User Behavior",
          prompt:
            "Analyze this user behavior data and identify patterns and opportunities:",
        },
      ],
    },
    {
      id: "database",
      title: "Database",
      icon: <Database size={16} />,
      useCases: [
        {
          title: "Schema Design",
          prompt:
            "Design an efficient database schema for this application with proper relationships:",
        },
        {
          title: "Query Optimization",
          prompt:
            "Optimize this database query for better performance and efficiency:",
        },
        {
          title: "Data Migration",
          prompt: "Help me plan and execute a safe data migration strategy:",
        },
      ],
    },
    {
      id: "content",
      title: "Content",
      icon: <Sparkles size={16} />,
      useCases: [
        {
          title: "Marketing Copy",
          prompt:
            "Create compelling marketing copy for this product or feature:",
        },
        {
          title: "Technical Writing",
          prompt:
            "Write clear, technical content that explains complex concepts simply:",
        },
        {
          title: "User Interface Text",
          prompt:
            "Generate user-friendly text for buttons, labels, and error messages:",
        },
        {
          title: "Blog Content",
          prompt: "Write an informative blog post about this technical topic:",
        },
      ],
    },
  ];

  // Calculate dropdown position when a category is clicked
  const handleCategoryClick = (categoryId: string) => {
    if (activeDropdown === categoryId) {
      setActiveDropdown(null);
      return;
    }

    const categoryElement = categoryRefs.current[categoryId];
    if (categoryElement) {
      const rect = categoryElement.getBoundingClientRect();
      const gridContainer = categoryElement.parentElement; // The grid container
      const gridRect = gridContainer?.getBoundingClientRect();

      if (gridRect) {
        // Calculate position relative to the grid container (which has the padding)
        // The arrow should point to the center of the clicked category
        const centerOfCategory = rect.left - gridRect.left + rect.width / 2;

        setDropdownPosition({
          left: centerOfCategory,
          width: rect.width,
        });
      }
    }

    setActiveDropdown(categoryId);
  };

  const handleUseCaseClick = (prompt: string) => {
    onCardClick(prompt);
    setActiveDropdown(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".use-case-container")) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeDropdown]);

  return (
    <div className={cn("max-w-3xl mx-auto mt-4 use-case-container", className)}>
      <div className="relative px-2">
        {/* Category Cards Row */}
        <div className="grid grid-cols-5 gap-2 relative z-10">
          {categories.map((category, _index) => (
            <div
              key={category.id}
              ref={(el) => {
                categoryRefs.current[category.id] = el;
              }}
              onClick={() => handleCategoryClick(category.id)}
              className={cn(
                "group cursor-pointer rounded-2xl p-3 transition-all duration-200",
                "backdrop-blur-sm bg-muted/40 border border-border/50",
                "hover:bg-muted/60 hover:border-muted-foreground/30 hover:shadow-lg hover:shadow-black/5",
                "active:scale-[0.98]",
                activeDropdown === category.id &&
                  "bg-muted/80 border-primary/30 shadow-lg shadow-primary/10 ring-1 ring-primary/20",
              )}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-all duration-200",
                    "bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10",
                    "group-hover:from-primary/30 group-hover:via-primary/25 group-hover:to-primary/15",
                    "group-hover:scale-105",
                    activeDropdown === category.id &&
                      "from-primary/40 via-primary/30 to-primary/20 scale-105",
                  )}
                >
                  <div className="text-primary">{category.icon}</div>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors duration-200",
                    "text-muted-foreground group-hover:text-foreground",
                    activeDropdown === category.id &&
                      "text-foreground font-semibold",
                  )}
                >
                  {category.title}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Dropdown with Arrow */}
        <AnimatePresence>
          {activeDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full mt-3 left-0 right-0 z-20"
            >
              {/* Dropdown Content */}
              <div className="backdrop-blur-sm bg-muted/80 border border-border/50 shadow-xl shadow-black/10 rounded-2xl overflow-hidden mx-2">
                {(() => {
                  const currentCategory = categories.find(
                    (c) => c.id === activeDropdown,
                  );
                  const useCases = currentCategory?.useCases || [];
                  const hasScroll = useCases.length > 3;

                  return (
                    <>
                      <div
                        className={cn(
                          "overflow-y-auto",
                          hasScroll
                            ? "max-h-[210px] scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent hover:scrollbar-thumb-border/50"
                            : "max-h-fit",
                        )}
                      >
                        {useCases.map((useCase, useCaseIndex) => (
                          <div key={useCaseIndex}>
                            <button
                              type="button"
                              onClick={() => handleUseCaseClick(useCase.prompt)}
                              className={cn(
                                "w-full text-left px-4 py-3.5 transition-all duration-200",
                                "hover:bg-primary/10 hover:backdrop-blur-md group relative",
                                "focus:bg-primary/10 focus:outline-none focus:ring-1 focus:ring-primary/20",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 pr-3">
                                  <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {useCase.title}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                                    {useCase.prompt}
                                  </p>
                                </div>

                                {/* Arrow indicator */}
                                <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-1">
                                  <ArrowRight className="w-4 h-4 text-primary" />
                                </div>
                              </div>
                            </button>
                            {useCaseIndex < useCases.length - 1 && (
                              <div className="mx-4 h-px bg-border/30" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Scroll indicator for more items */}
                      {hasScroll && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/80 to-transparent pointer-events-none rounded-b-2xl" />
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
