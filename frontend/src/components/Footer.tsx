import { Sparkles, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/70 backdrop-blur-xl relative z-10 py-4 sm:py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} JOBORA. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500/30 animate-pulse" />
            <span>by</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-500/30 font-bold text-indigo-600 dark:text-indigo-300 shadow-2xs hover:shadow-indigo-500/20 hover:scale-105 transition-all cursor-default">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              DK
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
