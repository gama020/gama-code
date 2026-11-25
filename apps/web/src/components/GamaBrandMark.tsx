import { memo } from "react";
import { cn } from "../lib/utils";

export const GamaBrandMark = memo(function GamaBrandMark({
  onBackdrop,
  className,
}: {
  onBackdrop?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight select-none",
        className,
      )}
    >
      <img
        src="/favicon-32x32.png"
        // oxlint-disable-next-line t3code/no-untranslated-copy -- brand name, not translatable
        alt="Gama Os"
        className="size-5 shrink-0 rounded-md ring-1 ring-white/15 object-cover"
      />
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-bold text-sm tracking-tight",
            onBackdrop ? "text-white" : "text-foreground",
          )}
        >
          {/* oxlint-disable-next-line t3code/no-untranslated-copy -- brand name, not translatable */}
          Gama
        </span>
        <span
          className={cn(
            "text-xs font-medium tracking-normal",
            onBackdrop ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {/* oxlint-disable-next-line t3code/no-untranslated-copy -- brand name, not translatable */}
          Os
        </span>
      </span>
    </span>
  );
});
