"use client";

import { motion } from "framer-motion";
import { authClient } from "auth/client";
import { useMemo } from "react";
import { FlipWords } from "ui/flip-words";
import { useTranslations } from "next-intl";
import { UIMessage } from "ai";
import { cn } from "lib/utils";

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

type ChatGreetingProps = {
  append: (
    message: Omit<UIMessage, "id">,
  ) => Promise<string | null | undefined>;
  isLoadingTools?: boolean;
};

export const ChatGreeting = ({ append, isLoadingTools }: ChatGreetingProps) => {
  const { data: session } = authClient.useSession();

  const t = useTranslations("Chat.Greeting");
  const suggestions = useMemo(
    () => [
      "What are my events for today?",
      "Explain our docs with a simple diagram",
      "Write a thank you email to my team",
    ],
    [],
  );

  const user = session?.user;

  const word = useMemo(() => {
    if (!user?.name) return "";
    const words = [
      t(getGreetingByTime(), { name: user.name }),
      t("niceToSeeYouAgain", { name: user.name }),
      t("whatAreYouWorkingOnToday", { name: user.name }),
      t("letMeKnowWhenYoureReadyToBegin"),
      t("whatAreYourThoughtsToday"),
      t("whereWouldYouLikeToStart"),
      t("whatAreYouThinking", { name: user.name }),
    ];
    return words[Math.floor(Math.random() * words.length)];
  }, [t, user?.name]);

  const handleSuggestionClick = (suggestion: string) => {
    append({
      role: "user",
      content: suggestion,
      parts: [
        {
          type: "text",
          text: suggestion,
        },
      ],
    });
  };

  return (
    <motion.div
      key="welcome"
      className="max-w-3xl mx-auto my-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
        <h1 className="text-2xl md:text-3xl h-20">
          {word ? <FlipWords words={[word]} className="text-primary" /> : ""}
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
          {suggestions.map((suggestion, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "tween",
                ease: "easeOut",
                duration: 0.5,
                delay: 0.7 + i * 0.15,
              }}
              className="flex-1"
            >
              <button
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoadingTools}
                className={cn(
                  "p-3 border rounded-lg bg-muted/50 hover:bg-muted text-xs transition-colors w-full h-full text-left",
                  isLoadingTools &&
                    "animate-pulse cursor-not-allowed opacity-50",
                )}
              >
                {suggestion}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
