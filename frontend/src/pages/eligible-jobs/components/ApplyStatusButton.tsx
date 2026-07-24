import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApplyStatusButtonProps {
  isApplied: boolean;
  isPending: boolean;
  targetIsApply?: boolean;
  onToggle: (e?: React.MouseEvent) => void;
  variant?: "inline" | "button";
  size?: "xs" | "sm" | "default";
}

export function ApplyStatusButton({
  isApplied,
  isPending,
  targetIsApply = true,
  onToggle,
  variant = "inline",
  size = "xs",
}: ApplyStatusButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPending) {
      onToggle(e);
    }
  };

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isPending}
        className={`border text-xs h-8 transition-all ${isPending
          ? targetIsApply
            ? "opacity-80 bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
            : "bg-destructive/15 text-destructive border-destructive/40 font-bold"
          : isApplied
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold hover:bg-emerald-500/30"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-accent font-medium"
          }`}
      >
        {isPending ? (
          <Loader2 className={`w-3.5 h-3.5 animate-spin mr-1.5 ${!targetIsApply ? "text-destructive" : ""}`} />
        ) : isApplied ? (
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500 fill-emerald-500/20" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/60" />
        )}
        {isPending ? (targetIsApply ? "Marking apply" : "Unmarking apply") : isApplied ? "Applied" : "Mark Apply"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md transition-all border cursor-pointer disabled:cursor-not-allowed ${isPending
        ? targetIsApply
          ? "opacity-80 bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
          : "bg-destructive/15 text-destructive border-destructive/40 font-bold"
        : isApplied
          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-2xs hover:bg-emerald-500/30"
          : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60 font-medium"
        }`}
    >
      {isPending ? (
        <Loader2 className={`w-3 h-3 animate-spin ${!targetIsApply ? "text-destructive" : ""}`} />
      ) : isApplied ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />
      ) : (
        <CheckCircle2 className="w-3 h-3 text-muted-foreground/60" />
      )}
      {isPending ? (targetIsApply ? "Marking apply" : "Unmarking apply") : isApplied ? "Applied" : "Mark Apply"}
    </button>
  );
}
