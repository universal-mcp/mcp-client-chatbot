"use client";

import { motion } from "framer-motion";
import { authClient } from "auth/client";
import { useMemo } from "react";
import { FlipWords } from "ui/flip-words";
import { useTranslations } from "next-intl";

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export const ChatGreeting = () => {
  const { data: session, isPending } = authClient.useSession();

  const t = useTranslations("Chat.Greeting");

  const user = session?.user;

  const word = useMemo(() => {
    // Don't show greeting until we know the session state
    if (isPending) return "";

    const hasName = Boolean(user?.name);
    const words = hasName
      ? [
          t(getGreetingByTime(), { name: user!.name }),
          t("niceToSeeYouAgain", { name: user!.name }),
          t("whatAreYouWorkingOnToday", { name: user!.name }),
          t("letMeKnowWhenYoureReadyToBegin"),
          t("whatAreYourThoughtsToday"),
          t("whereWouldYouLikeToStart"),
          t("whatAreYouThinking", { name: user!.name }),
        ]
      : [
          t("letMeKnowWhenYoureReadyToBegin"),
          t("whatAreYourThoughtsToday"),
          t("whereWouldYouLikeToStart"),
        ];
    return words[Math.floor(Math.random() * words.length)];
  }, [isPending, user?.name, t]);

  // Don't render anything while loading to prevent flash
  if (isPending || !word) {
    return (
      <div className="max-w-3xl mx-auto my-4 h-20">
        <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
          <h1 className="text-2xl md:text-3xl opacity-0">
            {/* Placeholder to maintain layout */}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      key="welcome"
      className="max-w-3xl mx-auto my-4 h-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
        <h1 className="text-2xl md:text-3xl">
          <FlipWords words={[word]} className="text-primary" />
        </h1>
      </div>
    </motion.div>
  );
};
