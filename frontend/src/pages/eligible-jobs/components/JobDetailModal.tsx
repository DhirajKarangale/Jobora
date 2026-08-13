import { useState, useEffect } from "react";
import type { Job } from "@/types";
import { parseJobDescription, useJobs } from "@/api/queries";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplyStatusButton } from "./ApplyStatusButton";
import { ExpiredStatusButton } from "./ExpiredStatusButton";
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
  Clock,
  FileText
} from "lucide-react";

interface JobDetailModalProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobDetailModal({ job, open, onOpenChange }: JobDetailModalProps) {
  const { toggleApplied, isToggling, toggleVariables, toggleExpired, toggleExpiredVariables, isTogglingExpired } = useJobs();
  const [isAppliedState, setIsAppliedState] = useState(false);
  const [isExpiredState, setIsExpiredState] = useState(false);

  useEffect(() => {
    if (job) {
      setIsAppliedState(Boolean(job.isApplied));
      setIsExpiredState(Boolean(job.isExpired));
    }
  }, [job]);

  if (!job) return null;

  const parsed = parseJobDescription(job.description);
  const data = parsed.data;
  const jobTitle = job.role || parsed.title || job.companyName || "Job Details";

  const isPending = isToggling && toggleVariables?.jobId === job.id;
  const targetIsApply = toggleVariables?.targetState ?? true;

  const handleToggle = () => {
    if (job.id && !isPending) {
      const targetState = !isAppliedState;
      setIsAppliedState(targetState);
      toggleApplied({ jobId: job.id, targetState });
    }
  };

  const isPendingExpired = isTogglingExpired && toggleExpiredVariables?.jobId === job.id;
  const targetIsExpired = toggleExpiredVariables?.targetState ?? true;

  const handleToggleExpired = () => {
    if (job.id && !isPendingExpired) {
      const targetState = !isExpiredState;
      setIsExpiredState(targetState);
      toggleExpired({ jobId: job.id, targetState });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[800px] max-h-[90vh] overflow-y-auto flex flex-col gap-6 p-6 transition-all duration-300 bg-background ${isAppliedState
          ? "border-2 border-emerald-500/50 shadow-[0_0_20px_-3px_rgba(16,185,129,0.15)]"
          : isExpiredState
            ? "border-2 border-red-500/50 shadow-[0_0_20px_-3px_rgba(239,68,68,0.15)]"
            : "border border-border"
        }`}>
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-snug pr-6">
            {jobTitle}
          </DialogTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
            <DialogDescription className="text-xs sm:text-sm text-indigo-500 font-semibold flex items-center gap-1.5">
              <Building2 className="w-4 h-4 shrink-0 text-indigo-500" />
              {job.companyName || "Unknown Company"}
            </DialogDescription>
            {job.addedDate && (
              <div className="text-xs text-muted-foreground/80 font-medium">
                {new Date(job.addedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            {job.fitResume && (
              <Badge variant="outline" className="ml-0 sm:ml-2 mt-2 sm:mt-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold px-2 py-0.5 text-[10px] uppercase">
                <FileText className="w-3 h-3 mr-1 inline" />
                Best Fit: {job.fitResume} Resume
              </Badge>
            )}
          </div>
        </DialogHeader>

        {parsed.isJson && data ? (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-4 rounded-xl border border-border/50">
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
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80">
                  <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                  Required Skills ({data.skills.length})
                </div>
                <div className="flex flex-wrap gap-2">
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
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Key Highlights & Perks
                </div>
                <ul className="space-y-2 bg-muted/20 p-4 rounded-xl border border-border/40 text-xs">
                  {data.extra.map((item, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-muted-foreground leading-relaxed">
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

        <DialogFooter className="flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50 mt-2">
          <div className="flex items-center gap-2 mr-auto text-xs">
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold px-2 py-0.5 text-[11px]">
              <Globe className="w-3 h-3 mr-1 inline" />
              {job.sourceName || "LinkedIn"}
            </Badge>
            {/* <span className="text-muted-foreground font-mono text-[11px]">ID: {job.id}</span> */}
          </div>

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <ExpiredStatusButton
              isExpired={isExpiredState}
              isPending={isPendingExpired}
              targetIsExpired={targetIsExpired}
              onToggle={handleToggleExpired}
              variant="button"
            />

            <ApplyStatusButton
              isApplied={isAppliedState}
              isPending={isPending}
              targetIsApply={targetIsApply}
              onToggle={handleToggle}
              variant="button"
            />

            {job.portal_link && (
              <a href={job.portal_link} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold text-xs h-8"
                >
                  Portal Link
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </a>
            )}

            {job.link && (
              <a href={job.link} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-xs hover:shadow-indigo-500/20 text-xs h-8"
                >
                  Apply Now
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </a>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
