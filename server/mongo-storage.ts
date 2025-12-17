import mongoose from 'mongoose';
import {
  User, GroupJoin, PricingSettings, Withdrawal, AdminSettings,
  BotSettings, ActivityLog, Notification, UserSession,
  IUser, IGroupJoin, IPricingSettings, IWithdrawal, IAdminSettings,
  IBotSettings, IActivityLog, INotification, IUserSession
} from './models';

export interface UserData {
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
}

export interface GroupJoinData {
  id: string;
  orderId: number;
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
}

export interface PricingSettingsData {
  id: string;
  minAgeDays: number;
  maxAgeDays: number | null;
  pricePerGroup: number;
  isActive: boolean;
  createdAt: Date;
}

export interface WithdrawalData {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  processedAt: Date | null;
  createdAt: Date;
}

export interface AdminSettingsData {
  id: string;
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

export interface BotSettingsData {
  id: string;
  userId: string;
  welcomeMessage: string;
  verificationMessage: string;
  autoJoin: boolean;
  notifyOnJoin: boolean;
}

export interface ActivityLogData {
  id: string;
  userId: string;
  action: string;
  description: string;
  groupJoinId: string | null;
  createdAt: Date;
}

export interface NotificationData {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data: string | null;
  createdAt: Date;
}

export interface UserSessionData {
  id: string;
  odId: number;
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
}

function toUserData(doc: IUser): UserData {
  return {
    id: doc._id.toString(),
    telegramId: doc.telegramId,
    username: doc.username,
    firstName: doc.firstName,
    lastName: doc.lastName,
    photoUrl: doc.photoUrl,
    authDate: doc.authDate,
    balance: doc.balance,
    isAdmin: doc.isAdmin,
    channelVerified: doc.channelVerified,
    createdAt: doc.createdAt,
  };
}

function toGroupJoinData(doc: IGroupJoin): GroupJoinData {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId,
    userId: doc.userId.toString(),
    groupLink: doc.groupLink,
    groupName: doc.groupName,
    groupId: doc.groupId,
    groupAge: doc.groupAge,
    status: doc.status,
    verificationStatus: doc.verificationStatus,
    ownershipTransferred: doc.ownershipTransferred,
    paymentAdded: doc.paymentAdded,
    paymentAmount: doc.paymentAmount,
    joinedAt: doc.joinedAt,
    verifiedAt: doc.verifiedAt,
    ownershipVerifiedAt: doc.ownershipVerifiedAt,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt,
  };
}

