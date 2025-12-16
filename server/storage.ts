import { 
  users, groupJoins, botSettings, activityLogs, pricingSettings, withdrawals, adminSettings, notifications, userSessions,
  type User, type InsertUser,
  type GroupJoin, type InsertGroupJoin,
  type BotSettings, type InsertBotSettings,
  type ActivityLog, type InsertActivityLog,
  type PricingSettings, type InsertPricingSettings,
  type Withdrawal, type InsertWithdrawal,
  type AdminSettings, type InsertAdminSettings,
  type Notification, type InsertNotification,
  type UserSession, type InsertUserSession
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, isNull, or, lte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserBalance(userId: string, amount: number): Promise<User | undefined>;

  // Group Joins
  getGroupJoins(userId: string): Promise<GroupJoin[]>;
  getAllGroupJoins(): Promise<GroupJoin[]>;
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

  // Pricing Settings
  getPricingSettings(): Promise<PricingSettings[]>;
  getPricingForAge(ageDays: number): Promise<PricingSettings | undefined>;
  createPricingSettings(settings: InsertPricingSettings): Promise<PricingSettings>;
  updatePricingSettings(id: string, updates: Partial<PricingSettings>): Promise<PricingSettings | undefined>;
  deletePricingSettings(id: string): Promise<boolean>;

  // Withdrawals
  getWithdrawals(userId: string): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawal(id: string, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  // Admin Settings
  getAdminSettings(): Promise<AdminSettings | undefined>;
  createOrUpdateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;

  // Notifications
  getNotifications(userId?: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId?: string): Promise<void>;

  // Bot Settings
  getBotSettings(userId: string): Promise<BotSettings | undefined>;
  createBotSettings(settings: InsertBotSettings): Promise<BotSettings>;
  updateBotSettings(userId: string, updates: Partial<BotSettings>): Promise<BotSettings | undefined>;

  // Activity Logs
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // User Sessions
  getUserSession(userId: string): Promise<UserSession | undefined>;
  getUserSessionByTelegramId(telegramId: string): Promise<UserSession | undefined>;
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  updateUserSession(id: string, updates: Partial<UserSession>): Promise<UserSession | undefined>;
  deleteUserSession(id: string): Promise<boolean>;
}

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

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserBalance(userId: string, amount: number): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ balance: sql`${users.balance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  // Group Joins
  async getGroupJoins(userId: string): Promise<GroupJoin[]> {
    return db.select().from(groupJoins)
      .where(eq(groupJoins.userId, userId))
      .orderBy(desc(groupJoins.createdAt));
  }

  async getAllGroupJoins(): Promise<GroupJoin[]> {
    return db.select().from(groupJoins).orderBy(desc(groupJoins.createdAt));
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
    await db.delete(groupJoins).where(eq(groupJoins.id, id));
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
        if (g.verificationStatus !== "approved" || !g.verifiedAt) return false;
        const verifiedDate = new Date(g.verifiedAt);
        return verifiedDate >= today;
      }).length,
      failedJoins: groups.filter((g) => g.status === "failed").length,
    };
  }

  // Pricing Settings
  async getPricingSettings(): Promise<PricingSettings[]> {
    return db.select().from(pricingSettings)
      .where(eq(pricingSettings.isActive, true))
      .orderBy(pricingSettings.minAgeDays);
  }

  async getPricingForAge(ageDays: number): Promise<PricingSettings | undefined> {
    const [pricing] = await db.select().from(pricingSettings)
      .where(
        and(
          eq(pricingSettings.isActive, true),
          lte(pricingSettings.minAgeDays, ageDays),
          or(
            isNull(pricingSettings.maxAgeDays),
            gte(pricingSettings.maxAgeDays, ageDays)
          )
        )
      )
      .limit(1);
    return pricing || undefined;
  }

  async createPricingSettings(settings: InsertPricingSettings): Promise<PricingSettings> {
    const [created] = await db.insert(pricingSettings).values(settings).returning();
    return created;
  }

  async updatePricingSettings(id: string, updates: Partial<PricingSettings>): Promise<PricingSettings | undefined> {
    const [updated] = await db.update(pricingSettings)
      .set(updates)
      .where(eq(pricingSettings.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePricingSettings(id: string): Promise<boolean> {
    await db.delete(pricingSettings).where(eq(pricingSettings.id, id));
    return true;
  }

  // Withdrawals
  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    return db.select().from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const [created] = await db.insert(withdrawals).values(withdrawal).returning();
    return created;
  }

  async updateWithdrawal(id: string, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    const [updated] = await db.update(withdrawals)
      .set(updates)
      .where(eq(withdrawals.id, id))
      .returning();
    return updated || undefined;
  }

  // Admin Settings
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const [settings] = await db.select().from(adminSettings).limit(1);
    return settings || undefined;
  }

  async createOrUpdateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const existing = await this.getAdminSettings();
    if (existing) {
      const [updated] = await db.update(adminSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(adminSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(adminSettings).values(settings).returning();
    return created;
  }

  // Notifications
  async getNotifications(userId?: string): Promise<Notification[]> {
    if (userId) {
      return db.select().from(notifications)
        .where(or(eq(notifications.userId, userId), isNull(notifications.userId)))
        .orderBy(desc(notifications.createdAt));
    }
    return db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated || undefined;
  }

  async markAllNotificationsRead(userId?: string): Promise<void> {
    if (userId) {
      await db.update(notifications)
        .set({ isRead: true })
        .where(or(eq(notifications.userId, userId), isNull(notifications.userId)));
    } else {
      await db.update(notifications).set({ isRead: true });
    }
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

  async getAllActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(insertLog).returning();
    return log;
  }

  // User Sessions
  async getUserSession(userId: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.userId, userId));
    return session || undefined;
  }

  async getUserSessionByTelegramId(telegramId: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.telegramId, telegramId));
    return session || undefined;
  }

  async createUserSession(insertSession: InsertUserSession): Promise<UserSession> {
    const [session] = await db.insert(userSessions).values(insertSession).returning();
    return session;
  }

  async updateUserSession(id: string, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    const [updated] = await db.update(userSessions)
      .set(updates)
      .where(eq(userSessions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUserSession(id: string): Promise<boolean> {
    await db.delete(userSessions).where(eq(userSessions.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
