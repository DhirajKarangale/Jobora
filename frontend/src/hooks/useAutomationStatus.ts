import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAutomationStatus, startJobScraping, startInstahyreAutoApply } from "@/lib/api";

export function useAutomationStatus() {
  const queryClient = useQueryClient();
  const [jobScrapingMessage, setJobScrapingMessage] = useState<string | null>(null);
  const [autoApplyMessage, setAutoApplyMessage] = useState<string | null>(null);

  const {
    data: status,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["automationStatus"],
    queryFn: fetchAutomationStatus,
    staleTime: 0,
    gcTime: 0,
  });

  const startJobScrapingMutation = useMutation({
    mutationFn: startJobScraping,
    onSuccess: (res) => {
      if (typeof res === 'object' && res !== null && 'jobsFound' in res) {
        setJobScrapingMessage(`Found ${res.jobsFound} jobs`);
      } else {
        setJobScrapingMessage(res ? "Job scraping completed successfully" : "Job scraping already running");
      }
      queryClient.invalidateQueries({ queryKey: ["automationStatus"] });
      setTimeout(() => setJobScrapingMessage(null), 120000);
    },
    onError: () => {
      setJobScrapingMessage("Failed to start job scraping");
      setTimeout(() => setJobScrapingMessage(null), 120000);
    },
  });

  const startAutoApplyMutation = useMutation({
    mutationFn: startInstahyreAutoApply,
    onSuccess: (res) => {
      setAutoApplyMessage(`Applied to ${res.jobsApplied} jobs`);
      queryClient.invalidateQueries({ queryKey: ["automationStatus"] });
      setTimeout(() => setAutoApplyMessage(null), 120000);
    },
    onError: () => {
      setAutoApplyMessage("Failed to start auto-apply");
      setTimeout(() => setAutoApplyMessage(null), 120000);
    },
  });

  const handleRefresh = async () => {
    setJobScrapingMessage(null);
    setAutoApplyMessage(null);
    await refetch();
  };

  return {
    status: status || { isJobScraperRunning: false, isAutoApplyRunning: false },
    isLoading,
    isRefetching,
    jobScrapingMessage,
    autoApplyMessage,
    startJobScraping: startJobScrapingMutation.mutate,
    isJobScrapingStarting: startJobScrapingMutation.isPending,
    startAutoApply: startAutoApplyMutation.mutate,
    isAutoApplyStarting: startAutoApplyMutation.isPending,
    refreshStatus: handleRefresh,
  };
}
