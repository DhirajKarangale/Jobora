import { useState, useEffect } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { AnalyticsFilter, Job } from "@/lib/api";
import { fetchFilterOptions } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Briefcase, CheckCircle2, Send, Search, Calendar, Filter, Loader2, AlertCircle, Eye, Building2, Globe } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { AnalyticsJobModal } from "@/components/jobs/AnalyticsJobModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const STATUS_COLORS = ['#3b82f6', '#10b981', '#ef4444']; // Active, Applied, Expired

export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilter>({
    dateRange: '1w',
    sourceName: '',
    companyName: ''
  });

  const [filterOptions, setFilterOptions] = useState<{ sources: string[], companies: string[] }>({ sources: [], companies: [] });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchFilterOptions(filters.sourceName, filters.companyName).then(options => {
      setFilterOptions(options);
      // Auto-update source if we selected a company and it only has one source
      if (filters.companyName && !filters.sourceName && options.sources.length === 1) {
        setFilters(prev => ({ ...prev, sourceName: options.sources[0] }));
      }
    }).catch(() => { });
  }, [filters.sourceName, filters.companyName]);

  const { data, isLoading, error } = useAnalytics(filters);

  const handleFilterChange = (key: keyof AnalyticsFilter, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-md shadow-xs">
        <div className="space-y-1 text-left w-full">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center justify-start gap-2">
            <BarChart className="w-6 h-6 text-indigo-500 shrink-0" />
            Analytics Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground ml-8">
            Monitor job scraping metrics and your application progress over time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card p-5 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-col gap-2">
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

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Filter className="w-4 h-4" /> Source Name
          </label>
          <Combobox
            options={filterOptions.sources}
            value={filters.sourceName || ''}
            onChange={(val) => handleFilterChange('sourceName', val)}
            placeholder="All Sources"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Search className="w-4 h-4" /> Company Name
          </label>
          <Combobox
            options={filterOptions.companies}
            value={filters.companyName || ''}
            onChange={(val) => handleFilterChange('companyName', val)}
            placeholder="All Companies"
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
                <p className="text-sm font-semibold text-muted-foreground">Open Jobs</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Total Scraped vs Eligible Trends</h3>
                <p className="text-xs text-muted-foreground">Daily counts of all scraped jobs and eligible matches</p>
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
                        return `${date.getMonth() + 1}/${date.getDate()}`;
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

            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Top 10 Hiring Companies</h3>
                <p className="text-xs text-muted-foreground">Companies with the most jobs from your scrape</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.jobsByCompany} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      stroke="currentColor"
                      opacity={0.5}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                      labelStyle={{ fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '8px' }}
                      cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                    />
                    <Bar dataKey="count" name="Jobs" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {data.jobsByCompany.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Jobs by Source</h3>
                <p className="text-xs text-muted-foreground">Distribution of scraped jobs across portals</p>
              </div>
              <div className="h-72 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.jobsBySource}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {data.jobsBySource.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Job Status Breakdown</h3>
                <p className="text-xs text-muted-foreground">Overview of Active, Applied, and Expired jobs</p>
              </div>
              <div className="h-72 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden mt-6">
            <div className="p-5 sm:p-6 border-b border-border space-y-1">
              <h3 className="text-lg font-bold">Filtered Jobs</h3>
              <p className="text-xs text-muted-foreground">List of up to 100 recent jobs matching your current filters</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Added Date</th>
                    <th className="px-6 py-4 font-semibold">Source</th>
                    <th className="px-6 py-4 font-semibold">Company</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.jobsList.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {job.addedDate ? new Date(job.addedDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-indigo-500" />
                          <span className="font-medium">{job.sourceName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="truncate font-medium" title={job.companyName || ''}>
                            {job.companyName || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {job.isApplied ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Applied</Badge>
                        ) : !job.isEligible ? (
                          <Badge variant="secondary" className="bg-slate-500/10 text-slate-600 border-slate-500/20">Not Eligible</Badge>
                        ) : job.isExpired ? (
                          <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20">Expired</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Active</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                          onClick={() => setSelectedJob(job)}
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data.jobsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        No jobs found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
