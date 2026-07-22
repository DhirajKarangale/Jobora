import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEligibleJobs, parseJobDescription, toggleJobApplied } from "@/lib/api";
import type { Job } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobDetailModal } from "@/components/JobDetailModal";
import { 
  Briefcase, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Building2, 
  AlertCircle, 
  Eye, 
  CheckCircle2, 
  Loader2 
} from "lucide-react";

export function JobGrid() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // React Query to fetch eligible jobs on button click / manual refetch
  const {
    data: jobs,
    isFetching,
    error,
    refetch,
  } = useQuery<Job[] | null>({
    queryKey: ["eligibleJobs"],
    queryFn: fetchEligibleJobs,
    enabled: false, // User triggers fetch on button click
  });

  // Mutation to toggle job applied status
  const toggleMutation = useMutation({
    mutationFn: ({ jobId, targetState }: { jobId: string; targetState: boolean }) =>
      toggleJobApplied(jobId, targetState),
    onSuccess: (data) => {
      // Update local query cache
      queryClient.setQueryData<Job[] | null>(["eligibleJobs"], (old) => {
        if (!old) return old;
        return old.map((j) => (j.id === data.jobId ? { ...j, isApplied: data.isApplied } : j));
      });
    },
    onError: (err) => {
      console.error("Failed to toggle job applied status:", err);
    },
  });

  const handleOpenDetail = (job: Job) => {
    setSelectedJob(job);
    setModalOpen(true);
  };

  const handleToggleApplied = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    if (toggleMutation.isPending || !job.id) return;
    const currentState = Boolean(job.isApplied);
    const targetState = !currentState;
    toggleMutation.mutate({ jobId: job.id, targetState });
  };

  const getSourceShortName = (source: string | null): string => {
    if (!source) return "LinkedIn";
    const upper = source.toUpperCase();
    if (upper.includes("LINKEDIN")) return "LinkedIn";
    if (upper.includes("INDEED")) return "Indeed";
    if (upper.includes("GLASSDOOR")) return "Glassdoor";
    return source;
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Action Bar / Trigger */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 backdrop-blur-md shadow-xs">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center justify-center sm:justify-start gap-2">
            <Briefcase className="w-6 h-6 text-indigo-500" />
            Eligible Opportunities
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Fetch and view AI-matched eligible jobs directly from Redis queue.
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer shrink-0"
        >
          <Download className={`w-4 h-4 mr-2 ${isFetching ? "animate-bounce" : ""}`} />
          {isFetching ? "Fetching Jobs..." : "Get Eligible Jobs"}
        </Button>
      </div>

      {/* Loading Skeleton Grid */}
      {isFetching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 py-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-56 rounded-2xl border border-border/50 bg-card p-5 animate-pulse flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-3 bg-muted rounded-full w-1/4 ml-auto" />
                <div className="h-5 bg-muted rounded-md w-3/4 mx-auto" />
                <div className="h-10 bg-muted/60 rounded-md w-full" />
              </div>
              <div className="h-8 bg-muted rounded-lg w-2/3 mx-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isFetching && (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <h3 className="text-lg font-bold text-destructive">Failed to load jobs</h3>
          <p className="text-xs text-muted-foreground">Check backend server connectivity on port 2402.</p>
        </div>
      )}

      {/* Empty State */}
      {jobs !== undefined && jobs === null && !isFetching && !error && (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border border-dashed border-border text-center space-y-4 bg-muted/20">
          <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold">No Eligible Jobs Available</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Run the scraper process first or check back once the AI worker has processed new job listings.
            </p>
          </div>
        </div>
      )}

      {/* Job Grid Display */}
      {Array.isArray(jobs) && jobs.length > 0 && !isFetching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
            <span>Showing {jobs.length} Matched Job{jobs.length > 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {jobs.map((job: Job) => {
              const parsed = parseJobDescription(job.description);
              const sourceShort = getSourceShortName(job.sourceName);
              const displayTitle = parsed.title || (job.description ? job.description.slice(0, 50) + "..." : "Software Engineer");
              const isApplied = Boolean(job.isApplied);
              const isPending = toggleMutation.isPending && toggleMutation.variables?.jobId === job.id;
              const targetIsApply = toggleMutation.variables?.targetState ?? true;

              return (
                <Card
                  key={job.id}
                  className={`group relative flex flex-col justify-between border transition-all duration-300 rounded-xl shadow-xs hover:shadow-lg overflow-hidden min-w-0 ${
                    isApplied
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                      : "border-border/60 hover:border-indigo-500/40 bg-card hover:bg-accent/20 hover:shadow-indigo-500/10"
                  }`}
                >
                  {/* Top Right: Source Name Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge
                      variant="outline"
                      className="bg-muted/90 backdrop-blur-xs font-semibold text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-indigo-500/20 px-2 py-0.5 rounded-full"
                    >
                      {sourceShort}
                    </Badge>
                  </div>

                  <CardHeader className="pt-6 pb-2 px-4 text-center space-y-1">
                    {/* Top Center: Company Name */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {job.companyName || "Unknown Company"}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 py-2 flex-1 flex flex-col items-center justify-center text-center space-y-3">
                    {/* Main Card Content: Job Title */}
                    <CardTitle className="text-sm font-semibold text-foreground/90 leading-snug line-clamp-2 text-center">
                      {displayTitle}
                    </CardTitle>

                    {/* Action Row: View Details & Apply/Applied Button Side-by-Side */}
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => handleOpenDetail(job)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer focus:outline-none"
                      >
                        <Eye className="w-3 h-3" />
                        View Details
                      </button>

                      {/* Apply / Applying / Removing / Applied Button next to View Details */}
                      <button
                        onClick={(e) => handleToggleApplied(e, job)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md transition-all border cursor-pointer ${
                          isPending
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

                        {isPending
                          ? targetIsApply
                            ? "Applying..."
                            : "Removing..."
                          : isApplied
                          ? "Applied"
                          : "Apply"}
                      </button>
                    </div>
                  </CardContent>

                  {/* Card Footer: Apply Button Spans ENTIRE Bottom Area */}
                  <CardFooter className="pt-2 pb-4 px-4 w-full">
                    {job.link ? (
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-xs hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer text-xs h-9"
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
            })}
          </div>
        </div>
      )}

      {/* Modal Detail view */}
      <JobDetailModal
        job={selectedJob}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </section>
  );
}
