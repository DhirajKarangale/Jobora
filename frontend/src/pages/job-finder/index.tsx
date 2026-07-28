import React, { useState } from "react";
import { useAutomationStatus, usePendingJobs } from "@/api/queries";
import { Play, Loader2, Bot, CheckCircle2, Trash2, ShieldAlert, CheckSquare, ExternalLink, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { getSourceShortName } from "@/api/queries";

export function JobFinder() {
  const {
    status,
    isLoading,
    showStoppedUI,
    stoppedStats,
    startAutomation,
    isStarting,
    stopAutomation,
    isStopping,
  } = useAutomationStatus();

  const {
    jobs,
    isLoading: isPendingJobsLoading,
    removeJob,
    isRemoving,
    removingId,
    applyJob,
    isApplying,
    applyingId,
    clearAll,
    isClearingAll,
  } = usePendingJobs();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(jobs.length / itemsPerPage);
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }
  const currentJobs = jobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isRunning = status.isRunning;

  const handleStart = () => {
    if (!isRunning && !isStarting && !isLoading) {
      startAutomation();
    }
  };

  const handleRemoveAll = () => {
    if (confirm("Are you sure you want to remove all pending jobs? They will be marked as not eligible.")) {
      clearAll();
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
          Job Finder
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Monitor your automation scraper and manage pending jobs waiting for AI check.
        </p>
      </div>

      {/* Main Automation Status Card */}
      <div className="bg-card p-6 md:p-8 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Automation Engine</h2>
          <div className="flex items-center gap-3">
            <div className="flex h-3 w-3 relative">
              {(isRunning || isStarting) && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning || isStarting ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {isLoading || isStarting ? "Starting up engine..." 
               : isRunning ? "Engine is currently running" 
               : showStoppedUI ? "Engine was recently stopped" 
               : "Engine is currently stopped"}
            </span>
          </div>
        </div>

        {isRunning ? (
          <button
            onClick={() => stopAutomation()}
            disabled={isStopping || isLoading}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold transition-all shadow-md bg-red-600 hover:bg-red-700 text-white shadow-red-500/25 hover:shadow-red-500/40 relative overflow-hidden"
          >
            <span className="absolute inset-0 w-full h-full bg-red-500/20 animate-pulse rounded-xl"></span>
            {isStopping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                <span className="relative z-10">Stopping...</span>
              </>
            ) : (
              <>
                <div className="relative flex h-3 w-3 mr-1 z-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </div>
                <span className="relative z-10">Stop Finding Jobs</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={isStarting || isLoading}
            className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold transition-all shadow-md ${
              !isStarting && !isLoading
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40"
                : "bg-muted text-muted-foreground cursor-not-allowed border border-border"
            }`}
          >
            {isLoading || isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </>
            ) : showStoppedUI ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Start Again
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Finding Jobs
              </>
            )}
          </button>
        )}
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-1 select-none cursor-default">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Jobs Found</span>
          <span className="text-3xl font-black">{status.jobsScraped}</span>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-1 select-none cursor-default">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auto Applied</span>
          <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{status.jobsAutoApplied}</span>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-1 select-none cursor-default">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending AI Check</span>
          <span className="text-3xl font-black text-amber-500">{jobs.length}</span>
        </div>
      </div>

      {/* Pending Jobs Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 md:p-6 border-b border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Jobs Pending AI Check
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              These jobs are waiting in the queue to be analyzed by AI.
            </p>
          </div>
          <button
            onClick={handleRemoveAll}
            disabled={jobs.length === 0 || isClearingAll}
            className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Remove All Pending Jobs
          </button>
        </div>

        <div className="overflow-x-auto min-h-[300px] flex flex-col">
          {jobs.length > 0 ? (
            <>
              <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                <tr>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Company</th>
                  <th className="px-6 py-4 font-semibold">Portal</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {currentJobs.map((job) => (
                  <tr key={job.messageId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{job.role}</td>
                    <td className="px-6 py-4 text-muted-foreground">{job.companyName}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-md border border-indigo-500/20">
                        {getSourceShortName(job.sourceName)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {job.portalLink && (
                          <a 
                            href={job.portalLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-indigo-600 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors flex items-center justify-center"
                            title="View on Job Portal"
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                        {job.link && (
                          <a 
                            href={job.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center justify-center"
                            title="Direct Apply Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => applyJob({ messageId: job.messageId, dbId: job.dbId })}
                          disabled={(isApplying && applyingId === job.messageId) || (isRemoving && removingId === job.messageId)}
                          className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Mark as Applied"
                        >
                          {isApplying && applyingId === job.messageId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckSquare className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => removeJob({ messageId: job.messageId, dbId: job.dbId })}
                          disabled={(isRemoving && removingId === job.messageId) || (isApplying && applyingId === job.messageId)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Remove from queue & mark as not eligible"
                        >
                          {isRemoving && removingId === job.messageId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10 mt-auto">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, jobs.length)}</span> of <span className="font-medium text-foreground">{jobs.length}</span> entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            </>
          ) : isPendingJobsLoading ? (
            <div className="flex-1 flex flex-col justify-center items-center text-muted-foreground min-h-[300px]">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-sm">Loading pending jobs...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground min-h-[300px]">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mb-3" />
              <p className="font-medium">No pending jobs in the queue.</p>
              <p className="text-xs mt-1">Start finding jobs to populate this list.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
