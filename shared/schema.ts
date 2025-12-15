import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - stores Telegram authenticated users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  authDate: integer("auth_date"),
  balance: real("balance").notNull().default(0),
  isAdmin: boolean("is_admin").notNull().default(false),
  channelVerified: boolean("channel_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Group join requests - tracks groups sent to the bot
export const groupJoins = pgTable("group_joins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: integer("order_id"),
  userId: varchar("user_id").notNull().references(() => users.id),
  groupLink: text("group_link").notNull(),
  groupName: text("group_name"),
  groupId: text("group_id"),
  groupAge: integer("group_age_days"),
  status: text("status").notNull().default("pending"),
  verificationStatus: text("verification_status").default("pending"),
  ownershipTransferred: boolean("ownership_transferred").notNull().default(false),
  paymentAdded: boolean("payment_added").notNull().default(false),
  paymentAmount: real("payment_amount"),
  joinedAt: timestamp("joined_at"),
  verifiedAt: timestamp("verified_at"),
  ownershipVerifiedAt: timestamp("ownership_verified_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGroupJoinSchema = createInsertSchema(groupJoins).omit({ 
  id: true, 
  orderId: true,
  joinedAt: true, 
  verifiedAt: true, 
  ownershipVerifiedAt: true,
  createdAt: true 
});
export type InsertGroupJoin = z.infer<typeof insertGroupJoinSchema>;
export type GroupJoin = typeof groupJoins.$inferSelect;

// Pricing settings - price based on group age
export const pricingSettings = pgTable("pricing_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  minAgeDays: integer("min_age_days").notNull(),
  maxAgeDays: integer("max_age_days"),
  pricePerGroup: real("price_per_group").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPricingSettingsSchema = createInsertSchema(pricingSettings).omit({ id: true, createdAt: true });
export type InsertPricingSettings = z.infer<typeof insertPricingSettingsSchema>;
export type PricingSettings = typeof pricingSettings.$inferSelect;

// Withdrawals - user withdrawal requests
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentDetails: text("payment_details").notNull(),
  status: text("status").notNull().default("pending"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, processedAt: true, createdAt: true });
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;

// Admin settings - global settings
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requiredChannelId: text("required_channel_id"),
  requiredChannelUsername: text("required_channel_username"),
  welcomeMessage: text("welcome_message").default("Welcome! Please join our channel first to use this bot."),
  minGroupAgeDays: integer("min_group_age_days").notNull().default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;

// Bot settings
export const botSettings = pgTable("bot_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  welcomeMessage: text("welcome_message").default("Welcome! Send me a group invite link and I will join it for you."),
  verificationMessage: text("verification_message").default("Verification complete!"),
  autoJoin: boolean("auto_join").default(true),
  notifyOnJoin: boolean("notify_on_join").default(true),
});

export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({ id: true });
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type BotSettings = typeof botSettings.$inferSelect;

// Activity log for dashboard
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  description: text("description").notNull(),
  groupJoinId: varchar("group_join_id").references(() => groupJoins.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Notifications for admin panel
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  data: text("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Telegram login data validation schema
export const telegramLoginSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export type TelegramLoginData = z.infer<typeof telegramLoginSchema>;
