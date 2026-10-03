"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// HTML input types that have a native picker (date, time, color, etc.)
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week", "color"]);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onClick, ...props }, ref) => {
    const hasPicker = type && PICKER_TYPES.has(type);

    const tryShowPicker = (el: HTMLInputElement | null) => {
      if (!el) return;
      // showPicker() requires a user gesture and may throw on unsupported browsers — swallow silently.
      try {
        (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        /* ignore */
      }
    };

    return (
      <input
        type={type}
        ref={ref}
        onClick={(e) => {
          // Only open picker on real user click — NOT on focus
          // (so opening a dialog with a date input doesn't auto-pop the picker)
          if (hasPicker) tryShowPicker(e.currentTarget);
          onClick?.(e);
        }}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Make date/time inputs feel clickable everywhere (not just icon area)
          hasPicker && "cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
