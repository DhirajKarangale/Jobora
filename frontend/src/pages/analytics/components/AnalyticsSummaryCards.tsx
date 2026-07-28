import { Briefcase, CheckCircle2, XCircle, FileCheck } from "lucide-react";
import type { AnalyticsData } from "@/api/queries";

interface AnalyticsSummaryCardsProps {
  summary: AnalyticsData["summary"];
}

export function AnalyticsSummaryCards({ summary }: AnalyticsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
      
      {/* Open to Apply */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow h-32 select-none cursor-default">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground leading-tight">Open To<br/>Apply</p>
        </div>
        <p className="text-3xl font-black mt-2">{summary.eligibleJobs.toLocaleString()}</p>
      </div>

      {/* Total Applied */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow h-32 select-none cursor-default">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground leading-tight">Total<br/>Applied</p>
        </div>
        <p className="text-3xl font-black mt-2">{summary.appliedJobs.toLocaleString()}</p>
      </div>

      {/* Not Eligible */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow h-32 select-none cursor-default">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground leading-tight">Not<br/>Eligible</p>
        </div>
        <p className="text-3xl font-black mt-2">{summary.notEligibleJobs.toLocaleString()}</p>
      </div>

      {/* Total Found */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow h-32 select-none cursor-default">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground leading-tight">Total Jobs<br/>Found</p>
        </div>
        <p className="text-3xl font-black mt-2">{summary.totalJobs.toLocaleString()}</p>
      </div>
      
    </div>
  );
}
