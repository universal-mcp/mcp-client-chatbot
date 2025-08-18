"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollAnimation(options = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  const defaultOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px",
    triggerOnce: true,
    ...options,
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (defaultOptions.triggerOnce && !hasAnimated) {
            setHasAnimated(true);
          }
        } else if (!defaultOptions.triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        threshold: defaultOptions.threshold,
        rootMargin: defaultOptions.rootMargin,
      },
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [
    defaultOptions.threshold,
    defaultOptions.rootMargin,
    defaultOptions.triggerOnce,
    hasAnimated,
  ]);

  return {
    elementRef,
    isVisible: defaultOptions.triggerOnce
      ? hasAnimated || isVisible
      : isVisible,
  };
}
