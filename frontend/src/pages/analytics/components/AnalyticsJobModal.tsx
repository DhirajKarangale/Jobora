import type { Job } from "@/types";
import { parseJobDescription } from "@/api/queries";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Globe,
  MapPin,
  Briefcase,
  GraduationCap,
  DollarSign,
  Wrench,
  Sparkles,
  Clock,
  Calendar
} from "lucide-react";

interface AnalyticsJobModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AnalyticsJobModal({ job, isOpen, onClose }: AnalyticsJobModalProps) {
  if (!job) return null;

  const parsed = parseJobDescription(job.description);
  const data = parsed.data;
  const jobTitle = job.role || parsed.title || "Software Engineer Generic";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={`sm:max-w-[850px] max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0 bg-card rounded-2xl border-2 ${
        job.isApplied 
          ? "border-emerald-500/50 shadow-[0_0_20px_-3px_rgba(16,185,129,0.15)]"
          : job.isExpired
            ? "border-red-500/50 shadow-[0_0_20px_-3px_rgba(239,68,68,0.15)]"
            : "border-border shadow-2xl"
      }`}>
        <DialogHeader className="p-6 border-b border-border/50 bg-muted/20 relative shrink-0">
          <div className="flex flex-col gap-2 pr-8">
            <div className="flex justify-between items-start gap-4">
              <DialogTitle className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {jobTitle}
              </DialogTitle>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {job.companyName && (
                <DialogDescription className="text-sm font-semibold flex items-center gap-1.5 text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                  <Building2 className="w-4 h-4 shrink-0" />
                  {job.companyName}
                </DialogDescription>
              )}
              {job.sourceName && (
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium px-2.5 py-1 text-xs rounded-full">
                  <Globe className="w-3.5 h-3.5 mr-1.5 inline" />
                  {job.sourceName}
                </Badge>
              )}
              {job.addedDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium ml-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Added: {new Date(job.addedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              
              <div className="flex items-center gap-2 ml-auto">
                {job.isApplied ? (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2 py-0.5 text-xs">
                    Applied: {job.appliedDate ? new Date(job.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Yes'}
                  </Badge>
                ) : (
                  <>
                    {job.isEligible && !job.isExpired && (
                      <Badge variant="secondary" className="bg-slate-500/10 text-slate-600 border-slate-500/20 px-2 py-0.5 text-xs">
                        Not Applied
                      </Badge>
                    )}
                    {job.isExpired && (
                      <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5 text-xs">
                        Expired
                      </Badge>
                    )}
                    <Badge variant="secondary" className={job.isEligible ? "bg-blue-500/10 text-blue-600 border-blue-500/20 px-2 py-0.5 text-xs" : "bg-orange-500/10 text-orange-600 border-orange-500/20 px-2 py-0.5 text-xs"}>
                      {job.isEligible ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {parsed.isJson && data ? (
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-5 rounded-2xl border border-border/40">
                {data.location && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Location</span>
                      <span className="font-medium text-foreground text-sm">{data.location}</span>
                    </div>
                  </div>
                )}

                {data.experience && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Experience</span>
                      <span className="font-medium text-foreground text-sm">{data.experience}</span>
                    </div>
                  </div>
                )}

                {data.education && (
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                      <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Education</span>
                      <span className="font-medium text-foreground text-sm">{data.education}</span>
                    </div>
                  </div>
                )}

                {data.salary && data.salary !== "Not provided" && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
                      <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Salary</span>
                      <span className="font-medium text-foreground text-sm">{data.salary}</span>
                    </div>
                  </div>
                )}

                {data.employment_type && data.employment_type !== "Not provided" && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0">
                      <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Employment Type</span>
                      <span className="font-medium text-foreground text-sm">{data.employment_type}</span>
                    </div>
                  </div>
                )}
              </div>

              {data.skills && Array.isArray(data.skills) && data.skills.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="p-1.5 rounded-md bg-indigo-500/10">
                      <Wrench className="w-4 h-4 text-indigo-500" />
                    </div>
                    Required Skills
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.skills.map((skill, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-background text-foreground border-border font-medium px-3 py-1.5 text-xs hover:bg-muted transition-colors rounded-lg"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {data.extra && Array.isArray(data.extra) && data.extra.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="p-1.5 rounded-md bg-amber-500/10">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                    Key Highlights & Perks
                  </div>
                  <ul className="space-y-3 bg-muted/20 p-5 rounded-2xl border border-border/40 text-sm">
                    {data.extra.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed font-sans bg-muted/20 p-6 rounded-2xl border border-border/40">
              {job.description || "No description provided."}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
