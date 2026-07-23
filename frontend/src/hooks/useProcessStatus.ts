import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProcessStatus, startProcess, startInstahyreProcess } from "@/lib/api";

export function useProcessStatus() {
  const queryClient = useQueryClient();
  const [scrapingMessage, setScrapingMessage] = useState<string | null>(null);
  const [autoApplyMessage, setAutoApplyMessage] = useState<string | null>(null);

  const {
    data: status,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["processStatus"],
    queryFn: fetchProcessStatus,
    staleTime: 0,
    gcTime: 0,
  });

  const startScrapingMutation = useMutation({
    mutationFn: startProcess,
    onSuccess: (res) => {
      if (typeof res === 'object' && res !== null && 'jobsFound' in res) {
        setScrapingMessage(`Found ${res.jobsFound} jobs`);
      } else {
        setScrapingMessage(res ? "Scraping completed successfully" : "Scraping already running");
      }
      queryClient.invalidateQueries({ queryKey: ["processStatus"] });
      setTimeout(() => setScrapingMessage(null), 120000);
    },
    onError: () => {
      setScrapingMessage("Failed to start scraping");
      setTimeout(() => setScrapingMessage(null), 120000);
    },
  });

  const startAutoApplyMutation = useMutation({
    mutationFn: startInstahyreProcess,
    onSuccess: (res) => {
      setAutoApplyMessage(`Applied to ${res.jobsApplied} jobs`);
      queryClient.invalidateQueries({ queryKey: ["processStatus"] });
      setTimeout(() => setAutoApplyMessage(null), 120000);
    },
    onError: () => {
      setAutoApplyMessage("Failed to start auto-apply");
      setTimeout(() => setAutoApplyMessage(null), 120000);
    },
  });

  const handleRefresh = async () => {
    setScrapingMessage(null);
    setAutoApplyMessage(null);
    await refetch();
  };

  return {
    status: status || { isScrapingRunning: false, isAutoApplyRunning: false },
    isLoading,
    isRefetching,
    scrapingMessage,
    autoApplyMessage,
    startScraping: startScrapingMutation.mutate,
    isScrapingStarting: startScrapingMutation.isPending,
    startAutoApply: startAutoApplyMutation.mutate,
    isAutoApplyStarting: startAutoApplyMutation.isPending,
    refreshStatus: handleRefresh,
  };
}
