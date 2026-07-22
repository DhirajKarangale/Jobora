import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProcessStatus, startProcess } from "@/lib/api";

export function useProcessStatus() {
  const queryClient = useQueryClient();
  const [startMessage, setStartMessage] = useState<string | null>(null);

  const {
    data: isRunning,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["processStatus"],
    queryFn: fetchProcessStatus,
    staleTime: 0,
    gcTime: 0,
  });

  const startMutation = useMutation({
    mutationFn: startProcess,
    onSuccess: (started) => {
      setStartMessage(started ? "Process started successfully!" : "Process is already running.");
      queryClient.invalidateQueries({ queryKey: ["processStatus"] });
      setTimeout(() => setStartMessage(null), 4000);
    },
    onError: () => {
      setStartMessage("Failed to start process.");
      setTimeout(() => setStartMessage(null), 4000);
    },
  });

  const handleRefresh = async () => {
    setStartMessage(null);
    await refetch();
  };

  return {
    isRunning,
    isLoading,
    isRefetching,
    startMessage,
    startProcess: startMutation.mutate,
    isStarting: startMutation.isPending,
    refreshStatus: handleRefresh,
  };
}
