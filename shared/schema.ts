import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const arbitrageHistory = pgTable("arbitrage_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteAName: text("site_a_name").notNull(),
  siteBName: text("site_b_name").notNull(),
  siteAYesPrice: real("site_a_yes_price").notNull(),
  siteBYesPrice: real("site_b_yes_price").notNull(),
  investment: real("investment").notNull(),
  orderMode: text("order_mode").notNull(),
  isProfitable: boolean("is_profitable").notNull(),
  netProfit: real("net_profit").notNull(),
  netRoi: real("net_roi").notNull(),
  shares: real("shares").notNull(),
  scenario: text("scenario").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertArbitrageHistorySchema = createInsertSchema(arbitrageHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertArbitrageHistory = z.infer<typeof insertArbitrageHistorySchema>;
export type ArbitrageHistory = typeof arbitrageHistory.$inferSelect;

export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketName: text("market_name").notNull(),
  siteAName: text("site_a_name").notNull(),
  siteBName: text("site_b_name").notNull(),
  siteAYesPrice: real("site_a_yes_price").notNull(),
  siteBYesPrice: real("site_b_yes_price").notNull(),
  investment: real("investment").notNull(),
  alertThreshold: real("alert_threshold").notNull().default(3.0),
  isActive: boolean("is_active").notNull().default(true),
  lastChecked: timestamp("last_checked"),
  lastMakerRoi: real("last_maker_roi"),
  lastTakerRoi: real("last_taker_roi"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
  lastChecked: true,
  lastMakerRoi: true,
  lastTakerRoi: true,
});

export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlist.$inferSelect;

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  watchlistId: varchar("watchlist_id").notNull(),
  marketName: text("market_name").notNull(),
  makerRoi: real("maker_roi").notNull(),
  takerRoi: real("taker_roi").notNull(),
  siteAYesPrice: real("site_a_yes_price").notNull(),
  siteBYesPrice: real("site_b_yes_price").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;
