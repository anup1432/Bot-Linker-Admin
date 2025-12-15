import { 
  users, groupJoins, botSettings, activityLogs,
  type User, type InsertUser,
  type GroupJoin, type InsertGroupJoin,
  type BotSettings, type InsertBotSettings,
  type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Group Joins
  getGroupJoins(userId: string): Promise<GroupJoin[]>;
  getGroupJoin(id: string): Promise<GroupJoin | undefined>;
  getRecentGroupJoins(userId: string, limit?: number): Promise<GroupJoin[]>;
  createGroupJoin(groupJoin: InsertGroupJoin): Promise<GroupJoin>;
  updateGroupJoin(id: string, updates: Partial<GroupJoin>): Promise<GroupJoin | undefined>;
  deleteGroupJoin(id: string): Promise<boolean>;
  getGroupStats(userId: string): Promise<{
    totalGroups: number;
    pendingJoins: number;
    verifiedToday: number;
    failedJoins: number;
  }>;

  // Bot Settings
  getBotSettings(userId: string): Promise<BotSettings | undefined>;
  createBotSettings(settings: InsertBotSettings): Promise<BotSettings>;
  updateBotSettings(userId: string, updates: Partial<BotSettings>): Promise<BotSettings | undefined>;

  // Activity Logs
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
}

// DatabaseStorage implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Group Joins
  async getGroupJoins(userId: string): Promise<GroupJoin[]> {
    return db.select().from(groupJoins)
      .where(eq(groupJoins.userId, userId))
      .orderBy(desc(groupJoins.createdAt));
  }

  async getGroupJoin(id: string): Promise<GroupJoin | undefined> {
    const [group] = await db.select().from(groupJoins).where(eq(groupJoins.id, id));
    return group || undefined;
  }

  async getRecentGroupJoins(userId: string, limit: number = 10): Promise<GroupJoin[]> {
    return db.select().from(groupJoins)
      .where(eq(groupJoins.userId, userId))
      .orderBy(desc(groupJoins.createdAt))
      .limit(limit);
  }

  async createGroupJoin(insertGroupJoin: InsertGroupJoin): Promise<GroupJoin> {
    const [group] = await db.insert(groupJoins).values(insertGroupJoin).returning();
    return group;
  }

  async updateGroupJoin(id: string, updates: Partial<GroupJoin>): Promise<GroupJoin | undefined> {
    const [updated] = await db.update(groupJoins)
      .set(updates)
      .where(eq(groupJoins.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGroupJoin(id: string): Promise<boolean> {
    const result = await db.delete(groupJoins).where(eq(groupJoins.id, id));
    return true;
  }

  async getGroupStats(userId: string): Promise<{
    totalGroups: number;
    pendingJoins: number;
    verifiedToday: number;
    failedJoins: number;
  }> {
    const groups = await this.getGroupJoins(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalGroups: groups.length,
      pendingJoins: groups.filter((g) => g.status === "pending").length,
      verifiedToday: groups.filter((g) => {
        if (g.status !== "verified" || !g.verifiedAt) return false;
        const verifiedDate = new Date(g.verifiedAt);
        return verifiedDate >= today;
      }).length,
      failedJoins: groups.filter((g) => g.status === "failed").length,
    };
  }

  // Bot Settings
  async getBotSettings(userId: string): Promise<BotSettings | undefined> {
    const [settings] = await db.select().from(botSettings).where(eq(botSettings.userId, userId));
    return settings || undefined;
  }

  async createBotSettings(insertSettings: InsertBotSettings): Promise<BotSettings> {
    const [settings] = await db.insert(botSettings).values(insertSettings).returning();
    return settings;
  }

  async updateBotSettings(userId: string, updates: Partial<BotSettings>): Promise<BotSettings | undefined> {
    const [updated] = await db.update(botSettings)
      .set(updates)
      .where(eq(botSettings.userId, userId))
      .returning();
    return updated || undefined;
  }

  // Activity Logs
  async getActivityLogs(userId: string, limit: number = 20): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(insertLog).returning();
    return log;
  }
}

export const storage = new DatabaseStorage();
