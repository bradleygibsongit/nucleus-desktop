/**
 * AgentActivityHeader - Collapsible header for the agent activity panel.
 *
 * Shows:
 * - LoadingDots when working, nothing when done
 * - Dynamic text (current action or "Show steps" / "Hide steps")
 * - Elapsed time
 * - Chevron for expand/collapse
 */

import { useState, useEffect, useRef } from "react";
import { CaretUp, CaretDown } from "@/components/icons";
import { LoadingDots } from "@/features/shared/components/ui/loading-dots";
import { cn } from "@/lib/utils";

interface AgentActivityHeaderProps {
  /** Whether the agent is currently working */
  isWorking: boolean;
  /** Whether the content is expanded */
  isOpen: boolean;
  /** Callback when user toggles the header */
  onToggle: () => void;
  /** Text to display (e.g., "Considering next steps" or "Show steps") */
  text: string;
  /** Timestamp when work started */
  startTime: number;
  /** Timestamp when work ended (for final duration display) */
  endTime?: number;
  className?: string;
}

/**
 * Format elapsed time as "Xm, X.Xs" or "X.Xs" depending on duration
 */
function formatElapsedTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m, ${seconds.toFixed(1)}s`;
  }
  return `${seconds.toFixed(1)}s`;
}

/**
 * Hook to get live elapsed time string
 */
function useElapsedTime(
  startTime: number,
  isActive: boolean,
  endTime?: number
): string {
  // Track current time in state to avoid calling Date.now() during render
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Update every 100ms for smooth counter
    intervalRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  // Compute elapsed time using tracked currentTime (for active) or endTime (for finished)
  const end = isActive ? currentTime : (endTime ?? currentTime);
  return formatElapsedTime(end - startTime);
}

export function AgentActivityHeader({
  isWorking,
  isOpen,
  onToggle,
  text,
  startTime,
  endTime,
  className,
}: AgentActivityHeaderProps) {
  const elapsedTime = useElapsedTime(startTime, isWorking, endTime);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground py-1",
        className
      )}
    >
      {/* Loading indicator when working */}
      {isWorking && <LoadingDots />}

      {/* Text label */}
      <span className="flex-1 text-left">
        {text}
      </span>

      {/* Elapsed time */}
      <span className="text-muted-foreground/70">
        · {elapsedTime}
      </span>

      {/* Chevron */}
      {isOpen ? (
        <CaretUp className="size-4" />
      ) : (
        <CaretDown className="size-4" />
      )}
    </button>
  );
}
