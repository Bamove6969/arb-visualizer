import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavHeader } from "@/components/nav-header";
import NotFound from "@/pages/not-found";
import ArbitrageCalculator from "@/pages/arbitrage-calculator";
import HistoryPage from "@/pages/history";
import SentinelPage from "@/pages/sentinel";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ArbitrageCalculator} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/sentinel" component={SentinelPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <NavHeader />
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
