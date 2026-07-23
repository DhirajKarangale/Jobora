import { Link, useLocation } from "react-router-dom";
import { Briefcase, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: "Eligible Opportunities", path: "/", icon: Briefcase },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
  ];

  return (
    <aside className="w-64 border-r border-border/40 bg-background/80 backdrop-blur-xl flex-shrink-0 flex flex-col h-full z-40 hidden md:flex shadow-sm">
      <div className="h-[73px] px-6 border-b border-border/40 flex items-center gap-3 shrink-0">
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
      
      <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
    </aside>
  );
}
