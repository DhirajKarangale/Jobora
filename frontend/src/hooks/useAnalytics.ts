import { useQuery } from "@tanstack/react-query";
import { fetchAnalytics, type AnalyticsFilter, type AnalyticsData } from "@/lib/api";

export function useAnalytics(filters: AnalyticsFilter) {
  return useQuery<AnalyticsData, Error>({
    queryKey: ["analytics", filters],
    queryFn: () => fetchAnalytics(filters),
  });
}
