import { Link, useLocation } from "react-router-dom";
import { Briefcase, BarChart3, Settings, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: "Job Finder", path: "/", icon: Bot },
    { name: "Eligible Opportunities", path: "/eligible", icon: Briefcase },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
  ];

  return (
    <aside className="w-full md:w-64 border-t md:border-t-0 md:border-r border-border/40 bg-background/80 backdrop-blur-xl flex-shrink-0 flex md:flex-col h-auto md:h-full z-40 shadow-sm order-last md:order-first">
      <div className="hidden md:flex h-[73px] px-6 border-b border-border/40 items-center gap-3 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-extrabold text-xl tracking-wider shrink-0">
          J
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
            JOBORA
          </h1>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest leading-none mt-0.5">Workspace</p>
        </div>
      </div>
      
      <nav className="p-1.5 md:p-4 flex flex-row md:flex-col justify-around md:justify-start overflow-x-auto md:overflow-y-auto space-x-1 md:space-x-0 md:space-y-1.5 w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col md:flex-row items-center gap-1 md:gap-3 px-1 md:px-3 py-1.5 md:py-2.5 rounded-lg text-[10px] md:text-sm font-medium transition-all duration-200 group flex-1 md:flex-none justify-center md:justify-start text-center md:text-left",
                isActive 
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className="w-full whitespace-nowrap overflow-hidden text-ellipsis leading-tight">{item.name}</span>
            </Link>
          )
        })}
      </nav>
      
    </aside>
  );
}
