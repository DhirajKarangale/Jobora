import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProcessStatus, startProcess } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Loader2, CheckCircle2, PauseCircle } from "lucide-react";
import { useState } from "react";

export function ProcessHeader() {
  const queryClient = useQueryClient();
  const [startMessage, setStartMessage] = useState<string | null>(null);

  // 1. Initial API call & periodic refetch to check process status
  const {
    data: isRunning,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["processStatus"],
    queryFn: fetchProcessStatus,
    refetchInterval: 5000, // auto poll every 5s
  });

  // 2. Mutation to start process
  const startMutation = useMutation({
    mutationFn: startProcess,
    onSuccess: (started) => {
      if (started) {
        setStartMessage("Process started successfully!");
      } else {
        setStartMessage("Process is already running.");
      }
      queryClient.invalidateQueries({ queryKey: ["processStatus"] });
      setTimeout(() => setStartMessage(null), 4000);
    },
    onError: (err) => {
      setStartMessage("Failed to start process.");
      console.error(err);
      setTimeout(() => setStartMessage(null), 4000);
    },
  });

  // 3. Clear queries and refresh status
  const handleRefresh = async () => {
    setStartMessage(null);
    queryClient.resetQueries({ queryKey: ["processStatus"] });
    queryClient.resetQueries({ queryKey: ["eligibleJobs"] });
    await refetch();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Title / Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-extrabold text-xl tracking-wider">
            J
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
              JOBORA
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Smart Job Scraper & AI Matcher</p>
          </div>
        </div>

        {/* Top Center: Process Status Indicator */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-muted/40 shadow-inner">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Scraper Status:
            </span>
            {isLoading && isRunning === undefined ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                Checking...
              </span>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Process Running
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <PauseCircle className="w-3.5 h-3.5" />
                Process Idle
              </span>
            )}
          </div>
          {startMessage && (
            <p className="text-xs font-medium text-indigo-500 animate-in fade-in transition-all">
              {startMessage}
            </p>
          )}
        </div>

        {/* Action Controls: Run & Refresh */}
        <div className="flex items-center gap-2">
          {/* Show Run Process button if process is NOT running */}
          {!isRunning && (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || isLoading}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-md hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 cursor-pointer"
            >
              {startMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Play className="w-4 h-4 mr-1.5 fill-current" />
              )}
              Run Process
            </Button>
          )}

          {/* Refresh Process Status button */}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefetching}
            className="border-border hover:bg-accent/80 transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefetching ? "animate-spin text-indigo-500" : ""}`} />
            Refresh
          </Button>
        </div>

      </div>
    </header>
  );
}
