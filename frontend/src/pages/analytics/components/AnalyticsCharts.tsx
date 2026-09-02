import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import type { AnalyticsData } from "@/api/queries";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface AnalyticsChartsProps {
  data: AnalyticsData;
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const { summary } = data;

  const pipelineData = [
    { name: 'Total Found', count: summary.totalJobs },
    { name: 'Not Checked', count: summary.pendingAiJobs },
    { name: 'Not Eligible', count: summary.notEligibleJobs },
    { name: 'Eligible', count: summary.eligibleJobs + summary.appliedJobs }, // Total eligible includes applied
    { name: 'Applied', count: summary.appliedJobs },
    { name: 'Expired', count: data.statusBreakdown.find(s => s.name === 'Expired')?.value || 0 }
  ];

  const appBreakdownData = [
    { name: 'Auto Applied', value: summary.autoAppliedJobs },
    { name: 'Manual Applied', value: summary.manualAppliedJobs }
  ].filter(item => item.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Job Pipeline */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Job Pipeline</h3>
          <p className="text-xs text-muted-foreground">Comprehensive overview of all jobs through the system</p>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipelineData} margin={{ top: 20, right: 20, bottom: 25, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                labelStyle={{ fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '8px' }}
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              />
              <Bar dataKey="count" name="Jobs" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60} label={{ position: 'top', fill: 'var(--foreground)', fontSize: 12, fontWeight: 'bold' }}>
                {pipelineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actionable Jobs by Portal */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Actionable Jobs by Portal</h3>
          <p className="text-xs text-muted-foreground">Pending applications vs Successfully applied per platform</p>
        </div>
        <div className="h-80 w-full">
          {data.actionableJobsBySource.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.actionableJobsBySource} margin={{ top: 20, right: 20, bottom: 25, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const totalApplied = (data.manualApplied || 0) + (data.autoApplied || 0);
                      const sortedPayload = [...payload].sort((a, b) => {
                        const getRank = (name: any) => {
                          if (name === 'Manual Applied') return 1;
                          if (name === 'Auto Applied') return 2;
                          return 3;
                        };
                        return getRank(a.name) - getRank(b.name);
                      });

                      return (
                        <div className="p-3 border rounded-xl shadow-sm text-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                          <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>{label}</p>
                          {sortedPayload.map((entry: any, index: number) => (
                            <p key={`item-${index}`} style={{ color: entry.color }} className="mb-1.5">
                              {entry.name} : {entry.value}
                            </p>
                          ))}
                          <div className="mt-2 pt-2 font-semibold" style={{ color: 'var(--foreground)', borderTop: '1px solid var(--border)' }}>
                            Total Applied : {totalApplied}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  {...({
                    payload: [
                      { value: 'Manual Applied', type: 'circle', id: 'manualApplied', color: '#3b82f6' },
                      { value: 'Auto Applied', type: 'circle', id: 'autoApplied', color: '#10b981' },
                      { value: 'To Apply (Open)', type: 'circle', id: 'toApply', color: '#f59e0b' }
                    ]
                  } as any)}
                />
                <Bar dataKey="toApply" name="To Apply (Open)" stackId="a" fill="#f59e0b" maxBarSize={60} />
                <Bar dataKey="autoApplied" name="Auto Applied" stackId="a" fill="#10b981" maxBarSize={60} />
                <Bar dataKey="manualApplied" name="Manual Applied" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-sm flex items-center justify-center h-full">No actionable jobs yet</div>
          )}
        </div>
      </div>

      {/* Daily Processing Trend (Area Chart) */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0 lg:col-span-2">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Daily Activity Trend</h3>
          <p className="text-xs text-muted-foreground">Jobs scraped and applications sent over time</p>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEligible" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(val) => {
                  const date = new Date(val);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
              <Area type="monotone" dataKey="totalJobs" name="Scraped" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorTotal)" />
              <Area type="monotone" dataKey="eligibleJobs" name="Eligible" stroke="#10b981" fillOpacity={1} fill="url(#colorEligible)" />
              <Area type="monotone" dataKey="appliedJobs" name="Applied" stroke="#3b82f6" fillOpacity={1} fill="url(#colorApplied)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Application Breakdown */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Application Breakdown</h3>
          <p className="text-xs text-muted-foreground">Total Applied: {summary.appliedJobs.toLocaleString()}</p>
        </div>
        <div className="h-72 w-full flex items-center justify-center">
          {appBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={appBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : null}
                  labelLine={false}
                >
                  <Cell fill="#10b981" /> {/* Auto Applied Green */}
                  <Cell fill="#3b82f6" /> {/* Manual Applied Blue */}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-sm flex items-center justify-center h-full">No applications yet</div>
          )}
        </div>
      </div>

      {/* Top 10 Matching Companies */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Top 10 Matching Companies</h3>
          <p className="text-xs text-muted-foreground">Companies with the most eligible/applied jobs</p>
        </div>
        <div className="h-72 w-full">
          {data.topCompanies.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topCompanies} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  opacity={0.5}
                  width={120}
                  tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                  labelStyle={{ fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '8px' }}
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                />
                <Bar dataKey="count" name="Actionable Jobs" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-sm flex items-center justify-center h-full">No companies matched</div>
          )}
        </div>
      </div>

    </div>
  );
}
