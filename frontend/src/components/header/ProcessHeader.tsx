import { useProcessStatus } from "@/hooks/useProcessStatus";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Loader2, Bot } from "lucide-react";
import { useLocation } from "react-router-dom";

export function ProcessHeader() {
  const {
    status,
    isLoading,
    isRefetching,
    scrapingMessage,
    autoApplyMessage,
    startScraping,
    isScrapingStarting,
    startAutoApply,
    isAutoApplyStarting,
    refreshStatus,
  } = useProcessStatus();
  
  const location = useLocation();

  const isScrapingRunning = status.isScrapingRunning;
  const isAutoApplyRunning = status.isAutoApplyRunning;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[73px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-auto">
          
          {/* SCRAPER STATUS WRAPPER */}
          <div className="relative flex items-center">
            <div 
              onClick={() => {
                if (!isScrapingRunning && !isScrapingStarting && !isLoading) startScraping();
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-muted/40 shadow-inner transition-colors ${!isScrapingRunning && !isScrapingStarting && !isLoading ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-80'}`}
              title={!isScrapingRunning ? "Click to start LinkedIn scraping" : "Scraping in progress"}
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline-block">
                Scraper Status:
              </span>
              {isLoading || isRefetching || isScrapingStarting ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  {isScrapingStarting ? "Running..." : "Checking..."}
                </span>
              ) : isScrapingRunning ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Running
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Play className="w-3.5 h-3.5" />
                  Start Scraping
                </span>
              )}
            </div>

            {scrapingMessage && (
              <span className="absolute top-full mt-0.5 left-4 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in transition-all whitespace-nowrap">
                {scrapingMessage}
              </span>
            )}
          </div>

          {/* INSTAHYRE AUTO APPLY STATUS WRAPPER */}
          <div className="relative flex items-center">
            <div 
              onClick={() => {
                if (!isAutoApplyRunning && !isAutoApplyStarting && !isLoading) startAutoApply();
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-muted/40 shadow-inner transition-colors ${!isAutoApplyRunning && !isAutoApplyStarting && !isLoading ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-80'}`}
              title={!isAutoApplyRunning ? "Click to start Instahyre Auto Apply" : "Auto Apply in progress"}
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline-block">
                Auto Apply:
              </span>
              {isLoading || isRefetching || isAutoApplyStarting ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  {isAutoApplyStarting ? "Applying..." : "Checking..."}
                </span>
              ) : isAutoApplyRunning ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Running
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Bot className="w-3.5 h-3.5" />
                  Start Auto Apply
                </span>
              )}
            </div>
            
            {autoApplyMessage && (
              <span className="absolute top-full mt-0.5 left-4 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in transition-all whitespace-nowrap">
                {autoApplyMessage}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refreshStatus}
            disabled={isRefetching}
            className="border-border hover:bg-accent/80 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefetching ? "animate-spin text-indigo-500" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  );
}
