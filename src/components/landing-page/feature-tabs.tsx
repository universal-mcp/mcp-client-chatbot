"use client";

import { useState } from "react";
import { cn } from "lib/utils";
import { useScrollAnimation } from "../../hooks/use-scroll-animation";

interface Tab {
  id: string;
  label: string;
  gifSrc: string;
}

export default function FeatureTabs() {
  const [activeTab, setActiveTab] = useState<string>("code-assistance");
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.2 });

  const tabs: Tab[] = [
    {
      id: "code-assistance",
      label: "Code Assistance",
      gifSrc: "/PromptToWorkflow.gif",
    },
    {
      id: "meeting-research",
      label: "Meeting Research",
      gifSrc: "/FastMeetingResearch.gif",
    },
    {
      id: "search-apps",
      label: "Search Across Apps",
      gifSrc: "/SearchAcrossApps.gif",
    },
    {
      id: "email-integration",
      label: "Email Integration",
      gifSrc: "/Gmail.gif",
    },
  ];

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div
      ref={elementRef as any}
      className={cn(
        "w-3/4 mx-auto transition-all duration-1000 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
      )}
    >
      <div className="px-4">
        {/* Tabs Header */}
        <div className="relative">
          <div className="flex bg-black/80 rounded-2xl p-1 border border-gray-700/50 backdrop-blur-sm">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex-1 px-4 py-3 text-sm font-medium transition-all duration-300 rounded-xl",
                  "hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/20",
                  activeTab === tab.id
                    ? "text-black bg-primary shadow-sm hover:text-black"
                    : "text-gray-400 hover:text-white/80",
                )}
                style={{
                  animationDelay: `${index * 100}ms`,
                  animationFillMode: "both",
                }}
              >
                <span className="relative z-10">{tab.label}</span>

                {/* Active tab indicator */}
                {activeTab === tab.id && (
                  <div className="absolute inset-0 bg-primary rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Description */}
        <div className="text-center mt-6 mb-8"></div>

        {/* GIF Display Area */}
        <div className="relative bg-black/60 rounded-3xl border border-gray-700/50 overflow-hidden aspect-video shadow-lg shadow-black/5">
          <div className="absolute inset-0 flex items-center justify-center">
            {activeTabData ? (
              <div className="text-center animate-in fade-in duration-300 w-full h-full">
                <img
                  src={activeTabData.gifSrc}
                  alt={`${activeTabData.label} demonstration`}
                  className="w-full h-full object-cover animate-in fade-in duration-300"
                />
              </div>
            ) : null}
          </div>

          {/* Subtle gradient overlay for better text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
