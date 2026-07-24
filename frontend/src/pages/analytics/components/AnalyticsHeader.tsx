import { BarChart } from "lucide-react";

export function AnalyticsHeader() {
  return (
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
  );
}
