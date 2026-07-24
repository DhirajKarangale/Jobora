
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
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
    { name: 'Eligible', count: summary.eligibleJobs + summary.appliedJobs }, // Total eligible includes applied
    { name: 'Applied', count: summary.appliedJobs },
    { name: 'Expired', count: data.statusBreakdown.find(s => s.name === 'Expired')?.value || 0 }
  ];

  const appBreakdownData = [
    { name: 'Auto Applied', value: summary.autoAppliedJobs },
    { name: 'Manual Applied', value: summary.manualAppliedJobs }
  ].filter(item => item.value > 0); // Only show if there's data

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Job Pipeline */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0 lg:col-span-2">
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
                  <Cell fill="#f97316" /> {/* Auto Applied Orange */}
                  <Cell fill="#ec4899" /> {/* Manual Applied Pink */}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-sm">No applications yet</div>
          )}
        </div>
      </div>

      {/* Daily Processing Trend */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-6 min-w-0">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Daily Processing Trend</h3>
          <p className="text-xs text-muted-foreground">Jobs scraped, eligible, and applied over time</p>
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
                  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
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
              <Line type="monotone" dataKey="totalJobs" name="Total Scraped" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="eligibleJobs" name="Eligible" stroke="#10b981" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="appliedJobs" name="Applied" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
