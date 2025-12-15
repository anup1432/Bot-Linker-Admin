import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Group join requests - tracks groups sent to the bot
export const groupJoins = pgTable("group_joins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  groupLink: text("group_link").notNull(),
  groupName: text("group_name"),
  status: text("status").notNull().default("pending"), // pending, joined, verified, failed
  joinedAt: timestamp("joined_at"),
  verifiedAt: timestamp("verified_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGroupJoinSchema = createInsertSchema(groupJoins).omit({ 
  id: true, 
  joinedAt: true, 
  verifiedAt: true, 
  createdAt: true 
});
export type InsertGroupJoin = z.infer<typeof insertGroupJoinSchema>;
export type GroupJoin = typeof groupJoins.$inferSelect;

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
  action: text("action").notNull(), // join_requested, joined, verified, failed
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
