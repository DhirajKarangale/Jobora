import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Building2, Eye } from "lucide-react";
import type { Job } from "@/types";

interface AnalyticsJobTableProps {
  jobsList: any[];
  onSelectJob: (job: Job) => void;
}

export function AnalyticsJobTable({ jobsList, onSelectJob }: AnalyticsJobTableProps) {
  return (
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
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobsList.map((job) => (
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
                  <div className="flex items-center gap-2 max-w-[200px]">
                    <span className="truncate font-medium" title={job.role || ''}>
                      {job.role || '-'}
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
                    onClick={() => onSelectJob(job)}
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    View Details
                  </Button>
                </td>
              </tr>
            ))}
            {jobsList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  No jobs found matching the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
