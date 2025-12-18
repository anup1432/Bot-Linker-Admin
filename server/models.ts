import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
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
}

export interface IGroupJoin extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: number;
  userId: mongoose.Types.ObjectId;
  groupLink: string;
  groupName: string | null;
  groupId: string | null;
  groupAge: number | null;
  groupYear: number | null;
  groupMonth: number | null;
  messageCount: number | null;
  groupType: string; // "used" or "unused" 
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
}

export interface IPricingSettings extends Document {
  _id: mongoose.Types.ObjectId;
  minAgeDays: number;
  maxAgeDays: number | null;
  pricePerGroup: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IWithdrawal extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  processedAt: Date | null;
  createdAt: Date;
}

export interface IAdminSettings extends Document {
  _id: mongoose.Types.ObjectId;
  requiredChannelId: string | null;
  requiredChannelUsername: string | null;
  welcomeMessage: string;
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
}

export interface IBotSettings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  welcomeMessage: string;
  verificationMessage: string;
  autoJoin: boolean;
  notifyOnJoin: boolean;
}

export interface IActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  description: string;
  groupJoinId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data: string | null;
  createdAt: Date;
}

export interface IUserSession extends Document {
  _id: mongoose.Types.ObjectId;
  odId: number;
  userId: mongoose.Types.ObjectId;
  telegramId: string;
  apiId: string;
  apiHash: string;
  phoneNumber: string | null;
  sessionString: string | null;
  isActive: boolean;
  lastUsed: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String, default: null },
  firstName: { type: String, default: null },
  lastName: { type: String, default: null },
  photoUrl: { type: String, default: null },
  authDate: { type: Number, default: null },
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  channelVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const groupJoinSchema = new Schema<IGroupJoin>({
  orderId: { type: Number, default: () => Date.now() },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupLink: { type: String, required: true },
  groupName: { type: String, default: null },
  groupId: { type: String, default: null },
  groupAge: { type: Number, default: null },
  groupYear: { type: Number, default: null },
  groupMonth: { type: Number, default: null },
  messageCount: { type: Number, default: null },
  groupType: { type: String, default: 'unknown' },
  status: { type: String, default: 'pending' },
  verificationStatus: { type: String, default: 'pending' },
  ownershipTransferred: { type: Boolean, default: false },
  paymentAdded: { type: Boolean, default: false },
  paymentAmount: { type: Number, default: null },
  joinedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  ownershipVerifiedAt: { type: Date, default: null },
  errorMessage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const pricingSettingsSchema = new Schema<IPricingSettings>({
  minAgeDays: { type: Number, required: true },
  maxAgeDays: { type: Number, default: null },
  pricePerGroup: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const withdrawalSchema = new Schema<IWithdrawal>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentDetails: { type: String, required: true },
  status: { type: String, default: 'pending' },
  processedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

const adminSettingsSchema = new Schema<IAdminSettings>({
  requiredChannelId: { type: String, default: null },
  requiredChannelUsername: { type: String, default: null },
  welcomeMessage: { type: String, default: 'Welcome! Please join our channel first to use this bot.' },
  minGroupAgeDays: { type: Number, default: 30 },
  adminPhoneNumber: { type: String, default: null },
  adminUsername: { type: String, default: null },
  adminPassword: { type: String, default: null },
  twilioAccountSid: { type: String, default: null },
  twilioAuthToken: { type: String, default: null },
  twilioPhoneNumber: { type: String, default: null },
  otpEnabled: { type: Boolean, default: false },
  twoStepEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const botSettingsSchema = new Schema<IBotSettings>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  welcomeMessage: { type: String, default: 'Welcome! Send me a group invite link and I will join it for you.' },
  verificationMessage: { type: String, default: 'Verification complete!' },
  autoJoin: { type: Boolean, default: true },
  notifyOnJoin: { type: Boolean, default: true },
});

const activityLogSchema = new Schema<IActivityLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  description: { type: String, required: true },
  groupJoinId: { type: Schema.Types.ObjectId, ref: 'GroupJoin', default: null },
  createdAt: { type: Date, default: Date.now },
});

const notificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  data: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const userSessionSchema = new Schema<IUserSession>({
  odId: { type: Number, default: () => Date.now() },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: String, required: true },
  apiId: { type: String, required: true },
  apiHash: { type: String, required: true },
  phoneNumber: { type: String, default: null },
  sessionString: { type: String, default: null },
  isActive: { type: Boolean, default: false },
  lastUsed: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', userSchema);
export const GroupJoin = mongoose.model<IGroupJoin>('GroupJoin', groupJoinSchema);
export const PricingSettings = mongoose.model<IPricingSettings>('PricingSettings', pricingSettingsSchema);
export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
export const AdminSettings = mongoose.model<IAdminSettings>('AdminSettings', adminSettingsSchema);
export const BotSettings = mongoose.model<IBotSettings>('BotSettings', botSettingsSchema);
export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export const UserSession = mongoose.model<IUserSession>('UserSession', userSessionSchema);
