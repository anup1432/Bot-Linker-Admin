import { 
  type User, type InsertUser,
  type GroupJoin, type InsertGroupJoin,
  type BotSettings, type InsertBotSettings,
  type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private groupJoins: Map<string, GroupJoin>;
  private botSettings: Map<string, BotSettings>;
  private activityLogs: Map<string, ActivityLog>;

  constructor() {
    this.users = new Map();
    this.groupJoins = new Map();
    this.botSettings = new Map();
    this.activityLogs = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.telegramId === telegramId
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Group Joins
  async getGroupJoins(userId: string): Promise<GroupJoin[]> {
    return Array.from(this.groupJoins.values())
      .filter((gj) => gj.userId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }

  async getGroupJoin(id: string): Promise<GroupJoin | undefined> {
    return this.groupJoins.get(id);
  }

  async getRecentGroupJoins(userId: string, limit: number = 10): Promise<GroupJoin[]> {
    const all = await this.getGroupJoins(userId);
    return all.slice(0, limit);
  }

  async createGroupJoin(insertGroupJoin: InsertGroupJoin): Promise<GroupJoin> {
    const id = randomUUID();
    const groupJoin: GroupJoin = {
      ...insertGroupJoin,
      id,
      joinedAt: null,
      verifiedAt: null,
      createdAt: new Date(),
    };
    this.groupJoins.set(id, groupJoin);
    return groupJoin;
  }

  async updateGroupJoin(id: string, updates: Partial<GroupJoin>): Promise<GroupJoin | undefined> {
    const existing = this.groupJoins.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.groupJoins.set(id, updated);
    return updated;
  }

  async deleteGroupJoin(id: string): Promise<boolean> {
    return this.groupJoins.delete(id);
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
    return Array.from(this.botSettings.values()).find(
      (settings) => settings.userId === userId
    );
  }

  async createBotSettings(insertSettings: InsertBotSettings): Promise<BotSettings> {
    const id = randomUUID();
    const settings: BotSettings = { ...insertSettings, id };
    this.botSettings.set(id, settings);
    return settings;
  }

  async updateBotSettings(userId: string, updates: Partial<BotSettings>): Promise<BotSettings | undefined> {
    const existing = await this.getBotSettings(userId);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.botSettings.set(existing.id, updated);
    return updated;
  }

  // Activity Logs
  async getActivityLogs(userId: string, limit: number = 20): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      ...insertLog,
      id,
      createdAt: new Date(),
    };
    this.activityLogs.set(id, log);
    return log;
  }
}

export const storage = new MemStorage();
