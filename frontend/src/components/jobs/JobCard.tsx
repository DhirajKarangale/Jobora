import React from "react";
import type { Job } from "@/types";
import { parseJobDescription, getSourceShortName } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplyStatusButton } from "./ApplyStatusButton";
import { Building2, Eye, ExternalLink } from "lucide-react";

interface JobCardProps {
  job: Job;
  isPending: boolean;
  targetIsApply?: boolean;
  onOpenDetail: (job: Job) => void;
  onToggleApplied: (jobId: string, targetState: boolean) => void;
}

export function JobCard({
  job,
  isPending,
  targetIsApply = true,
  onOpenDetail,
  onToggleApplied,
}: JobCardProps) {
  const parsed = parseJobDescription(job.description);
  const sourceShort = getSourceShortName(job.sourceName);
  const displayTitle = parsed.title || (job.description ? job.description.slice(0, 50) + "..." : "Software Engineer");
  const isApplied = Boolean(job.isApplied);

  const handleToggle = () => {
    if (job.id) {
      onToggleApplied(job.id, !isApplied);
    }
  };

  return (
    <Card
      className={`group relative flex flex-col justify-between border transition-all duration-300 rounded-xl shadow-xs hover:shadow-lg overflow-hidden min-w-0 ${isApplied
        ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
        : "border-border/60 hover:border-indigo-500/40 bg-card hover:bg-accent/20 hover:shadow-indigo-500/10"
        }`}
    >
      <CardHeader className="pt-4 pb-2 px-4 space-y-1">
        <div className="flex items-center justify-between w-full">
          <div className="text-[10px] text-muted-foreground/80 font-medium tracking-wide">
            {job.addedDate ? new Date(job.addedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ""}
          </div>
          
          <Badge
            variant="outline"
            className="bg-muted/90 backdrop-blur-xs font-semibold text-[8px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-indigo-500/20 px-1.5 py-0 rounded-full"
          >
            {sourceShort}
          </Badge>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium pt-1">
          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate max-w-[140px]" title={job.companyName || "Unknown Company"}>
            {job.companyName || "Unknown Company"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-2 flex-1 flex flex-col items-center justify-center text-center space-y-3">
        <CardTitle className="text-sm font-semibold text-foreground/90 leading-snug line-clamp-2 text-center">
          {displayTitle}
        </CardTitle>

        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
          <button
            onClick={() => onOpenDetail(job)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer focus:outline-none"
          >
            <Eye className="w-3 h-3" />
            View Details
          </button>

          <ApplyStatusButton
            isApplied={isApplied}
            isPending={isPending}
            targetIsApply={targetIsApply}
            onToggle={handleToggle}
            variant="inline"
          />
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-4 px-4 w-full">
        {job.link ? (
          <a href={job.link} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-xs hover:shadow-indigo-500/25 transition-all duration-200 text-xs h-9"
            >
              Apply
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </a>
        ) : (
          <Button
            variant="secondary"
            disabled
            size="sm"
            className="w-full rounded-lg text-xs h-9"
          >
            No Link Available
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
