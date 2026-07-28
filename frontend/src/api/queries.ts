import axios from "axios";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import type { Job, ParsedJobData, ParsedDescriptionResult, ToggleAppliedResponse, ToggleExpiredResponse } from "@/types";
import { BASE_URL, ENDPOINTS } from "./constants";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export type { Job, ParsedJobData, ParsedDescriptionResult, ToggleAppliedResponse, ToggleExpiredResponse };

export function parseJobDescription(description: string | null): ParsedDescriptionResult {
  if (!description) return { isJson: false, data: null, raw: "", title: "" };
  try {
    const trimmed = description.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed) as ParsedJobData;
      return { isJson: true, data: parsed, raw: description, title: parsed.title || "" };
    }
  } catch {}
  return { isJson: false, data: null, raw: description, title: "" };
}

export function getSourceShortName(source: string | null): string {
  if (!source) return "LinkedIn";
  const upper = source.toUpperCase();
  if (upper.includes("LINKEDIN")) return "LinkedIn";
  if (upper.includes("INDEED")) return "Indeed";
  if (upper.includes("GLASSDOOR")) return "Glassdoor";
  return source;
}

export interface AutomationStatus {
  jobsScraped: number;
  jobsAutoApplied: number;
  isRunning: boolean;
}

export async function fetchAutomationStatus(): Promise<AutomationStatus> {
  const response = await api.get<AutomationStatus>(`${ENDPOINTS.AUTOMATION_STATUS}?t=${Date.now()}`);
  return response.data;
}

export async function startAutomation(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(ENDPOINTS.AUTOMATION_START);
  return response.data;
}



export async function fetchEligibleJobs(): Promise<Job[] | null> {
  const response = await api.get<Job[] | null>(ENDPOINTS.JOBS_ELIGIBLE);
  return response.data;
}

export async function toggleJobApplied(jobId: string, isApplied: boolean): Promise<ToggleAppliedResponse> {
  const response = await api.post<ToggleAppliedResponse>(ENDPOINTS.JOBS_APPLY, { jobId, isApplied });
  return response.data;
}

export async function toggleJobExpired(jobId: string, isExpired: boolean): Promise<ToggleExpiredResponse> {
  const response = await api.post<ToggleExpiredResponse>(ENDPOINTS.JOBS_EXPIRED, { jobId, isExpired });
  return response.data;
}

export interface AnalyticsFilter {
  dateRange: string;
  sourceName?: string;
  companyName?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface AnalyticsData {
  summary: { totalJobs: number; pendingAiJobs: number; notEligibleJobs: number; eligibleJobs: number; appliedJobs: number; autoAppliedJobs: number; manualAppliedJobs: number; };
  timeSeries: { date: string; totalJobs: number; eligibleJobs: number; appliedJobs: number; }[];
  actionableJobsBySource: { name: string; toApply: number; applied: number }[];
  jobsBySource: { name: string; count: number }[];
  topCompanies: { name: string; count: number }[];
  statusBreakdown: { name: string; value: number }[];
  jobsList: any[];
  pagination: { total: number; page: number; limit: number; };
}

export async function fetchAnalytics(filters: AnalyticsFilter): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (filters.dateRange) params.append('dateRange', filters.dateRange);
  if (filters.sourceName) params.append('sourceName', filters.sourceName);
  if (filters.companyName) params.append('companyName', filters.companyName);
  if (filters.status) params.append('status', filters.status);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await api.get<AnalyticsData>(`${ENDPOINTS.ANALYTICS}?${params.toString()}`);
  return response.data;
}

export async function fetchFilterOptions(sourceName?: string, companyName?: string): Promise<{ sources: string[], companies: string[] }> {
  const params = new URLSearchParams();
  if (sourceName) params.append('sourceName', sourceName);
  if (companyName) params.append('companyName', companyName);
  
  const response = await api.get<{ sources: string[], companies: string[] }>(`${ENDPOINTS.ANALYTICS_FILTERS}?${params.toString()}`);
  return response.data;
}

// React Query Hooks

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

export function useAnalytics(filters: AnalyticsFilter) {
  return useQuery<AnalyticsData, Error>({
    queryKey: ["analytics", filters],
    queryFn: () => fetchAnalytics(filters),
    placeholderData: keepPreviousData,
  });
}

import React from "react";

export function useAutomationStatus() {
  const queryClient = useQueryClient();
  const wasRunning = React.useRef(false);
  const [showStoppedUI, setShowStoppedUI] = useState(false);
  const [stoppedStats, setStoppedStats] = useState({ scraped: 0, applied: 0 });

  const {
    data: fetchedStatus,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["automationStatus"],
    queryFn: fetchAutomationStatus,
    refetchInterval: (query) => (!query.state.error && query.state.data?.isRunning ? 3000 : false),
    retry: 1,
  });

  const status = isError 
    ? { jobsScraped: 0, jobsAutoApplied: 0, isRunning: false } 
    : (fetchedStatus || { jobsScraped: 0, jobsAutoApplied: 0, isRunning: false });

  React.useEffect(() => {
    if (status.isRunning) {
      wasRunning.current = true;
      setShowStoppedUI(false);
    } else if (wasRunning.current && status && !status.isRunning) {
      wasRunning.current = false;
      setShowStoppedUI(true);
      setStoppedStats({ scraped: status.jobsScraped, applied: status.jobsAutoApplied });
      const timer = setTimeout(() => setShowStoppedUI(false), 120000); // 2 mins
      return () => clearTimeout(timer);
    }
  }, [status?.isRunning, status?.jobsScraped, status?.jobsAutoApplied]);

  const startAutomationMutation = useMutation({
    mutationFn: startAutomation,
    onMutate: () => {
      setShowStoppedUI(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationStatus"] });
    },
  });

  return {
    status: status || { jobsScraped: 0, jobsAutoApplied: 0, isRunning: false },
    isLoading,
    showStoppedUI,
    stoppedStats,
    startAutomation: startAutomationMutation.mutate,
    isStarting: startAutomationMutation.isPending,
  };
}
