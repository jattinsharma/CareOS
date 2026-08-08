"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Subtle custom cursor dot that trails the mouse with a spring delay.
 * Desktop only (hidden on touch devices via opacity-0 md:opacity-100).
 * Purely decorative — pointer-events-none, aria-hidden.
 */
export default function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 400, damping: 40, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 400, damping: 40, mass: 0.6 });

  useEffect(() => {
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-rose-500 opacity-0 mix-blend-difference md:opacity-100"
      style={{ x: springX, y: springY }}
    />
  );
}
