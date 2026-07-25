import { Combobox } from "@/components/ui/combobox";
import { Calendar, Filter, Search } from "lucide-react";
import type { AnalyticsFilter } from "@/api/queries";

interface AnalyticsFiltersProps {
  filters: AnalyticsFilter;
  filterOptions: { sources: string[]; companies: string[] };
  onFilterChange: (key: keyof AnalyticsFilter, value: string | number) => void;
}

export function AnalyticsFilters({ filters, filterOptions, onFilterChange }: AnalyticsFiltersProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card p-5 rounded-2xl border border-border shadow-xs">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Date Range
        </label>
        <Combobox
          options={[
            { value: 'today', label: 'Today' },
            { value: '1d', label: 'Yesterday' },
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
          onChange={(val) => onFilterChange('dateRange', val || 'all')}
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
          onChange={(val) => onFilterChange('sourceName', val)}
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
          onChange={(val) => onFilterChange('companyName', val)}
          placeholder="All Companies"
        />
      </div>
    </div>
  );
}
