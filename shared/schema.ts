import { z } from "zod";

export type User = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  authDate: number | null;
  balance: number;
  isAdmin: boolean;
  channelVerified: boolean;
  createdAt: Date;
};

export type InsertUser = Partial<Omit<User, 'id' | 'createdAt'>> & { telegramId: string };

export type GroupJoin = {
  id: string;
  orderId: number | null;
  userId: string;
  groupLink: string;
  groupName: string | null;
  groupId: string | null;
  groupAge: number | null;
  status: string;
  verificationStatus: string | null;
  ownershipTransferred: boolean;
  paymentAdded: boolean;
  paymentAmount: number | null;
  joinedAt: Date | null;
  verifiedAt: Date | null;
  ownershipVerifiedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type InsertGroupJoin = Partial<Omit<GroupJoin, 'id' | 'orderId' | 'joinedAt' | 'verifiedAt' | 'ownershipVerifiedAt' | 'createdAt'>> & { userId: string; groupLink: string };

export type PricingSettings = {
  id: string;
  minAgeDays: number;
  maxAgeDays: number | null;
  pricePerGroup: number;
  isActive: boolean;
  createdAt: Date;
};

export type InsertPricingSettings = Partial<Omit<PricingSettings, 'id' | 'createdAt'>> & { minAgeDays: number; pricePerGroup: number };

export type Withdrawal = {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  processedAt: Date | null;
  createdAt: Date;
};

export type InsertWithdrawal = Partial<Omit<Withdrawal, 'id' | 'processedAt' | 'createdAt'>> & { userId: string; amount: number; paymentMethod: string; paymentDetails: string };

export type AdminSettings = {
  id: string;
  requiredChannelId: string | null;
  requiredChannelUsername: string | null;
  welcomeMessage: string | null;
  minGroupAgeDays: number;
  adminPhoneNumber: string | null;
  adminUsername: string | null;
  adminPassword: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioPhoneNumber: string | null;
  otpEnabled: boolean;
  twoStepEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertAdminSettings = Partial<Omit<AdminSettings, 'id' | 'createdAt' | 'updatedAt'>>;

export type BotSettings = {
  id: string;
  userId: string;
  welcomeMessage: string | null;
  verificationMessage: string | null;
  autoJoin: boolean | null;
  notifyOnJoin: boolean | null;
};

export type InsertBotSettings = Partial<Omit<BotSettings, 'id'>> & { userId: string };

export type ActivityLog = {
  id: string;
  userId: string;
  action: string;
  description: string;
  groupJoinId: string | null;
  createdAt: Date;
};

export type InsertActivityLog = Partial<Omit<ActivityLog, 'id' | 'createdAt'>> & { userId: string; action: string; description: string };

export type Notification = {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data: string | null;
  createdAt: Date;
};

export type InsertNotification = Partial<Omit<Notification, 'id' | 'createdAt'>> & { type: string; title: string; message: string };

export type UserSession = {
  id: string;
  userId: string;
  telegramId: string;
  apiId: string;
  apiHash: string;
  phoneNumber: string | null;
  sessionString: string | null;
  isActive: boolean;
  lastUsed: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertUserSession = Partial<Omit<UserSession, 'id' | 'lastUsed' | 'createdAt' | 'updatedAt'>> & { userId: string; telegramId: string; apiId: string; apiHash: string };

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
