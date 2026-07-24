import React from "react";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExpiredStatusButtonProps {
  isExpired: boolean;
  isPending: boolean;
  targetIsExpired?: boolean;
  onToggle: (e?: React.MouseEvent) => void;
  variant?: "inline" | "button";
  size?: "xs" | "sm" | "default";
}

export function ExpiredStatusButton({
  isExpired,
  isPending,
  targetIsExpired = true,
  onToggle,
  variant = "inline",
  size = "xs",
}: ExpiredStatusButtonProps) {
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
        className={`border text-xs h-8 transition-all ${
          isPending
            ? "opacity-80 bg-blue-500/10 text-blue-600 border-blue-500/30 cursor-not-allowed"
            : isExpired
            ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 font-bold hover:bg-red-500/30"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-accent font-medium"
        }`}
      >
        {isPending ? (
          <Loader2 className={`w-3.5 h-3.5 animate-spin mr-1.5 text-blue-500`} />
        ) : isExpired ? (
          <XCircle className="w-3.5 h-3.5 mr-1.5 text-red-500 fill-red-500/20" />
        ) : (
          <XCircle className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/60" />
        )}
        {isPending ? (targetIsExpired ? "Marking Expired" : "Marking active") : isExpired ? "Expired Job" : "Mark Expired"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md transition-all border cursor-pointer disabled:cursor-not-allowed ${
        isPending
          ? "opacity-80 bg-blue-500/10 text-blue-600 border-blue-500/30"
          : isExpired
          ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 font-bold shadow-2xs hover:bg-red-500/30"
          : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60 font-medium"
      }`}
    >
      {isPending ? (
        <Loader2 className={`w-3 h-3 animate-spin text-blue-500`} />
      ) : isExpired ? (
        <XCircle className="w-3 h-3 text-red-500 fill-red-500/20" />
      ) : (
        <XCircle className="w-3 h-3 text-muted-foreground/60" />
      )}
      {isPending ? (targetIsExpired ? "Marking Expired" : "Marking active") : isExpired ? "Expired Job" : "Mark Expired"}
    </button>
  );
}
