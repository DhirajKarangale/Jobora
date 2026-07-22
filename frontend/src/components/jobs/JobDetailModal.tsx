import { useState, useEffect } from "react";
import type { Job } from "@/types";
import { parseJobDescription } from "@/lib/api";
import { useJobs } from "@/hooks/useJobs";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplyStatusButton } from "./ApplyStatusButton";
import { 
  ExternalLink, 
  Building2, 
  Globe, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  DollarSign, 
  Wrench, 
  Sparkles,
  Clock
} from "lucide-react";

interface JobDetailModalProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobDetailModal({ job, open, onOpenChange }: JobDetailModalProps) {
  const { toggleApplied, isToggling, toggleVariables } = useJobs();
  const [isAppliedState, setIsAppliedState] = useState(false);

  useEffect(() => {
    if (job) {
      setIsAppliedState(Boolean(job.isApplied));
    }
  }, [job]);

  if (!job) return null;

  const parsed = parseJobDescription(job.description);
  const data = parsed.data;
  const jobTitle = parsed.title || job.companyName || "Job Details";

  const isPending = isToggling && toggleVariables?.jobId === job.id;
  const targetIsApply = toggleVariables?.targetState ?? true;

  const handleToggle = () => {
    if (job.id && !isPending) {
      const targetState = !isAppliedState;
      setIsAppliedState(targetState);
      toggleApplied({ jobId: job.id, targetState });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
          {jobTitle}
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm text-indigo-500 font-semibold flex items-center gap-1.5 mt-1">
          <Building2 className="w-4 h-4 shrink-0 text-indigo-500" />
          {job.companyName || "Unknown Company"}
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {parsed.isJson && data ? (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/50">
              {data.location && (
                <div className="flex items-start gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Location</span>
                    <span className="font-medium text-foreground">{data.location}</span>
                  </div>
                </div>
              )}

              {data.experience && (
                <div className="flex items-start gap-2 text-xs">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Experience</span>
                    <span className="font-medium text-foreground">{data.experience}</span>
                  </div>
                </div>
              )}

              {data.education && (
                <div className="flex items-start gap-2 text-xs sm:col-span-2">
                  <GraduationCap className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Education</span>
                    <span className="font-medium text-foreground">{data.education}</span>
                  </div>
                </div>
              )}

              {data.salary && data.salary !== "Not provided" && (
                <div className="flex items-start gap-2 text-xs">
                  <DollarSign className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Salary</span>
                    <span className="font-medium text-foreground">{data.salary}</span>
                  </div>
                </div>
              )}

              {data.employment_type && data.employment_type !== "Not provided" && (
                <div className="flex items-start gap-2 text-xs">
                  <Briefcase className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Employment Type</span>
                    <span className="font-medium text-foreground">{data.employment_type}</span>
                  </div>
                </div>
              )}
            </div>

            {data.skills && Array.isArray(data.skills) && data.skills.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80">
                  <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                  Required Skills ({data.skills.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.skills.map((skill, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 font-medium px-2.5 py-1 text-xs hover:bg-indigo-500/20 transition-colors"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.extra && Array.isArray(data.extra) && data.extra.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Key Highlights & Perks
                </div>
                <ul className="space-y-1.5 bg-muted/20 p-3 rounded-xl border border-border/40 text-xs">
                  {data.extra.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground leading-relaxed">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed font-sans bg-muted/30 p-4 rounded-xl border border-border/40 max-h-[50vh] overflow-y-auto">
            {job.description || "No description provided."}
          </div>
        )}
      </DialogContent>

      <DialogFooter className="flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 mr-auto text-xs">
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold px-2 py-0.5 text-[11px]">
            <Globe className="w-3 h-3 mr-1 inline" />
            {job.sourceName || "LinkedIn"}
          </Badge>
          <span className="text-muted-foreground font-mono text-[11px]">ID: {job.id}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <ApplyStatusButton
            isApplied={isAppliedState}
            isPending={isPending}
            targetIsApply={targetIsApply}
            onToggle={handleToggle}
            variant="button"
          />

          {job.link && (
            <a href={job.link} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-xs hover:shadow-indigo-500/20 cursor-pointer text-xs h-8"
              >
                Apply Now
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </a>
          )}
        </div>
      </DialogFooter>
    </Dialog>
  );
}
