import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProcessHeader } from "@/components/header/ProcessHeader";
import { JobGrid } from "@/components/jobs/JobGrid";
import { Footer } from "@/components/footer/Footer";

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
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <ProcessHeader />

        <main className="flex-1">
          <JobGrid />
        </main>

        <Footer />
      </div>
    </QueryClientProvider>
  );
}

export default App;
