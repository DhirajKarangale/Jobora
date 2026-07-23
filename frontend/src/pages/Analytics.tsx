import { useState, useEffect } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { AnalyticsFilter } from "@/lib/api";
import { fetchFilterOptions } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Briefcase, CheckCircle2, Send, Search, Calendar, Filter, Loader2, AlertCircle } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilter>({
    dateRange: '1w',
    sourceName: '',
    companyName: ''
  });

  const [filterOptions, setFilterOptions] = useState<{ sources: string[], companies: string[] }>({ sources: [], companies: [] });
  
  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions).catch(console.error);
  }, []);

  const { data, isLoading, error } = useAnalytics(filters);

  const handleFilterChange = (key: keyof AnalyticsFilter, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-md shadow-xs">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center justify-center sm:justify-start gap-2">
            <BarChart className="w-6 h-6 text-indigo-500" />
            Analytics Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monitor job scraping metrics and your application progress over time.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card p-5 rounded-2xl border border-border shadow-xs">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Date Range
          </label>
          <Combobox 
            options={[
              { value: '1d', label: 'Last Day' },
              { value: '2d', label: 'Last 2 Days' },
              { value: '3d', label: 'Last 3 Days' },
              { value: '1w', label: 'Last Week' },
              { value: '2w', label: 'Last 2 Weeks' },
              { value: '1m', label: 'Last Month' },
              { value: '2m', label: 'Last 2 Months' },
              { value: '3m', label: 'Last 3 Months' },
              { value: '6m', label: 'Last 6 Months' },
              { value: '1y', label: 'Last 1 Year' },
              { value: '1.5y', label: 'Last 1.5 Years' },
              { value: 'all', label: 'All Time' }
            ]}
            value={filters.dateRange || '1w'}
            onChange={(val) => handleFilterChange('dateRange', val || 'all')}
            placeholder="Select Date Range"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Filter className="w-4 h-4" /> Source Name
          </label>
          <Combobox 
            options={filterOptions.sources} 
            value={filters.sourceName || ''} 
            onChange={(val) => handleFilterChange('sourceName', val)}
            placeholder="e.g. LinkedIn"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Search className="w-4 h-4" /> Company Name
          </label>
          <Combobox 
            options={filterOptions.companies} 
            value={filters.companyName || ''} 
            onChange={(val) => handleFilterChange('companyName', val)}
            placeholder="e.g. Google"
          />
        </div>
      </div>

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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Total Jobs Scraped</p>
                <p className="text-3xl font-black">{data.summary.totalJobs.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Eligible Jobs</p>
                <p className="text-3xl font-black">{data.summary.eligibleJobs.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Jobs Applied</p>
                <p className="text-3xl font-black">{data.summary.appliedJobs.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Chart (Line) */}
            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Volume Trends</h3>
                <p className="text-xs text-muted-foreground">Daily counts of scraped and eligible jobs</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        return `${date.getMonth()+1}/${date.getDate()}`;
                      }}
                      stroke="currentColor" 
                      opacity={0.5} 
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                      labelStyle={{ fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '8px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="totalJobs" name="Total Scraped" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="eligibleJobs" name="Eligible Matches" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Application Chart (Bar) */}
            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Application Activity</h3>
                <p className="text-xs text-muted-foreground">Daily count of jobs applied to</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        return `${date.getMonth()+1}/${date.getDate()}`;
                      }}
                      stroke="currentColor" 
                      opacity={0.5} 
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                      labelStyle={{ fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '8px' }}
                      cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="appliedJobs" name="Jobs Applied" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
