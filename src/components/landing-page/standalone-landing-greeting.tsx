"use client";

import { motion } from "framer-motion";
import { FlipWords } from "ui/flip-words";

export default function StandaloneLandingGreeting() {
  const greetings = [
    "Welcome to Wingmen",
    "How can I help you today?",
    "What are you working on?",
    "Let's get started",
    "Ready to begin?",
    "What's on your mind?",
  ];

  const randomGreeting =
    greetings[Math.floor(Math.random() * greetings.length)];

  return (
    <motion.div
      key="welcome"
      className="max-w-3xl mx-auto my-6 h-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl">
          <FlipWords words={[randomGreeting]} className="text-primary" />
        </h1>
      </div>
    </motion.div>
  );
}
