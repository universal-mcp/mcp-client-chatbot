"use client";

import { motion } from "framer-motion";

export const ThinkChat = () => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4 px-2">
        <div className="flex items-center py-2">
          <div className="relative">
            <motion.div
              className="text-sm font-medium text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1 }}
            >
              Thinking
            </motion.div>
          </div>

          {/* Minimal dots animation */}
          <div className="flex items-center gap-0.5 ml-2">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                animate={{
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Think = () => {
  return (
    <motion.div
      className="h-2 w-2 rounded-full bg-primary"
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.6, 1, 0.6],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0,
      }}
    />
  );
};
