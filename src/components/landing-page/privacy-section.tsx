"use client";

import { useEffect, useState } from "react";
import { cn } from "lib/utils";
import { Check } from "lucide-react";
import { useScrollAnimation } from "../../hooks/use-scroll-animation";

export default function PrivacySection() {
  const [animationStarted, setAnimationStarted] = useState(false);
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.3 });

  const features = [
    "Data never used for training",
    "End-to-end encryption",
    "Zero retention after processing",
    "Secure cloud infrastructure",
  ];

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setAnimationStarted(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <div className="w-3/4 mx-auto px-4">
      <div
        ref={elementRef as any}
        className={cn(
          "transition-all duration-1000 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div className="bg-black/30 backdrop-blur-md border border-gray-700/30 rounded-2xl p-12 text-center">
          {/* Animated Title */}
          <div className="mb-12">
            <h2
              className={cn(
                "text-2xl lg:text-3xl font-bold text-white transition-all duration-1000",
                animationStarted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4",
              )}
            >
              We care about{" "}
              <span
                className={cn(
                  "text-primary transition-all duration-1000 delay-300",
                  animationStarted
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4",
                )}
              >
                privacy
              </span>
            </h2>
          </div>

          {/* Features in horizontal line */}
          <div className="flex flex-wrap justify-center gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 text-sm lg:text-base text-gray-300 transition-all duration-500",
                  animationStarted
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4",
                )}
                style={{
                  transitionDelay: `${600 + index * 150}ms`,
                }}
              >
                <div className="flex-shrink-0 w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center">
                  <Check size={12} className="text-primary" />
                </div>
                <span className="whitespace-nowrap">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
