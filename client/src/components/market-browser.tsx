import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, TrendingUp, Loader2, RefreshCw, DollarSign, Plus, Clock, Columns2, WifiOff, Link2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { openInSplitScreen, supportsSplitScreen } from "@/lib/utils";
import { ManualPairDialog } from "./manual-pair-dialog";

interface StandardizedMarket {
  id: string;
  platform: "Kalshi" | "Polymarket" | "PredictIt";
  title: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  lastUpdated: string;
  marketUrl?: string;
}

interface ArbitrageOpportunity {
  marketA: StandardizedMarket;
  marketB: StandardizedMarket;
  combinedYesCost: number;
  potentialProfit: number;
  roi: number;
  matchScore: number;
  matchReason: string;
}

interface MarketStats {
  kalshi: number;
  polymarket: number;
  predictit: number;
  total: number;
  lastUpdated: string;
}

const platformColors: Record<string, string> = {
  Kalshi: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Polymarket: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  PredictIt: "bg-green-500/10 text-green-700 dark:text-green-400",
};

interface MarketBrowserProps {
  autoRefresh?: boolean;
  refreshInterval?: string;
  enabledPlatforms?: string[];
  onScanComplete?: () => void;
}

export function MarketBrowser({ 
  autoRefresh = false, 
  refreshInterval = "5",
  enabledPlatforms = ["Kalshi", "Polymarket", "PredictIt"],
  onScanComplete
}: MarketBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("opportunities");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pairDialogOpen, setPairDialogOpen] = useState(false);
  const [selectedMarketForPairing, setSelectedMarketForPairing] = useState<StandardizedMarket | null>(null);
  const { toast } = useToast();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({ title: "Back online", description: "Connection restored" });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast({ 
        title: "Offline", 
        description: "Showing cached data. Some features may be limited.",
        variant: "destructive"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Fetch market stats
  const { data: stats } = useQuery<MarketStats>({
    queryKey: ["/api/market-stats"],
    queryFn: async () => {
      const res = await fetch("/api/market-stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: markets = [], isLoading: marketsLoading, refetch: refetchMarkets } = useQuery<StandardizedMarket[]>({
    queryKey: ["/api/markets", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/markets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "all",
    staleTime: 30000,
  });

  const { data: opportunities = [], isLoading: oppsLoading, refetch: refetchOpps } = useQuery<ArbitrageOpportunity[]>({
    queryKey: ["/api/arbitrage-opportunities", searchQuery, enabledPlatforms],
    queryFn: async () => {
      setIsScanning(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("minRoi", "0");
      params.set("refresh", "true");
      params.set("platforms", enabledPlatforms.join(","));
      const res = await fetch(`/api/arbitrage-opportunities?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setLastRefresh(new Date());
      setIsScanning(false);
      queryClient.invalidateQueries({ queryKey: ["/api/market-stats"] });
      onScanComplete?.();
      return res.json();
    },
    enabled: activeTab === "opportunities",
    staleTime: 60000,
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (opp: ArbitrageOpportunity) => {
      // Store raw YES prices from both markets
      // The watchlist ROI calculator evaluates both scenarios:
      // 1) Buy YES on A + Buy NO on B (uses siteAYesPrice + (1 - siteBYesPrice))
      // 2) Buy NO on A + Buy YES on B (uses (1 - siteAYesPrice) + siteBYesPrice)
      // This matches how the opportunity was detected
      return apiRequest("POST", "/api/watchlist", {
        marketName: `${opp.matchReason || "arbitrage"}: ${opp.marketA.title.slice(0, 30)}`,
        siteAName: opp.marketA.platform,
        siteBName: opp.marketB.platform,
        siteAYesPrice: opp.marketA.yesPrice,
        siteBYesPrice: opp.marketB.yesPrice,
        investment: 500,
        alertThreshold: 3,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Added to watchlist", description: "Market pair added for monitoring" });
    },
    onError: () => {
      toast({ title: "Failed to add", description: "Could not add to watchlist", variant: "destructive" });
    },
  });

  const handleManualPair = (marketA: StandardizedMarket, marketB: StandardizedMarket) => {
    // Add manually paired markets to watchlist with special indicator
    addToWatchlistMutation.mutate({
      marketA,
      marketB,
      combinedYesCost: 0, // Will be calculated
      potentialProfit: 0,
      roi: 0,
      matchScore: 100, // Manual pairs get perfect score
      matchReason: "manual pairing"
    } as ArbitrageOpportunity);
  };

  const openPairDialog = (market: StandardizedMarket) => {
    setSelectedMarketForPairing(market);
    setPairDialogOpen(true);
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || activeTab !== "opportunities") return;
    
    const intervalMs = parseInt(refreshInterval) * 60 * 1000;
    const timer = setInterval(() => {
      refetchOpps();
    }, intervalMs);
    
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, activeTab, refetchOpps]);

  const handleRefresh = () => {
    if (activeTab === "all") {
      refetchMarkets();
    } else {
      refetchOpps();
    }
  };

  const isLoading = activeTab === "all" ? marketsLoading : oppsLoading;

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Live Market Browser
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              data-testid="button-refresh-markets"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
            data-testid="input-market-search"
          />
        </div>

        {stats && stats.total > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-md border bg-muted/30 flex-wrap">
            <span className="text-sm font-medium">Live Markets:</span>
            <Badge className={platformColors.Kalshi}>
              Kalshi: {stats.kalshi.toLocaleString()}
            </Badge>
            <Badge className={platformColors.Polymarket}>
              Polymarket: {stats.polymarket.toLocaleString()}
            </Badge>
            <Badge className={platformColors.PredictIt}>
              PredictIt: {stats.predictit.toLocaleString()}
            </Badge>
            <span className="text-sm text-muted-foreground ml-auto">
              Total: {stats.total.toLocaleString()} markets
            </span>
          </div>
        )}

        {isOffline && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/50 bg-amber-500/10">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Offline - Showing cached data
            </span>
            <Badge variant="outline" className="ml-auto text-xs">
              Limited features
            </Badge>
          </div>
        )}

        {(autoRefresh || isScanning) && (
          <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
            <Badge variant="secondary" className={isScanning ? "animate-pulse" : ""}>
              {isScanning ? "Scanning all markets..." : "Auto-scan active"}
            </Badge>
            {!isScanning && lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Every {refreshInterval} min
              </span>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="opportunities" className="flex-1" data-testid="tab-opportunities">
              <TrendingUp className="w-4 h-4 mr-2" />
              Arbitrage Opportunities ({opportunities.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1" data-testid="tab-all-markets">
              <DollarSign className="w-4 h-4 mr-2" />
              All Markets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="mt-4">
            {oppsLoading || isScanning ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground font-medium">
                  Scanning {stats?.total ? stats.total.toLocaleString() : "all"} markets across 3 platforms...
                </span>
                <span className="text-sm text-muted-foreground">This may take 30-60 seconds for a full scan</span>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <p>No matching markets found across platforms.</p>
                <p className="text-sm">True arbitrage requires the SAME question on different platforms with different prices.</p>
                <p className="text-sm">Most platforms offer different market questions, so cross-platform matches are rare.</p>
                <p className="text-sm mt-4">Tip: Use the "All Markets" tab to browse individual markets, then manually add pairs to your watchlist.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] md:h-[500px]">
                <div className="space-y-4 pr-4">
                  {opportunities.map((opp, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 md:p-5 rounded-lg border ${opp.roi >= 3 ? "border-green-500/50 bg-green-500/5" : ""} touch-manipulation`}
                      data-testid={`card-opportunity-${idx}`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{opp.matchReason || "matched"}</Badge>
                            {opp.matchScore >= 80 ? (
                              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">High confidence</Badge>
                            ) : opp.matchScore >= 60 ? (
                              <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">Medium confidence</Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-xs">Verify manually</Badge>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <Badge className={platformColors[opp.marketA.platform]}>
                                {opp.marketA.platform}
                              </Badge>
                              <span className="text-sm leading-relaxed">{opp.marketA.title}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-mono font-bold text-base">{(opp.marketA.yesPrice * 100).toFixed(0)}c YES</span>
                              {opp.marketA.marketUrl && (
                                <a 
                                  href={opp.marketA.marketUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 md:py-0"
                                  data-testid={`link-market-a-${idx}`}
                                >
                                  View →
                                </a>
                              )}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
                              <Badge className={platformColors[opp.marketB.platform]}>
                                {opp.marketB.platform}
                              </Badge>
                              <span className="text-sm leading-relaxed">{opp.marketB.title}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-mono font-bold text-base">{(opp.marketB.noPrice * 100).toFixed(0)}c NO</span>
                              {opp.marketB.marketUrl && (
                                <a 
                                  href={opp.marketB.marketUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 md:py-0"
                                  data-testid={`link-market-b-${idx}`}
                                >
                                  View →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
                          <div className="space-y-1">
                            <p className={`text-2xl sm:text-xl font-bold ${opp.roi >= 3 ? "text-green-600 dark:text-green-400" : opp.roi > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                              {opp.roi.toFixed(2)}% ROI
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Cost: {(opp.combinedYesCost * 100).toFixed(0)}c
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            {opp.marketA.marketUrl && opp.marketB.marketUrl && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  openInSplitScreen(
                                    opp.marketA.marketUrl!,
                                    opp.marketB.marketUrl!,
                                    {
                                      titleA: opp.marketA.title,
                                      titleB: opp.marketB.title
                                    }
                                  );
                                }}
                                className="w-full"
                                data-testid={`button-open-both-${idx}`}
                              >
                                <Columns2 className="w-4 h-4 mr-1" />
                                {supportsSplitScreen() ? 'Open Split Screen' : 'Open Both'}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addToWatchlistMutation.mutate(opp)}
                              disabled={addToWatchlistMutation.isPending}
                              data-testid={`button-add-opp-${idx}`}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Watch
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {marketsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading markets...</span>
              </div>
            ) : markets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No markets found. Try a different search.
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {markets.map((market) => (
                    <div 
                      key={market.id} 
                      className="p-3 rounded-md border hover-elevate space-y-2"
                      data-testid={`market-${market.id}`}
                    >
                      <p className="font-medium text-sm leading-snug">{market.title}</p>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={platformColors[market.platform]}>
                            {market.platform}
                          </Badge>
                          {market.category && (
                            <Badge variant="outline" className="text-xs">
                              {market.category}
                            </Badge>
                          )}
                          {market.marketUrl && (
                            <a 
                              href={market.marketUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              data-testid={`link-market-${market.id}`}
                            >
                              View on {market.platform} →
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-3 font-mono text-sm">
                            <span>
                              YES: <span className="font-bold text-green-600 dark:text-green-400">{(market.yesPrice * 100).toFixed(0)}c</span>
                            </span>
                            <span className="text-muted-foreground">
                              NO: <span className="font-bold">{(market.noPrice * 100).toFixed(0)}c</span>
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPairDialog(market)}
                            className="shrink-0"
                            data-testid={`button-pair-${market.id}`}
                          >
                            <Link2 className="w-3 h-3 mr-1" />
                            Pair
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    {/* Manual Pairing Dialog */}
    {selectedMarketForPairing && (
      <ManualPairDialog
        open={pairDialogOpen}
        onOpenChange={setPairDialogOpen}
        sourceMarket={selectedMarketForPairing}
        availableMarkets={markets}
        onPair={handleManualPair}
      />
    )}
    </>
  );
}
