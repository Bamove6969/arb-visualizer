import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertArbitrageHistorySchema, insertWatchlistSchema, insertAlertSchema } from "@shared/schema";
import { 
  fetchKalshiMarkets, 
  fetchPolymarketMarkets, 
  fetchPredictItMarkets, 
  fetchAllMarkets,
  findArbitrageOpportunities,
  getMarketStats,
  isCacheStale
} from "./market-api";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/arbitrage-history", async (req, res) => {
    try {
      const history = await storage.getArbitrageHistory();
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.post("/api/arbitrage-history", async (req, res) => {
    try {
      const parsed = insertArbitrageHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const entry = await storage.createArbitrageHistory(parsed.data);
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to save history" });
    }
  });

  app.delete("/api/arbitrage-history/:id", async (req, res) => {
    try {
      await storage.deleteArbitrageHistory(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  app.delete("/api/arbitrage-history", async (req, res) => {
    try {
      await storage.clearArbitrageHistory();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to clear history" });
    }
  });

  // Watchlist routes
  app.get("/api/watchlist", async (req, res) => {
    try {
      const items = await storage.getWatchlist();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const parsed = insertWatchlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const item = await storage.createWatchlistItem(parsed.data);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.patch("/api/watchlist/:id", async (req, res) => {
    try {
      const updated = await storage.updateWatchlistItem(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update watchlist item" });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      await storage.deleteWatchlistItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete watchlist item" });
    }
  });

  // Alerts routes
  app.get("/api/alerts", async (req, res) => {
    try {
      const alertList = await storage.getAlerts();
      res.json(alertList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const parsed = insertAlertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const alert = await storage.createAlert(parsed.data);
      res.status(201).json(alert);
    } catch (error) {
      res.status(500).json({ message: "Failed to create alert" });
    }
  });

  app.patch("/api/alerts/:id/read", async (req, res) => {
    try {
      await storage.markAlertRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to mark alert as read" });
    }
  });

  app.delete("/api/alerts", async (req, res) => {
    try {
      await storage.clearAlerts();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to clear alerts" });
    }
  });

  // Market data API routes
  app.get("/api/markets", async (req, res) => {
    try {
      const query = req.query.q as string | undefined;
      const platform = req.query.platform as string | undefined;
      
      let markets;
      if (platform === "kalshi") {
        markets = await fetchKalshiMarkets(query);
      } else if (platform === "polymarket") {
        markets = await fetchPolymarketMarkets(query);
      } else if (platform === "predictit") {
        markets = await fetchPredictItMarkets(query);
      } else {
        markets = await fetchAllMarkets(query);
      }
      
      res.json(markets);
    } catch (error) {
      console.error("Failed to fetch markets:", error);
      res.status(500).json({ message: "Failed to fetch markets" });
    }
  });

  app.get("/api/arbitrage-opportunities", async (req, res) => {
    try {
      const query = req.query.q as string | undefined;
      const minRoi = parseFloat(req.query.minRoi as string) || 0;
      const forceRefresh = req.query.refresh === "true";
      
      const markets = await fetchAllMarkets(query, forceRefresh);
      const opportunities = findArbitrageOpportunities(markets, minRoi);
      
      res.json(opportunities);
    } catch (error) {
      console.error("Failed to find arbitrage opportunities:", error);
      res.status(500).json({ message: "Failed to find arbitrage opportunities" });
    }
  });

  // Market statistics endpoint
  app.get("/api/market-stats", async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      
      // If cache is stale or force refresh, fetch new data first
      if (forceRefresh || isCacheStale()) {
        await fetchAllMarkets(undefined, forceRefresh);
      }
      
      const stats = getMarketStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get market stats:", error);
      res.status(500).json({ message: "Failed to get market stats" });
    }
  });

  return httpServer;
}
