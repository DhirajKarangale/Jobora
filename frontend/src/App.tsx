import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProcessHeader } from "@/components/ProcessHeader";
import { JobGrid } from "@/components/JobGrid";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo-500 selection:text-white flex flex-col relative overflow-x-hidden">
        
        {/* Background Decorative Ambient Gradients */}
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Process Monitor Header */}
        <ProcessHeader />

        {/* Main Content Area */}
        <main className="flex-1">
          <JobGrid />
        </main>

        {/* Sleek Footer */}
        <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground bg-background/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} JOBORA. All rights reserved.</span>
            <span className="font-semibold text-emerald-500 tracking-wider hover:text-emerald-400 transition-colors">
              by -DK-
            </span>
          </div>
        </footer>

      </div>
    </QueryClientProvider>
  );
}

export default App;
