import { useAutomationStatus } from "@/api/queries";
import { Play, Loader2, Bot, CheckCircle2 } from "lucide-react";

export function Header() {
  const {
    status,
    isLoading,
    showStoppedUI,
    stoppedStats,
    startAutomation,
    isStarting,
  } = useAutomationStatus();

  const isRunning = status.isRunning;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[73px] py-3 flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto order-2 sm:order-1 justify-center sm:justify-start">

          {/* SCRAPER STATUS WRAPPER */}
          <div className="relative flex items-center">
            <div
              onClick={() => {
                if (!isRunning && !isStarting && !isLoading) startAutomation();
              }}
              className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full border border-border/60 bg-muted/40 shadow-inner transition-colors ${!isRunning && !isStarting && !isLoading ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-80'}`}
              title={!isRunning ? "Click to start finding jobs" : "Finding jobs in progress"}
            >
              <span className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:inline-block">
                Job Finder:
              </span>
              {isLoading || isStarting ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  {isStarting ? "Starting..." : "Checking..."}
                </span>
              ) : isRunning ? (
                <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Running | Found: {status.jobsScraped} | Applied: {status.jobsAutoApplied}
                </span>
              ) : showStoppedUI ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  Stopped | Found: {stoppedStats.scraped} | Applied: {stoppedStats.applied}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  <Bot className="w-3.5 h-3.5" />
                  Start Finding Jobs
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2 justify-end">
          <div className="sm:hidden h-8 w-8 mr-auto rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-extrabold text-sm tracking-wider shrink-0">
            J
          </div>
        </div>
      </div>
    </header>
  );
}

