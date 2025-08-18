"use client";

import { useState } from "react";
import { cn } from "lib/utils";
import { Button } from "ui/button";
import { ArrowRight, Zap, Clock, DollarSign } from "lucide-react";
import { useScrollAnimation } from "../../hooks/use-scroll-animation";

export default function CTASection() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setEmail("");
    // Handle signup logic here
  };

  return (
    <div className="w-3/4 mx-auto px-4">
      <div
        ref={elementRef as any}
        className={cn(
          "transition-all duration-1000 ease-out",
          isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-12 scale-95",
        )}
      >
        <div className="bg-black/80 backdrop-blur-md border border-gray-700/50 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
            {/* Left Side - Signup Form */}
            <div className="p-16 flex flex-col justify-center">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Ready to Get Started?
                </h2>
                <p className="text-gray-300 leading-relaxed">
                  Join thousands of developers already using our platform to
                  accelerate their workflow.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:bg-white/15 transition-all duration-200"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className={cn(
                    "w-full py-3 px-6 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl",
                    "transition-all duration-200 flex items-center justify-center gap-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Start Free Trial
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-gray-500 mt-4">
                No credit card required • 14-day free trial • Cancel anytime
              </p>
            </div>

            {/* Center Separator */}
            <div className="hidden lg:block absolute left-1/2 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-gray-600 to-transparent transform -translate-x-1/2" />

            {/* Right Side - Value Proposition */}
            <div className="p-16 flex flex-col justify-center bg-white/5">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-6">
                  Why Choose Our Platform?
                </h3>
              </div>

              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Zap size={20} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">
                      Lightning Fast Execution
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Get responses 3x faster than traditional solutions with
                      our optimized infrastructure.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <DollarSign size={20} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">
                      Save Up to 60% on Tokens
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Our smart caching and optimization reduces token usage
                      without compromising quality.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Clock size={20} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">
                      Deploy in Minutes
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      From signup to production in under 5 minutes. No complex
                      setup required.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
