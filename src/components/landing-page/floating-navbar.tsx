"use client";

import { cn } from "lib/utils";
import { Button } from "ui/button";

export default function FloatingNavbar() {
  const navItems = [
    { label: "Enterprise", href: "#enterprise" },
    { label: "Agents", href: "#agents" },
    { label: "Pricing", href: "#pricing" },
  ];

  return (
    <>
      {/* Main Navigation - Centered */}
      <nav className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 fade-in animate-in duration-700">
        <div className="bg-transparent backdrop-blur-md border border-white/10 rounded-2xl px-2 py-2">
          <div className="flex items-center gap-1">
            {navItems.map((item, _index) => (
              <Button
                key={item.label}
                variant="default"
                size="sm"
                className={cn(
                  "relative px-6 py-2 text-sm font-medium transition-all duration-300 rounded-xl",
                  "bg-white text-black hover:bg-white/90 hover:shadow-sm border-2 border-black",
                  "active:scale-[0.98]",
                )}
                onClick={() => {
                  // Placeholder for navigation logic
                  console.log(`Navigate to ${item.label}`);
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Sign In Button - Top Right */}
      <div className="fixed top-6 right-6 z-50 fade-in animate-in duration-700 delay-200">
        <Button
          variant="default"
          size="sm"
          className={cn(
            "px-6 py-2 text-sm font-medium transition-all duration-300 rounded-xl",
            "bg-white text-black hover:bg-white/90 hover:shadow-sm border-2 border-black",
            "active:scale-[0.98]",
          )}
          onClick={() => {
            // Placeholder for sign in logic
            console.log("Navigate to sign in");
          }}
        >
          Sign In
        </Button>
      </div>
    </>
  );
}
