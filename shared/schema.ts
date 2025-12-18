import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  authDate: integer("auth_date"),
  balance: real("balance").default(0).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  channelVerified: boolean("channel_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupJoins = pgTable("group_joins", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id"),
  userId: integer("user_id").notNull().references(() => users.id),
  groupLink: text("group_link").notNull(),
  groupName: text("group_name"),
  groupId: text("group_id"),
  groupAge: integer("group_age"),
  status: text("status").default("pending").notNull(),
  verificationStatus: text("verification_status").default("pending"),
  ownershipTransferred: boolean("ownership_transferred").default(false).notNull(),
  paymentAdded: boolean("payment_added").default(false).notNull(),
  paymentAmount: real("payment_amount"),
  joinedAt: timestamp("joined_at"),
  verifiedAt: timestamp("verified_at"),
  ownershipVerifiedAt: timestamp("ownership_verified_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pricingSettings = pgTable("pricing_settings", {
  id: serial("id").primaryKey(),
  minAgeDays: integer("min_age_days").notNull(),
  maxAgeDays: integer("max_age_days"),
  pricePerGroup: real("price_per_group").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const yearPricing = pgTable("year_pricing", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month"),
  category: text("category").notNull(),
  pricePerGroup: real("price_per_group").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentDetails: text("payment_details").notNull(),
  status: text("status").default("pending").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  requiredChannelId: text("required_channel_id"),
  requiredChannelUsername: text("required_channel_username"),
  welcomeMessage: text("welcome_message").default("Welcome! Please join our channel first to use this bot."),
  minGroupAgeDays: integer("min_group_age_days").default(30).notNull(),
  adminPhoneNumber: text("admin_phone_number"),
  adminUsername: text("admin_username"),
  adminPassword: text("admin_password"),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioPhoneNumber: text("twilio_phone_number"),
  otpEnabled: boolean("otp_enabled").default(false).notNull(),
  twoStepEnabled: boolean("two_step_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  welcomeMessage: text("welcome_message").default("Welcome! Send me a group invite link and I will join it for you."),
  verificationMessage: text("verification_message").default("Verification complete!"),
  autoJoin: boolean("auto_join").default(true),
  notifyOnJoin: boolean("notify_on_join").default(true),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  description: text("description").notNull(),
  groupJoinId: integer("group_join_id").references(() => groupJoins.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  data: text("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  telegramId: text("telegram_id").notNull(),
  apiId: text("api_id").notNull(),
  apiHash: text("api_hash").notNull(),
  phoneNumber: text("phone_number"),
  sessionString: text("session_string"),
  isActive: boolean("is_active").default(false).notNull(),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertGroupJoinSchema = createInsertSchema(groupJoins).omit({ id: true, orderId: true, joinedAt: true, verifiedAt: true, ownershipVerifiedAt: true, createdAt: true });
export const insertPricingSettingsSchema = createInsertSchema(pricingSettings).omit({ id: true, createdAt: true });
export const insertYearPricingSchema = createInsertSchema(yearPricing).omit({ id: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, processedAt: true, createdAt: true });
export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({ id: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({ id: true, lastUsed: true, createdAt: true, updatedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type GroupJoin = typeof groupJoins.$inferSelect;
export type InsertGroupJoin = z.infer<typeof insertGroupJoinSchema>;
export type PricingSettings = typeof pricingSettings.$inferSelect;
export type InsertPricingSettings = z.infer<typeof insertPricingSettingsSchema>;
export type YearPricing = typeof yearPricing.$inferSelect;
export type InsertYearPricing = z.infer<typeof insertYearPricingSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type BotSettings = typeof botSettings.$inferSelect;
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

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
