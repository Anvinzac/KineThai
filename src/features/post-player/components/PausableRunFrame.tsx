/**
 * The fade/blur-in wrapper around a multi-syllable emphasis run, paused with the page.
 *
 * Exports: PausableRunFrame
 * Depends on: framer-motion, usePausableEntrance
 */

import { motion, type Transition } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { usePausableEntrance } from "../hooks/usePausableEntrance";

const SHOWN = { opacity: 1, filter: "blur(0px)" };
const HIDDEN = { opacity: 0, filter: "blur(6px)" };

/** Render the run wrapper. @param props Frame props. @returns Animated span. */
export function PausableRunFrame({
  className,
  staticRender,
  transition,
  style,
  children,
}: {
  className?: string;
  staticRender: boolean;
  transition: Transition;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const controls = usePausableEntrance(SHOWN, transition, !staticRender);
  return (
    <motion.span
      className={className}
      initial={staticRender ? false : HIDDEN}
      animate={staticRender ? SHOWN : controls}
      transition={transition}
      style={style}
    >
      {children}
    </motion.span>
  );
}
