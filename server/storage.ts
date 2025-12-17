import { 
  connectMongoDB,
  UserModel, GroupJoinModel, PricingSettingsModel, WithdrawalModel, 
  AdminSettingsModel, BotSettingsModel, ActivityLogModel, NotificationModel, UserSessionModel,
  type User, type InsertUser,
  type GroupJoin, type InsertGroupJoin,
  type BotSettings, type InsertBotSettings,
  type ActivityLog, type InsertActivityLog,
  type PricingSettings, type InsertPricingSettings,
  type Withdrawal, type InsertWithdrawal,
  type AdminSettings, type InsertAdminSettings,
  type Notification, type InsertNotification,
  type UserSession, type InsertUserSession
} from "./mongodb";

connectMongoDB().catch(console.error);

function docToUser(doc: any): User {
  return {
    id: doc._id.toString(),
    telegramId: doc.telegramId,
    username: doc.username || null,
    firstName: doc.firstName || null,
    lastName: doc.lastName || null,
    photoUrl: doc.photoUrl || null,
    authDate: doc.authDate || null,
    balance: doc.balance || 0,
    isAdmin: doc.isAdmin || false,
    channelVerified: doc.channelVerified || false,
    createdAt: doc.createdAt,
  };
}

function docToGroupJoin(doc: any): GroupJoin {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId || null,
    userId: doc.userId.toString(),
    groupLink: doc.groupLink,
    groupName: doc.groupName || null,
    groupId: doc.groupId || null,
    groupAge: doc.groupAge || null,
    status: doc.status || 'pending',
    verificationStatus: doc.verificationStatus || null,
    ownershipTransferred: doc.ownershipTransferred || false,
    paymentAdded: doc.paymentAdded || false,
    paymentAmount: doc.paymentAmount || null,
    joinedAt: doc.joinedAt || null,
    verifiedAt: doc.verifiedAt || null,
    ownershipVerifiedAt: doc.ownershipVerifiedAt || null,
    errorMessage: doc.errorMessage || null,
    createdAt: doc.createdAt,
  };
}

