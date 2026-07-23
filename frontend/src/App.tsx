import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/header/Header";
import { JobGrid } from "@/components/jobs/JobGrid";
import { Footer } from "@/components/footer/Footer";
import { Analytics } from "@/pages/Analytics";
import { Sidebar } from "@/components/sidebar/Sidebar";

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
      <BrowserRouter>
        <div className="h-screen bg-background text-foreground font-sans selection:bg-indigo-500 selection:text-white flex flex-col md:flex-row overflow-hidden">
          <Sidebar />
          
          <div className="flex-1 flex flex-col min-w-0 relative h-auto md:h-full overflow-hidden md:overflow-visible">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

            <Header />

            <main className="flex-1 overflow-y-auto">
              <div className="min-h-full flex flex-col">
                <div className="flex-1">
                  <Routes>
                    <Route path="/" element={<JobGrid />} />
                    <Route path="/analytics" element={<Analytics />} />
                  </Routes>
                </div>
                <Footer />
              </div>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
