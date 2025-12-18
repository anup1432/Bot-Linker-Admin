import { db } from "./db";
import { eq, desc, sql, and, lte, gte, or, isNull } from "drizzle-orm";
import {
  users,
  groupJoins,
  pricingSettings,
  yearPricing,
  withdrawals,
  adminSettings,
  botSettings,
  activityLogs,
  notifications,
  userSessions,
  type User,
  type InsertUser,
  type GroupJoin,
  type InsertGroupJoin,
  type PricingSettings,
  type InsertPricingSettings,
  type YearPricing,
  type InsertYearPricing,
  type Withdrawal,
  type InsertWithdrawal,
  type AdminSettings,
  type InsertAdminSettings,
  type BotSettings,
  type InsertBotSettings,
  type ActivityLog,
  type InsertActivityLog,
  type Notification,
  type InsertNotification,
  type UserSession,
  type InsertUserSession,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserBalance(userId: number, amount: number): Promise<User | undefined>;

  getGroupJoins(userId: number): Promise<GroupJoin[]>;
  getAllGroupJoins(): Promise<GroupJoin[]>;
  getGroupJoin(id: number): Promise<GroupJoin | undefined>;
  getRecentGroupJoins(userId: number, limit?: number): Promise<GroupJoin[]>;
  createGroupJoin(groupJoin: InsertGroupJoin): Promise<GroupJoin>;
  updateGroupJoin(id: number, updates: Partial<GroupJoin>): Promise<GroupJoin | undefined>;
  deleteGroupJoin(id: number): Promise<boolean>;
  getGroupStats(userId: number): Promise<{
    totalGroups: number;
    pendingJoins: number;
    verifiedToday: number;
    failedJoins: number;
  }>;

  getPricingSettings(): Promise<PricingSettings[]>;
  getPricingForAge(ageDays: number): Promise<PricingSettings | undefined>;
  createPricingSettings(settings: InsertPricingSettings): Promise<PricingSettings>;
  updatePricingSettings(id: number, updates: Partial<PricingSettings>): Promise<PricingSettings | undefined>;
  deletePricingSettings(id: number): Promise<boolean>;

  getAllYearPricing(): Promise<YearPricing[]>;
  getYearPricing(year: number, month: number | null, category: string): Promise<YearPricing | undefined>;
  createYearPricing(pricing: InsertYearPricing): Promise<YearPricing>;
  updateYearPricing(id: number, updates: Partial<YearPricing>): Promise<YearPricing | undefined>;
  deleteYearPricing(id: number): Promise<boolean>;

  getWithdrawals(userId: number): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawal(id: number, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  getAdminSettings(): Promise<AdminSettings | undefined>;
  createOrUpdateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;

  getNotifications(userId?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsRead(userId?: number): Promise<void>;

  getBotSettings(userId: number): Promise<BotSettings | undefined>;
  createBotSettings(settings: InsertBotSettings): Promise<BotSettings>;
  updateBotSettings(userId: number, updates: Partial<BotSettings>): Promise<BotSettings | undefined>;

  getActivityLogs(userId: number, limit?: number): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  getUserSession(userId: number): Promise<UserSession | undefined>;
  getUserSessionByTelegramId(telegramId: string): Promise<UserSession | undefined>;
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  updateUserSession(id: number, updates: Partial<UserSession>): Promise<UserSession | undefined>;
  deleteUserSession(id: number): Promise<boolean>;
}

export class PostgresStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserBalance(userId: number, amount: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ balance: sql`${users.balance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getGroupJoins(userId: number): Promise<GroupJoin[]> {
    return db.select().from(groupJoins).where(eq(groupJoins.userId, userId)).orderBy(desc(groupJoins.createdAt));
  }

  async getAllGroupJoins(): Promise<GroupJoin[]> {
    return db.select().from(groupJoins).orderBy(desc(groupJoins.createdAt));
  }

  async getGroupJoin(id: number): Promise<GroupJoin | undefined> {
    const [group] = await db.select().from(groupJoins).where(eq(groupJoins.id, id));
    return group;
  }

  async getRecentGroupJoins(userId: number, limit: number = 10): Promise<GroupJoin[]> {
    return db.select().from(groupJoins).where(eq(groupJoins.userId, userId)).orderBy(desc(groupJoins.createdAt)).limit(limit);
  }

  async createGroupJoin(insertGroupJoin: InsertGroupJoin): Promise<GroupJoin> {
    const [group] = await db.insert(groupJoins).values(insertGroupJoin).returning();
    return group;
  }

  async updateGroupJoin(id: number, updates: Partial<GroupJoin>): Promise<GroupJoin | undefined> {
    const [group] = await db.update(groupJoins).set(updates).where(eq(groupJoins.id, id)).returning();
    return group;
  }

  async deleteGroupJoin(id: number): Promise<boolean> {
    const result = await db.delete(groupJoins).where(eq(groupJoins.id, id));
    return true;
  }

  async getGroupStats(userId: number): Promise<{
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

  async getPricingSettings(): Promise<PricingSettings[]> {
    return db.select().from(pricingSettings).where(eq(pricingSettings.isActive, true)).orderBy(pricingSettings.minAgeDays);
  }

  async getPricingForAge(ageDays: number): Promise<PricingSettings | undefined> {
    const [pricing] = await db
      .select()
      .from(pricingSettings)
      .where(
        and(
          eq(pricingSettings.isActive, true),
          lte(pricingSettings.minAgeDays, ageDays),
          or(isNull(pricingSettings.maxAgeDays), gte(pricingSettings.maxAgeDays, ageDays))
        )
      );
    return pricing;
  }

  async createPricingSettings(settings: InsertPricingSettings): Promise<PricingSettings> {
    const [pricing] = await db.insert(pricingSettings).values(settings).returning();
    return pricing;
  }

  async updatePricingSettings(id: number, updates: Partial<PricingSettings>): Promise<PricingSettings | undefined> {
    const [pricing] = await db.update(pricingSettings).set(updates).where(eq(pricingSettings.id, id)).returning();
    return pricing;
  }

  async deletePricingSettings(id: number): Promise<boolean> {
    await db.delete(pricingSettings).where(eq(pricingSettings.id, id));
    return true;
  }

  async getAllYearPricing(): Promise<YearPricing[]> {
    return db.select().from(yearPricing).orderBy(yearPricing.startYear, yearPricing.month);
  }

  async getYearPricing(year: number, month: number | null, category: string): Promise<YearPricing | undefined> {
    if (month !== null) {
      const [pricing] = await db
        .select()
        .from(yearPricing)
        .where(
          and(
            lte(yearPricing.startYear, year),
            or(isNull(yearPricing.endYear), gte(yearPricing.endYear, year)),
            eq(yearPricing.month, month),
            eq(yearPricing.category, category),
            eq(yearPricing.isActive, true)
          )
        );
      return pricing;
    } else {
      const [pricing] = await db
        .select()
        .from(yearPricing)
        .where(
          and(
            lte(yearPricing.startYear, year),
            or(isNull(yearPricing.endYear), gte(yearPricing.endYear, year)),
            isNull(yearPricing.month),
            eq(yearPricing.category, category),
            eq(yearPricing.isActive, true)
          )
        );
      return pricing;
    }
  }

  async createYearPricing(pricing: InsertYearPricing): Promise<YearPricing> {
    const [p] = await db.insert(yearPricing).values(pricing).returning();
    return p;
  }

  async updateYearPricing(id: number, updates: Partial<YearPricing>): Promise<YearPricing | undefined> {
    const [p] = await db.update(yearPricing).set(updates).where(eq(yearPricing.id, id)).returning();
    return p;
  }

  async deleteYearPricing(id: number): Promise<boolean> {
    await db.delete(yearPricing).where(eq(yearPricing.id, id));
    return true;
  }

  async getWithdrawals(userId: number): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const [w] = await db.insert(withdrawals).values(withdrawal).returning();
    return w;
  }

  async updateWithdrawal(id: number, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    const [w] = await db.update(withdrawals).set(updates).where(eq(withdrawals.id, id)).returning();
    return w;
  }

  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const [settings] = await db.select().from(adminSettings).limit(1);
    return settings;
  }

  async createOrUpdateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const existing = await this.getAdminSettings();
    if (existing) {
      const [updated] = await db
        .update(adminSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(adminSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(adminSettings).values(settings).returning();
    return created;
  }

  async getNotifications(userId?: number): Promise<Notification[]> {
    if (userId) {
      return db
        .select()
        .from(notifications)
        .where(or(eq(notifications.userId, userId), isNull(notifications.userId)))
        .orderBy(desc(notifications.createdAt));
    }
    return db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    return n;
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [n] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return n;
  }

  async markAllNotificationsRead(userId?: number): Promise<void> {
    if (userId) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(or(eq(notifications.userId, userId), isNull(notifications.userId)));
    } else {
      await db.update(notifications).set({ isRead: true });
    }
  }

  async getBotSettings(userId: number): Promise<BotSettings | undefined> {
    const [settings] = await db.select().from(botSettings).where(eq(botSettings.userId, userId));
    return settings;
  }

  async createBotSettings(settings: InsertBotSettings): Promise<BotSettings> {
    const [s] = await db.insert(botSettings).values(settings).returning();
    return s;
  }

  async updateBotSettings(userId: number, updates: Partial<BotSettings>): Promise<BotSettings | undefined> {
    const [s] = await db.update(botSettings).set(updates).where(eq(botSettings.userId, userId)).returning();
    return s;
  }

  async getActivityLogs(userId: number, limit: number = 20): Promise<ActivityLog[]> {
    return db.select().from(activityLogs).where(eq(activityLogs.userId, userId)).orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  async getAllActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [l] = await db.insert(activityLogs).values(log).returning();
    return l;
  }

  async getUserSession(userId: number): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.userId, userId));
    return session;
  }

  async getUserSessionByTelegramId(telegramId: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.telegramId, telegramId));
    return session;
  }

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [s] = await db.insert(userSessions).values(session).returning();
    return s;
  }

  async updateUserSession(id: number, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    const [s] = await db
      .update(userSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userSessions.id, id))
      .returning();
    return s;
  }

  async deleteUserSession(id: number): Promise<boolean> {
    await db.delete(userSessions).where(eq(userSessions.id, id));
    return true;
  }
}

export const storage = new PostgresStorage();
