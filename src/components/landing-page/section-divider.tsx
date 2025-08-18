"use client";

import { cn } from "lib/utils";

interface SectionDividerProps {
  variant?: "gradient" | "dots" | "wave";
  className?: string;
}

export default function SectionDivider({
  variant = "gradient",
  className,
}: SectionDividerProps) {
  if (variant === "dots") {
    return (
      <div
        className={cn(
          "relative h-24 flex items-center justify-center",
          className,
        )}
      >
        <div className="flex space-x-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full bg-primary/30 animate-pulse",
                "transition-all duration-1000 ease-out",
              )}
              style={{
                animationDelay: `${i * 200}ms`,
                animationDuration: "2s",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "wave") {
    return (
      <div className={cn("relative h-24 overflow-hidden", className)}>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 C300,100 900,20 1200,60 L1200,120 L0,120 Z"
            className="fill-primary/10 animate-pulse"
            style={{ animationDuration: "4s" }}
          />
          <path
            d="M0,60 C300,20 900,100 1200,60 L1200,120 L0,120 Z"
            className="fill-primary/5 animate-pulse"
            style={{ animationDuration: "6s", animationDelay: "1s" }}
          />
        </svg>
      </div>
    );
  }

  // Default gradient
  return (
    <div className={cn("relative h-32", className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/3 to-transparent animate-pulse"
        style={{ animationDuration: "3s" }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full animate-bounce"
            style={{
              left: `${10 + i * 12}%`,
              top: `${30 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
