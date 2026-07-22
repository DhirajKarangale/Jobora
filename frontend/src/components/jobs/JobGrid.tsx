import { useState } from "react";
import type { Job } from "@/types";
import { useJobs } from "@/hooks/useJobs";
import { JobCard } from "./JobCard";
import { JobDetailModal } from "./JobDetailModal";
import { Button } from "@/components/ui/button";
import { Briefcase, Download, Sparkles, AlertCircle } from "lucide-react";

export function JobGrid() {
  const { jobs, isFetching, error, refetchJobs, toggleApplied, isToggling, toggleVariables } = useJobs();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenDetail = (job: Job) => {
    setSelectedJob(job);
    setModalOpen(true);
  };

  const handleToggleApplied = (jobId: string, targetState: boolean) => {
    toggleApplied({ jobId, targetState });
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
          onClick={() => refetchJobs()}
          disabled={isFetching}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer shrink-0"
        >
          <Download className={`w-4 h-4 mr-2 ${isFetching ? "animate-bounce" : ""}`} />
          {isFetching ? "Fetching Jobs..." : "Get Eligible Jobs"}
        </Button>
      </div>

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

      {error && !isFetching && (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <h3 className="text-lg font-bold text-destructive">Failed to load jobs</h3>
          <p className="text-xs text-muted-foreground">Check backend server connectivity on port 2402.</p>
        </div>
      )}

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

      {Array.isArray(jobs) && jobs.length > 0 && !isFetching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
            <span>Showing {jobs.length} Matched Job{jobs.length > 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {jobs.map((job: Job) => {
              const isPending = isToggling && toggleVariables?.jobId === job.id;
              const targetIsApply = toggleVariables?.targetState ?? true;

              return (
                <JobCard
                  key={job.id}
                  job={job}
                  isPending={isPending}
                  targetIsApply={targetIsApply}
                  onOpenDetail={handleOpenDetail}
                  onToggleApplied={handleToggleApplied}
                />
              );
            })}
          </div>
        </div>
      )}

      <JobDetailModal
        job={selectedJob}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </section>
  );
}
