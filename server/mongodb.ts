import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram_bot';

export async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  photoUrl: String,
  authDate: Number,
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  channelVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const groupJoinSchema = new mongoose.Schema({
  orderId: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groupLink: { type: String, required: true },
  groupName: String,
  groupId: String,
  groupAge: Number,
  status: { type: String, default: 'pending' },
  verificationStatus: { type: String, default: 'pending' },
  ownershipTransferred: { type: Boolean, default: false },
  paymentAdded: { type: Boolean, default: false },
  paymentAmount: Number,
  joinedAt: Date,
  verifiedAt: Date,
  ownershipVerifiedAt: Date,
  errorMessage: String,
  createdAt: { type: Date, default: Date.now },
});

const pricingSettingsSchema = new mongoose.Schema({
  minAgeDays: { type: Number, required: true },
  maxAgeDays: Number,
  pricePerGroup: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentDetails: { type: String, required: true },
  status: { type: String, default: 'pending' },
  processedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const adminSettingsSchema = new mongoose.Schema({
  requiredChannelId: String,
  requiredChannelUsername: String,
  welcomeMessage: { type: String, default: 'Welcome! Please join our channel first to use this bot.' },
  minGroupAgeDays: { type: Number, default: 30 },
  adminPhoneNumber: String,
  adminUsername: String,
  adminPassword: String,
  twilioAccountSid: String,
  twilioAuthToken: String,
  twilioPhoneNumber: String,
  otpEnabled: { type: Boolean, default: false },
  twoStepEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const botSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  welcomeMessage: { type: String, default: 'Welcome! Send me a group invite link and I will join it for you.' },
  verificationMessage: { type: String, default: 'Verification complete!' },
  autoJoin: { type: Boolean, default: true },
  notifyOnJoin: { type: Boolean, default: true },
});

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  description: { type: String, required: true },
  groupJoinId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupJoin' },
  createdAt: { type: Date, default: Date.now },
});

const notificationSchema = new mongoose.Schema({
  userId: String,
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  data: String,
  createdAt: { type: Date, default: Date.now },
});

const userSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: String, required: true },
  apiId: { type: String, required: true },
  apiHash: { type: String, required: true },
  phoneNumber: String,
  sessionString: String,
  isActive: { type: Boolean, default: false },
  lastUsed: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model('User', userSchema);
export const GroupJoinModel = mongoose.model('GroupJoin', groupJoinSchema);
export const PricingSettingsModel = mongoose.model('PricingSettings', pricingSettingsSchema);
export const WithdrawalModel = mongoose.model('Withdrawal', withdrawalSchema);
export const AdminSettingsModel = mongoose.model('AdminSettings', adminSettingsSchema);
export const BotSettingsModel = mongoose.model('BotSettings', botSettingsSchema);
export const ActivityLogModel = mongoose.model('ActivityLog', activityLogSchema);
export const NotificationModel = mongoose.model('Notification', notificationSchema);
export const UserSessionModel = mongoose.model('UserSession', userSessionSchema);

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
