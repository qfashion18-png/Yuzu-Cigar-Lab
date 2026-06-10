"use client";

import type { HTMLMotionProps, Transition, Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

const softSpring: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 20,
  mass: 0.8,
};

type MotionDivProps = HTMLMotionProps<"div">;

type PageFadeProps = MotionDivProps & {
  duration?: number;
};

export function PageFade({ children, className, duration = 0.36, ...props }: PageFadeProps) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type RevealProps = MotionDivProps & {
  delay?: number;
  y?: number;
};

export function Reveal({ children, className, delay = 0, y = 28, ...props }: RevealProps) {
  const shouldReduceMotion = useReducedMotion();
  void y;

  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={shouldReduceMotion ? { duration: 0 } : { ...softSpring, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type CascadeProps = MotionDivProps & {
  delay?: number;
  stagger?: number;
};

export function Cascade({ children, className, delay = 0, stagger = 0.07, ...props }: CascadeProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        delayChildren: delay,
        staggerChildren: shouldReduceMotion ? 0 : stagger,
      },
    },
  };

  return (
    <motion.div
      initial={false}
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CascadeItem({ children, className, ...props }: MotionDivProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: softSpring },
  };

  return (
    <motion.div variants={variants} className={className} {...props}>
      {children}
    </motion.div>
  );
}

type HoverLiftProps = MotionDivProps & {
  hoverScale?: number;
  hoverY?: number;
};

export function HoverLift({
  children,
  className,
  hoverScale = 1.01,
  hoverY = -6,
  ...props
}: HoverLiftProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: hoverY, scale: hoverScale }}
      transition={softSpring}
      className={cn("motion-safe:will-change-transform", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type AmbientPulseProps = MotionDivProps & {
  active?: boolean;
};

export function AmbientPulse({ active = true, className, ...props }: AmbientPulseProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      animate={
        active && !shouldReduceMotion
          ? {
              opacity: [0.34, 0.58, 0.34],
              scale: [1, 1.04, 1],
            }
          : undefined
      }
      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      className={cn("pointer-events-none", className)}
      {...props}
    />
  );
}
