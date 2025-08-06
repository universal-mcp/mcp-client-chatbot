"use client";

import { cn } from "lib/utils";
import { Code2, MessageSquare, Zap } from "lucide-react";
import { useScrollAnimation } from "../../hooks/use-scroll-animation";

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  imageSrc: string; // Placeholder for feature images
}

export default function StaggeredFeatures() {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });

  const features: Feature[] = [
    {
      id: "intelligent-assistance",
      title: "Intelligent Code Assistance",
      description:
        "Get context-aware code suggestions, bug fixes, and optimization recommendations. Our AI understands your codebase and provides intelligent assistance that adapts to your coding style and project requirements.",
      icon: <Code2 size={24} />,
      imageSrc: "/assistant.png",
    },
    {
      id: "natural-conversations",
      title: "Natural Development Conversations",
      description:
        "Communicate with your development environment using natural language. Ask questions, request explanations, and get detailed responses about your code, architecture decisions, and best practices.",
      icon: <MessageSquare size={24} />,
      imageSrc: "/assistant.png",
    },
    {
      id: "instant-productivity",
      title: "Instant Productivity Boost",
      description:
        "Accelerate your development workflow with lightning-fast responses and automated tasks. From generating documentation to refactoring code, experience unprecedented development velocity.",
      icon: <Zap size={24} />,
      imageSrc: "/assistant.png",
    },
  ];

  return (
    <div
      ref={elementRef as any}
      className={cn(
        "w-3/4 mx-auto px-4 transition-all duration-1000 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12",
      )}
    >
      <div className="space-y-24">
        {features.map((feature, index) => {
          const isReversed = index % 2 === 1;

          return (
            <div
              key={feature.id}
              className={cn(
                "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center transition-all duration-700 ease-out",
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8",
              )}
              style={{
                transitionDelay: isVisible ? `${index * 200}ms` : "0ms",
              }}
            >
              {/* Text Content */}
              <div
                className={cn(
                  "space-y-6",
                  isReversed ? "lg:order-2" : "lg:order-1",
                )}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="text-primary">{feature.icon}</div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-3">
                  <div className="inline-flex items-center text-sm text-primary font-medium hover:text-primary/80 transition-colors cursor-pointer group">
                    <span>Learn more</span>
                    <svg
                      className="ml-2 w-3 h-3 transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Feature Image */}
              <div
                className={cn(
                  "relative group",
                  isReversed ? "lg:order-1" : "lg:order-2",
                )}
              >
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-black/60 border border-gray-700/50 shadow-2xl shadow-black/10">
                  {/* Actual image will go here */}
                  <img
                    src={feature.imageSrc}
                    alt={`${feature.title} feature demonstration`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />

                  {/* Subtle overlay for better contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/5 to-transparent pointer-events-none" />

                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl opacity-50" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gray-800/20 rounded-full blur-3xl opacity-30" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
