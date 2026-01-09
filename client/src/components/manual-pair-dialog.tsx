import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StandardizedMarket {
  id: string;
  platform: "Kalshi" | "Polymarket" | "PredictIt";
  title: string;
  yesPrice: number;
  noPrice: number;
  marketUrl?: string;
}

interface ManualPairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceMarket: StandardizedMarket;
  availableMarkets: StandardizedMarket[];
  onPair: (marketA: StandardizedMarket, marketB: StandardizedMarket) => void;
}

const platformColors: Record<string, string> = {
  Kalshi: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Polymarket: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  PredictIt: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export function ManualPairDialog({
  open,
  onOpenChange,
  sourceMarket,
  availableMarkets,
  onPair
}: ManualPairDialogProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Filter markets from different platforms
  const eligibleMarkets = availableMarkets.filter(m => 
    m.platform !== sourceMarket.platform &&
    m.id !== sourceMarket.id &&
    (searchQuery === "" || m.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedMarket = eligibleMarkets.find(m => m.id === selectedMarketId);

  const handlePair = () => {
    if (!selectedMarket) {
      toast({ 
        title: "No market selected", 
        description: "Please select a market to pair with",
        variant: "destructive" 
      });
      return;
    }

    onPair(sourceMarket, selectedMarket);
    onOpenChange(false);
    
    toast({
      title: "Markets paired!",
      description: `${sourceMarket.platform} + ${selectedMarket.platform} added to watchlist`
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Manual Market Pairing
          </DialogTitle>
          <DialogDescription>
            Override the algorithm and manually pair this market with another
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Market */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <Label className="text-xs text-muted-foreground mb-2 block">Pairing from:</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={platformColors[sourceMarket.platform]}>
                  {sourceMarket.platform}
                </Badge>
                <span className="text-sm font-medium">{sourceMarket.title}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono">YES: {(sourceMarket.yesPrice * 100).toFixed(0)}c</span>
                <span className="text-muted-foreground">NO: {(sourceMarket.noPrice * 100).toFixed(0)}c</span>
              </div>
            </div>
          </div>

          {/* Search and Select */}
          <div className="space-y-2">
            <Label htmlFor="search-pair">Search for market to pair with:</Label>
            <Input
              id="search-pair"
              placeholder="Search markets on other platforms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Market Selection */}
          <div className="space-y-2">
            <Label htmlFor="market-select">
              Select market ({eligibleMarkets.length} available from other platforms)
            </Label>
            <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
              <SelectTrigger id="market-select">
                <SelectValue placeholder="Choose a market to pair with..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {eligibleMarkets.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No markets found. Try a different search.
                  </div>
                ) : (
                  eligibleMarkets.map((market) => (
                    <SelectItem key={market.id} value={market.id}>
                      <div className="flex items-center gap-2 py-1">
                        <Badge className={platformColors[market.platform]} variant="outline">
                          {market.platform}
                        </Badge>
                        <span className="text-sm truncate max-w-[400px]">{market.title}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Market Preview */}
          {selectedMarket && (
            <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
              <Label className="text-xs text-muted-foreground mb-2 block">Will pair with:</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={platformColors[selectedMarket.platform]}>
                    {selectedMarket.platform}
                  </Badge>
                  <span className="text-sm font-medium">{selectedMarket.title}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono">YES: {(selectedMarket.yesPrice * 100).toFixed(0)}c</span>
                  <span className="text-muted-foreground">NO: {(selectedMarket.noPrice * 100).toFixed(0)}c</span>
                </div>
              </div>
            </div>
          )}

          {/* ROI Preview */}
          {selectedMarket && (
            <div className="p-3 rounded-md bg-muted/30 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated ROI:</span>
                <span className="font-mono font-bold">
                  {(() => {
                    const cost1 = sourceMarket.yesPrice + selectedMarket.noPrice;
                    const cost2 = sourceMarket.noPrice + selectedMarket.yesPrice;
                    const bestCost = Math.min(cost1, cost2);
                    const roi = bestCost < 1 ? ((1 - bestCost) / bestCost * 100) : 0;
                    return roi > 0 
                      ? `+${roi.toFixed(2)}%`
                      : "No arbitrage";
                  })()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Note: This is a manual override. The algorithm did not match these markets automatically.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePair}
              disabled={!selectedMarket}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Watchlist
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}