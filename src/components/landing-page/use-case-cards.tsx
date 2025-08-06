"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "lib/utils";
import { Code2, FileText, Database, BarChart3, Sparkles } from "lucide-react";

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
}

export default function UseCaseCards({ onCardClick }: UseCaseCardsProps) {
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

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

  const handleCategoryClick = (categoryId: string) => {
    setActivePopup(activePopup === categoryId ? null : categoryId);
  };

  const handleUseCaseClick = (prompt: string) => {
    onCardClick(prompt);
    setActivePopup(null);
  };

  // Handle click outside to close popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        componentRef.current &&
        !componentRef.current.contains(event.target as Node)
      ) {
        setActivePopup(null);
      }
    };

    if (activePopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activePopup]);

  return (
    <div ref={componentRef} className="max-w-4xl mx-auto mt-8">
      <div className="relative px-4">
        {/* Category Cards Row */}
        <div className="grid grid-cols-5 gap-3">
          {categories.map((category, _index) => (
            <div key={category.id} className="relative">
              <div
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  "group cursor-pointer rounded-xl p-4 transition-all duration-200",
                  "bg-muted/50 border border-border/50 backdrop-blur-sm",
                  "hover:bg-muted hover:border-border hover:scale-[1.02]",
                  "active:scale-[0.98]",
                  activePopup === category.id && "bg-muted border-border",
                )}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="p-3 rounded-lg bg-gray-800/50 group-hover:bg-gray-700/80 transition-colors">
                    <div className="text-white">
                      <div className="scale-125">{category.icon}</div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                    {category.title}
                  </span>
                </div>
              </div>

              {/* Popup - Opens Upward */}
              {activePopup === category.id && (
                <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 z-50 w-[420px]">
                  <div className="bg-black/20 backdrop-blur-sm border-1 border-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
                    {/* Use Cases */}
                    <div className="max-h-80 overflow-y-auto">
                      {category.useCases.map((useCase, useCaseIndex) => (
                        <div key={useCaseIndex}>
                          <div
                            onClick={() => handleUseCaseClick(useCase.prompt)}
                            className="group cursor-pointer px-6 py-4 transition-all duration-200 hover:bg-white/5 active:bg-white/10 relative"
                          >
                            {/* Hover indicator */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-center" />

                            <div className="pl-1">
                              <p className="text-gray-300 group-hover:text-white text-sm leading-relaxed">
                                {useCase.prompt}
                              </p>
                            </div>
                          </div>

                          {/* Separator - only show between items, not after last */}
                          {useCaseIndex < category.useCases.length - 1 && (
                            <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enhanced Arrow pointing down */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                    <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-[7px]">
                      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-black/20" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
