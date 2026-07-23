import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEligibleJobs, toggleJobApplied, toggleJobExpired } from "@/lib/api";
import type { Job } from "@/types";

export function useJobs() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery<Job[] | null>({
    queryKey: ["eligibleJobs"],
    queryFn: fetchEligibleJobs,
    enabled: false,
  });

  const toggleAppliedMutation = useMutation({
    mutationFn: ({ jobId, targetState }: { jobId: string; targetState: boolean }) =>
      toggleJobApplied(jobId, targetState),
    onSuccess: (data) => {
      queryClient.setQueryData<Job[] | null>(["eligibleJobs"], (old) => {
        if (!old) return old;
        return old.map((j) => (j.id === data.jobId ? { ...j, isApplied: data.isApplied } : j));
      });
    },
  });

  const toggleExpiredMutation = useMutation({
    mutationFn: ({ jobId, targetState }: { jobId: string; targetState: boolean }) =>
      toggleJobExpired(jobId, targetState),
    onSuccess: (data) => {
      queryClient.setQueryData<Job[] | null>(["eligibleJobs"], (old) => {
        if (!old) return old;
        // Do not remove from eligible jobs list when marked as expired
        // just update the state so the UI reflects it
        return old.map((j) => (j.id === data.jobId ? { ...j, isExpired: data.isExpired } : j));
      });
    },
  });

  return {
    jobs: jobsQuery.data,
    isFetching: jobsQuery.isFetching,
    error: jobsQuery.error,
    refetchJobs: jobsQuery.refetch,
    toggleApplied: toggleAppliedMutation.mutate,
    toggleVariables: toggleAppliedMutation.variables,
    isToggling: toggleAppliedMutation.isPending,
    toggleExpired: toggleExpiredMutation.mutate,
    toggleExpiredVariables: toggleExpiredMutation.variables,
    isTogglingExpired: toggleExpiredMutation.isPending,
  };
}