function toPricingSettingsData(doc: IPricingSettings): PricingSettingsData {
  return {
    id: doc._id.toString(),
    minAgeDays: doc.minAgeDays,
    maxAgeDays: doc.maxAgeDays,
    pricePerGroup: doc.pricePerGroup,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

function toWithdrawalData(doc: IWithdrawal): WithdrawalData {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    amount: doc.amount,
    paymentMethod: doc.paymentMethod,
    paymentDetails: doc.paymentDetails,
    status: doc.status,
    processedAt: doc.processedAt,
    createdAt: doc.createdAt,
  };
}

function toAdminSettingsData(doc: IAdminSettings): AdminSettingsData {
  return {
    id: doc._id.toString(),
    requiredChannelId: doc.requiredChannelId,
    requiredChannelUsername: doc.requiredChannelUsername,
    welcomeMessage: doc.welcomeMessage,
    minGroupAgeDays: doc.minGroupAgeDays,
    adminPhoneNumber: doc.adminPhoneNumber,
    adminUsername: doc.adminUsername,
    adminPassword: doc.adminPassword,
    twilioAccountSid: doc.twilioAccountSid,
    twilioAuthToken: doc.twilioAuthToken,
    twilioPhoneNumber: doc.twilioPhoneNumber,
    otpEnabled: doc.otpEnabled,
    twoStepEnabled: doc.twoStepEnabled,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toBotSettingsData(doc: IBotSettings): BotSettingsData {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    welcomeMessage: doc.welcomeMessage,
    verificationMessage: doc.verificationMessage,
    autoJoin: doc.autoJoin,
    notifyOnJoin: doc.notifyOnJoin,
  };
}

function toActivityLogData(doc: IActivityLog): ActivityLogData {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    action: doc.action,
    description: doc.description,
    groupJoinId: doc.groupJoinId?.toString() || null,
    createdAt: doc.createdAt,
  };
}

function toNotificationData(doc: INotification): NotificationData {
  return {
    id: doc._id.toString(),
    userId: doc.userId?.toString() || null,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    isRead: doc.isRead,
    data: doc.data,
    createdAt: doc.createdAt,
  };
}

function toUserSessionData(doc: IUserSession): UserSessionData {
  return {
    id: doc._id.toString(),
    odId: doc.odId,
    userId: doc.userId.toString(),
    telegramId: doc.telegramId,
    apiId: doc.apiId,
    apiHash: doc.apiHash,
    phoneNumber: doc.phoneNumber,
    sessionString: doc.sessionString,
    isActive: doc.isActive,
    lastUsed: doc.lastUsed,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoStorage {
  async getUser(id: string): Promise<UserData | undefined> {
    const doc = await User.findById(id);
    return doc ? toUserData(doc) : undefined;
  }

  async getUserByTelegramId(telegramId: string): Promise<UserData | undefined> {
    const doc = await User.findOne({ telegramId });
    return doc ? toUserData(doc) : undefined;
  }

  async createUser(data: Partial<UserData>): Promise<UserData> {
    const doc = await User.create(data);
    return toUserData(doc);
  }

  async updateUser(id: string, updates: Partial<UserData>): Promise<UserData | undefined> {
    const doc = await User.findByIdAndUpdate(id, updates, { new: true });
    return doc ? toUserData(doc) : undefined;
  }

  async getAllUsers(): Promise<UserData[]> {
    const docs = await User.find().sort({ createdAt: -1 });
    return docs.map(toUserData);
  }

  async updateUserBalance(userId: string, amount: number): Promise<UserData | undefined> {
    const doc = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: amount } },
      { new: true }
    );
    return doc ? toUserData(doc) : undefined;
  }

  async getGroupJoins(userId: string): Promise<GroupJoinData[]> {
    const docs = await GroupJoin.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
    return docs.map(toGroupJoinData);
  }

  async getAllGroupJoins(): Promise<GroupJoinData[]> {
    const docs = await GroupJoin.find().sort({ createdAt: -1 });
    return docs.map(toGroupJoinData);
  }

  async getGroupJoin(id: string): Promise<GroupJoinData | undefined> {
    const doc = await GroupJoin.findById(id);
    return doc ? toGroupJoinData(doc) : undefined;
  }

  async getRecentGroupJoins(userId: string, limit: number = 10): Promise<GroupJoinData[]> {
    const docs = await GroupJoin.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toGroupJoinData);
  }

  async createGroupJoin(data: Partial<GroupJoinData>): Promise<GroupJoinData> {
    const doc = await GroupJoin.create({
      ...data,
      userId: new mongoose.Types.ObjectId(data.userId),
    });
    return toGroupJoinData(doc);
  }

  async updateGroupJoin(id: string, updates: Partial<GroupJoinData>): Promise<GroupJoinData | undefined> {
    const doc = await GroupJoin.findByIdAndUpdate(id, updates, { new: true });
    return doc ? toGroupJoinData(doc) : undefined;
  }

  async deleteGroupJoin(id: string): Promise<boolean> {
    await GroupJoin.findByIdAndDelete(id);
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

  async getPricingSettings(): Promise<PricingSettingsData[]> {
    const docs = await PricingSettings.find({ isActive: true }).sort({ minAgeDays: 1 });
    return docs.map(toPricingSettingsData);
  }

  async getPricingForAge(ageDays: number): Promise<PricingSettingsData | undefined> {
    const doc = await PricingSettings.findOne({
      isActive: true,
      minAgeDays: { $lte: ageDays },
      $or: [
        { maxAgeDays: null },
        { maxAgeDays: { $gte: ageDays } }
      ]
    });
    return doc ? toPricingSettingsData(doc) : undefined;
  }

  async createPricingSettings(data: Partial<PricingSettingsData>): Promise<PricingSettingsData> {
    const doc = await PricingSettings.create(data);
    return toPricingSettingsData(doc);
  }

  async updatePricingSettings(id: string, updates: Partial<PricingSettingsData>): Promise<PricingSettingsData | undefined> {
    const doc = await PricingSettings.findByIdAndUpdate(id, updates, { new: true });
    return doc ? toPricingSettingsData(doc) : undefined;
  }

  async deletePricingSettings(id: string): Promise<boolean> {
    await PricingSettings.findByIdAndDelete(id);
    return true;
  }

  async getWithdrawals(userId: string): Promise<WithdrawalData[]> {
    const docs = await Withdrawal.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
    return docs.map(toWithdrawalData);
  }

  async getAllWithdrawals(): Promise<WithdrawalData[]> {
    const docs = await Withdrawal.find().sort({ createdAt: -1 });
    return docs.map(toWithdrawalData);
  }

  async createWithdrawal(data: Partial<WithdrawalData>): Promise<WithdrawalData> {
    const doc = await Withdrawal.create({
      ...data,
      userId: new mongoose.Types.ObjectId(data.userId),
    });
    return toWithdrawalData(doc);
  }

  async updateWithdrawal(id: string, updates: Partial<WithdrawalData>): Promise<WithdrawalData | undefined> {
    const doc = await Withdrawal.findByIdAndUpdate(id, updates, { new: true });
    return doc ? toWithdrawalData(doc) : undefined;
  }

  async getAdminSettings(): Promise<AdminSettingsData | undefined> {
    const doc = await AdminSettings.findOne();
    return doc ? toAdminSettingsData(doc) : undefined;
  }

  async createOrUpdateAdminSettings(data: Partial<AdminSettingsData>): Promise<AdminSettingsData> {
    const existing = await AdminSettings.findOne();
    if (existing) {
      const doc = await AdminSettings.findByIdAndUpdate(
        existing._id,
        { ...data, updatedAt: new Date() },
        { new: true }
      );
      return toAdminSettingsData(doc!);
    }
    const doc = await AdminSettings.create(data);
    return toAdminSettingsData(doc);
  }

  async getNotifications(userId?: string): Promise<NotificationData[]> {
    const query = userId 
      ? { $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }] }
      : {};
    const docs = await Notification.find(query).sort({ createdAt: -1 });
    return docs.map(toNotificationData);
  }

  async createNotification(data: Partial<NotificationData>): Promise<NotificationData> {
    const doc = await Notification.create({
      ...data,
      userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : null,
    });
    return toNotificationData(doc);
  }

  async markNotificationRead(id: string): Promise<NotificationData | undefined> {
    const doc = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
    return doc ? toNotificationData(doc) : undefined;
  }

  async markAllNotificationsRead(userId?: string): Promise<void> {
    const query = userId 
      ? { $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }] }
      : {};
    await Notification.updateMany(query, { isRead: true });
  }

  async getBotSettings(userId: string): Promise<BotSettingsData | undefined> {
    const doc = await BotSettings.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    return doc ? toBotSettingsData(doc) : undefined;
  }

  async createBotSettings(data: Partial<BotSettingsData>): Promise<BotSettingsData> {
    const doc = await BotSettings.create({
      ...data,
      userId: new mongoose.Types.ObjectId(data.userId),
    });
    return toBotSettingsData(doc);
  }

  async updateBotSettings(userId: string, updates: Partial<BotSettingsData>): Promise<BotSettingsData | undefined> {
    const doc = await BotSettings.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      updates,
      { new: true }
    );
    return doc ? toBotSettingsData(doc) : undefined;
  }

  async getActivityLogs(userId: string, limit: number = 20): Promise<ActivityLogData[]> {
    const docs = await ActivityLog.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toActivityLogData);
  }

  async getAllActivityLogs(limit: number = 50): Promise<ActivityLogData[]> {
    const docs = await ActivityLog.find().sort({ createdAt: -1 }).limit(limit);
    return docs.map(toActivityLogData);
  }

  async createActivityLog(data: Partial<ActivityLogData>): Promise<ActivityLogData> {
    const doc = await ActivityLog.create({
      ...data,
      userId: new mongoose.Types.ObjectId(data.userId),
      groupJoinId: data.groupJoinId ? new mongoose.Types.ObjectId(data.groupJoinId) : null,
    });
    return toActivityLogData(doc);
  }

  async getUserSession(userId: string): Promise<UserSessionData | undefined> {
    const doc = await UserSession.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    return doc ? toUserSessionData(doc) : undefined;
  }

  async getUserSessionByTelegramId(telegramId: string): Promise<UserSessionData | undefined> {
    const doc = await UserSession.findOne({ telegramId });
    return doc ? toUserSessionData(doc) : undefined;
  }

  async createUserSession(data: Partial<UserSessionData>): Promise<UserSessionData> {
    const doc = await UserSession.create({
      ...data,
      userId: new mongoose.Types.ObjectId(data.userId),
    });
    return toUserSessionData(doc);
  }

  async updateUserSession(id: string, updates: Partial<UserSessionData>): Promise<UserSessionData | undefined> {
    const doc = await UserSession.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    return doc ? toUserSessionData(doc) : undefined;
  }

  async deleteUserSession(id: string): Promise<boolean> {
    await UserSession.findByIdAndDelete(id);
    return true;
  }
}

export const storage = new MongoStorage();
