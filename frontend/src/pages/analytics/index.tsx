import { useState, useEffect } from "react";
import { useAnalytics } from "@/api/queries";
import { fetchFilterOptions } from "@/api/queries";
import type { AnalyticsFilter } from "@/api/queries";
import type { Job } from "@/types";
import { Loader2, AlertCircle } from "lucide-react";
import { AnalyticsHeader } from "./components/AnalyticsHeader";
import { AnalyticsFilters } from "./components/AnalyticsFilters";
import { AnalyticsSummaryCards } from "./components/AnalyticsSummaryCards";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { AnalyticsJobTable } from "./components/AnalyticsJobTable";
import { AnalyticsJobModal } from "./components/AnalyticsJobModal";

export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilter>({
    dateRange: '1w',
    sourceName: '',
    companyName: '',
    page: 1,
    limit: 10
  });

  const [filterOptions, setFilterOptions] = useState<{ sources: string[], companies: string[] }>({ sources: [], companies: [] });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchFilterOptions(filters.sourceName, filters.companyName).then(options => {
      setFilterOptions(options);
      if (filters.companyName && !filters.sourceName && options.sources.length === 1) {
        setFilters(prev => ({ ...prev, sourceName: options.sources[0] }));
      }
    }).catch(() => { });
  }, [filters.sourceName, filters.companyName]);

  const { data, isLoading, isFetching, error } = useAnalytics(filters);

  const handleFilterChange = (key: keyof AnalyticsFilter, value: string | number) => {
    if (key === 'page') {
      setFilters(prev => ({ ...prev, page: value as number }));
    } else {
      setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <AnalyticsHeader />

      <AnalyticsFilters 
        filters={filters} 
        filterOptions={filterOptions} 
        onFilterChange={handleFilterChange} 
      />

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-muted-foreground">Loading analytics data...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-destructive/30 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <h3 className="text-lg font-bold text-destructive">Failed to load analytics</h3>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          <AnalyticsSummaryCards summary={data.summary} />
          <AnalyticsCharts data={data} />
          <div className={`transition-opacity duration-200 ${isFetching && !isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <AnalyticsJobTable 
              jobsList={data.jobsList} 
              pagination={data.pagination}
              onPageChange={(page) => handleFilterChange('page', page)}
              onSelectJob={setSelectedJob} 
            />
          </div>
        </>
      )}

      {selectedJob && (
        <AnalyticsJobModal
          job={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </section>
  );
}
