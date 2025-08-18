"use client";

import LightRays from "../ui/light-rays";
import Particles from "../ui/particles";

export default function AnimatedBackground() {
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
      <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
        <LightRays />
      </div>
      <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
        <Particles
          particleCount={400}
          particleBaseSize={10}
          particleColors={["#ffffff", "#f5f5f5", "#e5e5e5"]}
        />
      </div>

      <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
        <div className="w-full h-full bg-gradient-to-t from-background to-50% to-transparent z-20" />
      </div>
      <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
        <div className="w-full h-full bg-gradient-to-l from-background to-20% to-transparent z-20" />
      </div>
      <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
        <div className="w-full h-full bg-gradient-to-r from-background to-20% to-transparent z-20" />
      </div>
    </div>
  );
}
