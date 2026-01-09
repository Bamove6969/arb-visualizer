import { users, arbitrageHistory, watchlist, alerts, type User, type InsertUser, type ArbitrageHistory, type InsertArbitrageHistory, type Watchlist, type InsertWatchlist, type Alert, type InsertAlert } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getArbitrageHistory(): Promise<ArbitrageHistory[]>;
  createArbitrageHistory(entry: InsertArbitrageHistory): Promise<ArbitrageHistory>;
  deleteArbitrageHistory(id: string): Promise<void>;
  clearArbitrageHistory(): Promise<void>;

  getWatchlist(): Promise<Watchlist[]>;
  createWatchlistItem(item: InsertWatchlist): Promise<Watchlist>;
  updateWatchlistItem(id: string, updates: Partial<Watchlist>): Promise<Watchlist | undefined>;
  deleteWatchlistItem(id: string): Promise<void>;

  getAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertRead(id: string): Promise<void>;
  clearAlerts(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getArbitrageHistory(): Promise<ArbitrageHistory[]> {
    return await db.select().from(arbitrageHistory).orderBy(desc(arbitrageHistory.createdAt));
  }

  async createArbitrageHistory(entry: InsertArbitrageHistory): Promise<ArbitrageHistory> {
    const [result] = await db
      .insert(arbitrageHistory)
      .values(entry)
      .returning();
    return result;
  }

  async deleteArbitrageHistory(id: string): Promise<void> {
    await db.delete(arbitrageHistory).where(eq(arbitrageHistory.id, id));
  }

  async clearArbitrageHistory(): Promise<void> {
    await db.delete(arbitrageHistory);
  }

  async getWatchlist(): Promise<Watchlist[]> {
    return await db.select().from(watchlist).orderBy(desc(watchlist.createdAt));
  }

  async createWatchlistItem(item: InsertWatchlist): Promise<Watchlist> {
    const [result] = await db
      .insert(watchlist)
      .values(item)
      .returning();
    return result;
  }

  async updateWatchlistItem(id: string, updates: Partial<Watchlist>): Promise<Watchlist | undefined> {
    const [result] = await db
      .update(watchlist)
      .set(updates)
      .where(eq(watchlist.id, id))
      .returning();
    return result;
  }

  async deleteWatchlistItem(id: string): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.id, id));
  }

  async getAlerts(): Promise<Alert[]> {
    return await db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [result] = await db
      .insert(alerts)
      .values(alert)
      .returning();
    return result;
  }

  async markAlertRead(id: string): Promise<void> {
    await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id));
  }

  async clearAlerts(): Promise<void> {
    await db.delete(alerts);
  }
}

export const storage = new DatabaseStorage();
