"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "lib/utils";
import StandaloneLandingGreeting from "./standalone-landing-greeting";
import StandaloneLandingInput from "./standalone-landing-input";
import FloatingNavbar from "./floating-navbar";
import UseCaseCards from "./use-case-cards";
import FeatureTabs from "./feature-tabs";
import StaggeredFeatures from "./staggered-features";
import PrivacySection from "./privacy-section";
import CTASection from "./cta-section";
import AnimatedBackground from "./animated-background";
import SectionDivider from "./section-divider";
import Footer from "./footer";

export default function LandingPage() {
  const [input, setInput] = useState("");
  const router = useRouter();

  // Handle navigation to authenticated chat page with prompt
  const handleSubmit = () => {
    if (!input.trim()) return;

    const searchParams = new URLSearchParams();
    searchParams.set("prompt", input.trim());

    // Navigate to the authenticated home page with the prompt
    router.push(`/?${searchParams.toString()}`);
  };

  // Handle use case card click - add prompt to input
  const handleCardClick = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className={cn("min-h-screen overflow-y-auto relative scroll-smooth")}>
      {/* Animated Background - Fixed backdrop */}
      <AnimatedBackground />

      <div className="flex flex-col min-w-0 relative pb-10 z-10">
        {/* Floating Navigation */}
        <FloatingNavbar />

        {/* Hero Section - Centered */}
        <div className="min-h-screen flex flex-col justify-center items-center py-20 relative">
          {/* Gradient separator */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-background/20 pointer-events-none" />
          {/* Greeting Section */}
          <div className="">
            <StandaloneLandingGreeting />
          </div>

          {/* Prompt Input Section - Center Point */}
          <div className="w-full">
            <StandaloneLandingInput
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
            />
          </div>

          {/* Use Case Cards - Slightly Below Center */}
          <div className="w-full">
            <UseCaseCards onCardClick={handleCardClick} />
          </div>
        </div>

        {/* Section Divider */}
        <SectionDivider variant="gradient" />

        {/* Feature Tabs */}
        <div className="relative">
          <FeatureTabs />
        </div>

        {/* Section Divider */}
        <SectionDivider variant="gradient" />

        {/* Staggered Features */}
        <div className="relative">
          <StaggeredFeatures />
        </div>

        {/* Section Divider */}
        <SectionDivider variant="gradient" />

        {/* Privacy Section */}
        <div className="relative">
          <PrivacySection />
        </div>

        {/* Section Divider */}
        <SectionDivider variant="gradient" />

        {/* Call to Action Section */}
        <div className="relative">
          <CTASection />
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
