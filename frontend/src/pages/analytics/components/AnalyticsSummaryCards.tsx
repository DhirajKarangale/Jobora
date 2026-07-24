import { Briefcase, CheckCircle2, Send, Bot, User } from "lucide-react";
import type { AnalyticsData } from "@/api/queries";

interface AnalyticsSummaryCardsProps {
  summary: AnalyticsData["summary"];
}

export function AnalyticsSummaryCards({ summary }: AnalyticsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
          <Briefcase className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Total Jobs Scraped</p>
          <p className="text-3xl font-black">{summary.totalJobs.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Open Jobs</p>
          <p className="text-3xl font-black">{summary.eligibleJobs.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
          <Send className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Jobs Applied</p>
          <p className="text-3xl font-black">{summary.appliedJobs.toLocaleString()}</p>
        </div>
      </div>
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Auto Applied</p>
          <p className="text-3xl font-black">{summary.autoAppliedJobs.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="h-12 w-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
          <User className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Manual Applied</p>
          <p className="text-3xl font-black">{summary.manualAppliedJobs.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