function docToPricingSettings(doc: any): PricingSettings {
  return {
    id: doc._id.toString(),
    minAgeDays: doc.minAgeDays,
    maxAgeDays: doc.maxAgeDays || null,
    pricePerGroup: doc.pricePerGroup,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

function docToWithdrawal(doc: any): Withdrawal {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    amount: doc.amount,
    paymentMethod: doc.paymentMethod,
    paymentDetails: doc.paymentDetails,
    status: doc.status,
    processedAt: doc.processedAt || null,
    createdAt: doc.createdAt,
  };
}

function docToAdminSettings(doc: any): AdminSettings {
  return {
    id: doc._id.toString(),
    requiredChannelId: doc.requiredChannelId || null,
    requiredChannelUsername: doc.requiredChannelUsername || null,
    welcomeMessage: doc.welcomeMessage || null,
    minGroupAgeDays: doc.minGroupAgeDays || 30,
    adminPhoneNumber: doc.adminPhoneNumber || null,
    adminUsername: doc.adminUsername || null,
    adminPassword: doc.adminPassword || null,
    twilioAccountSid: doc.twilioAccountSid || null,
    twilioAuthToken: doc.twilioAuthToken || null,
    twilioPhoneNumber: doc.twilioPhoneNumber || null,
    otpEnabled: doc.otpEnabled || false,
    twoStepEnabled: doc.twoStepEnabled || false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function docToBotSettings(doc: any): BotSettings {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    welcomeMessage: doc.welcomeMessage || null,
    verificationMessage: doc.verificationMessage || null,
    autoJoin: doc.autoJoin ?? null,
    notifyOnJoin: doc.notifyOnJoin ?? null,
  };
}

function docToActivityLog(doc: any): ActivityLog {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    action: doc.action,
    description: doc.description,
    groupJoinId: doc.groupJoinId?.toString() || null,
    createdAt: doc.createdAt,
  };
}

function docToNotification(doc: any): Notification {
  return {
    id: doc._id.toString(),
    userId: doc.userId || null,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    isRead: doc.isRead,
    data: doc.data || null,
    createdAt: doc.createdAt,
  };
}

function docToUserSession(doc: any): UserSession {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    telegramId: doc.telegramId,
    apiId: doc.apiId,
    apiHash: doc.apiHash,
    phoneNumber: doc.phoneNumber || null,
    sessionString: doc.sessionString || null,
    isActive: doc.isActive,
    lastUsed: doc.lastUsed || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserBalance(userId: string, amount: number): Promise<User | undefined>;

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

  getPricingSettings(): Promise<PricingSettings[]>;
  getPricingForAge(ageDays: number): Promise<PricingSettings | undefined>;
  createPricingSettings(settings: InsertPricingSettings): Promise<PricingSettings>;
  updatePricingSettings(id: string, updates: Partial<PricingSettings>): Promise<PricingSettings | undefined>;
  deletePricingSettings(id: string): Promise<boolean>;

  getWithdrawals(userId: string): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawal(id: string, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  getAdminSettings(): Promise<AdminSettings | undefined>;
  createOrUpdateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;

  getNotifications(userId?: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId?: string): Promise<void>;

  getBotSettings(userId: string): Promise<BotSettings | undefined>;
  createBotSettings(settings: InsertBotSettings): Promise<BotSettings>;
  updateBotSettings(userId: string, updates: Partial<BotSettings>): Promise<BotSettings | undefined>;

  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  getUserSession(userId: string): Promise<UserSession | undefined>;
  getUserSessionByTelegramId(telegramId: string): Promise<UserSession | undefined>;
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  updateUserSession(id: string, updates: Partial<UserSession>): Promise<UserSession | undefined>;
  deleteUserSession(id: string): Promise<boolean>;
}

export class MongoStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const doc = await UserModel.findById(id);
      return doc ? docToUser(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ telegramId });
    return doc ? docToUser(doc) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const doc = await UserModel.create(insertUser);
    return docToUser(doc);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    try {
      const doc = await UserModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? docToUser(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    const docs = await UserModel.find().sort({ createdAt: -1 });
    return docs.map(docToUser);
  }

  async updateUserBalance(userId: string, amount: number): Promise<User | undefined> {
    try {
      const doc = await UserModel.findByIdAndUpdate(
        userId,
        { $inc: { balance: amount } },
        { new: true }
      );
      return doc ? docToUser(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async getGroupJoins(userId: string): Promise<GroupJoin[]> {
    const docs = await GroupJoinModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map(docToGroupJoin);
  }

  async getAllGroupJoins(): Promise<GroupJoin[]> {
    const docs = await GroupJoinModel.find().sort({ createdAt: -1 });
    return docs.map(docToGroupJoin);
  }

  async getGroupJoin(id: string): Promise<GroupJoin | undefined> {
    try {
      const doc = await GroupJoinModel.findById(id);
      return doc ? docToGroupJoin(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async getRecentGroupJoins(userId: string, limit: number = 10): Promise<GroupJoin[]> {
    const docs = await GroupJoinModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return docs.map(docToGroupJoin);
  }

  async createGroupJoin(insertGroupJoin: InsertGroupJoin): Promise<GroupJoin> {
    const doc = await GroupJoinModel.create(insertGroupJoin as any);
    return docToGroupJoin(doc);
  }

  async updateGroupJoin(id: string, updates: Partial<GroupJoin>): Promise<GroupJoin | undefined> {
    try {
      const doc = await GroupJoinModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? docToGroupJoin(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async deleteGroupJoin(id: string): Promise<boolean> {
    try {
      await GroupJoinModel.findByIdAndDelete(id);
      return true;
    } catch {
      return false;
    }
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

  async getPricingSettings(): Promise<PricingSettings[]> {
    const docs = await PricingSettingsModel.find({ isActive: true }).sort({ minAgeDays: 1 });
    return docs.map(docToPricingSettings);
  }

  async getPricingForAge(ageDays: number): Promise<PricingSettings | undefined> {
    const doc = await PricingSettingsModel.findOne({
      isActive: true,
      minAgeDays: { $lte: ageDays },
      $or: [
        { maxAgeDays: null },
        { maxAgeDays: { $gte: ageDays } }
      ]
    });
    return doc ? docToPricingSettings(doc) : undefined;
  }

  async createPricingSettings(settings: InsertPricingSettings): Promise<PricingSettings> {
    const doc = await PricingSettingsModel.create(settings);
    return docToPricingSettings(doc);
  }

  async updatePricingSettings(id: string, updates: Partial<PricingSettings>): Promise<PricingSettings | undefined> {
    try {
      const doc = await PricingSettingsModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? docToPricingSettings(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async deletePricingSettings(id: string): Promise<boolean> {
    try {
      await PricingSettingsModel.findByIdAndDelete(id);
      return true;
    } catch {
      return false;
    }
  }

  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    const docs = await WithdrawalModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map(docToWithdrawal);
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    const docs = await WithdrawalModel.find().sort({ createdAt: -1 });
    return docs.map(docToWithdrawal);
  }

  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const doc = await WithdrawalModel.create(withdrawal);
    return docToWithdrawal(doc);
  }

  async updateWithdrawal(id: string, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    try {
      const doc = await WithdrawalModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? docToWithdrawal(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const doc = await AdminSettingsModel.findOne();
    return doc ? docToAdminSettings(doc) : undefined;
  }

  async createOrUpdateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const existing = await AdminSettingsModel.findOne();
    if (existing) {
      const updated = await AdminSettingsModel.findByIdAndUpdate(
        existing._id,
        { ...settings, updatedAt: new Date() },
        { new: true }
      );
      return docToAdminSettings(updated);
    }
    const doc = await AdminSettingsModel.create(settings as any);
    return docToAdminSettings(doc);
  }

  async getNotifications(userId?: string): Promise<Notification[]> {
    const query = userId ? { $or: [{ userId }, { userId: null }] } : {};
    const docs = await NotificationModel.find(query).sort({ createdAt: -1 });
    return docs.map(docToNotification);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const doc = await NotificationModel.create(notification);
    return docToNotification(doc);
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    try {
      const doc = await NotificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true });
      return doc ? docToNotification(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async markAllNotificationsRead(userId?: string): Promise<void> {
    const query = userId ? { $or: [{ userId }, { userId: null }] } : {};
    await NotificationModel.updateMany(query, { isRead: true });
  }

  async getBotSettings(userId: string): Promise<BotSettings | undefined> {
    const doc = await BotSettingsModel.findOne({ userId });
    return doc ? docToBotSettings(doc) : undefined;
  }

  async createBotSettings(insertSettings: InsertBotSettings): Promise<BotSettings> {
    const doc = await BotSettingsModel.create(insertSettings as any);
    return docToBotSettings(doc);
  }

  async updateBotSettings(userId: string, updates: Partial<BotSettings>): Promise<BotSettings | undefined> {
    const doc = await BotSettingsModel.findOneAndUpdate({ userId }, updates, { new: true });
    return doc ? docToBotSettings(doc) : undefined;
  }

  async getActivityLogs(userId: string, limit: number = 20): Promise<ActivityLog[]> {
    const docs = await ActivityLogModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return docs.map(docToActivityLog);
  }

  async getAllActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    const docs = await ActivityLogModel.find().sort({ createdAt: -1 }).limit(limit);
    return docs.map(docToActivityLog);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const doc = await ActivityLogModel.create(insertLog);
    return docToActivityLog(doc);
  }

  async getUserSession(userId: string): Promise<UserSession | undefined> {
    const doc = await UserSessionModel.findOne({ userId });
    return doc ? docToUserSession(doc) : undefined;
  }

  async getUserSessionByTelegramId(telegramId: string): Promise<UserSession | undefined> {
    const doc = await UserSessionModel.findOne({ telegramId });
    return doc ? docToUserSession(doc) : undefined;
  }

  async createUserSession(insertSession: InsertUserSession): Promise<UserSession> {
    const doc = await UserSessionModel.create(insertSession);
    return docToUserSession(doc);
  }

  async updateUserSession(id: string, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    try {
      const doc = await UserSessionModel.findByIdAndUpdate(
        id, 
        { ...updates, updatedAt: new Date() }, 
        { new: true }
      );
      return doc ? docToUserSession(doc) : undefined;
    } catch {
      return undefined;
    }
  }

  async deleteUserSession(id: string): Promise<boolean> {
    try {
      await UserSessionModel.findByIdAndDelete(id);
      return true;
    } catch {
      return false;
    }
  }
}

export const storage = new MongoStorage();
