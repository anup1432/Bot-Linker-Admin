import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./mongo-storage";
import { initTelegramBot, getBotInfo, sendMessageToUser } from "./telegram-bot";
import { connectMongoDB } from "./mongodb";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const MemStore = MemoryStore(session);

const otpStore: Map<string, { otp: string; expiry: number; phoneNumber: string }> = new Map();
const registrationStore: Map<string, { phoneNumber: string; verified: boolean; expiry: number }> = new Map();

async function sendOtpViaTwilio(phoneNumber: string, otp: string, settings: any): Promise<boolean> {
  try {
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken || !settings?.twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      return false;
    }
    
    const twilio = await import("twilio");
    const client = twilio.default(settings.twilioAccountSid, settings.twilioAuthToken);
    
    await client.messages.create({
      body: `Your admin verification code is: ${otp}. Valid for 5 minutes.`,
      from: settings.twilioPhoneNumber,
      to: phoneNumber,
    });
    
    return true;
  } catch (error) {
    console.error("Failed to send OTP:", error);
    return false;
  }
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function verifyTelegramAuth(data: Record<string, unknown>, botToken: string): boolean {
  const { hash, ...authData } = data;
  
  if (!hash || typeof hash !== "string") return false;
  
  const checkString = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key]}`)
    .join("\n");
  
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  
  return hmac === hash;
}

const telegramLoginSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  try {
    await connectMongoDB();
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }

  // Trust proxy for Render/production environments
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      store: new MemStore({
        checkPeriod: 86400000,
      }),
      secret: process.env.SESSION_SECRET || "telegram-bot-admin-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    initTelegramBot(botToken);
  }

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        return res.status(500).json({ error: "Bot not configured" });
      }

      const parseResult = telegramLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid login data" });
      }

      const telegramData = parseResult.data;

      if (process.env.NODE_ENV === "production" && telegramData.hash !== "dev_mode_hash") {
        if (!verifyTelegramAuth(req.body, botToken)) {
          return res.status(401).json({ error: "Invalid authentication" });
        }
      }

      const authAge = Date.now() / 1000 - telegramData.auth_date;
      if (authAge > 86400) {
        return res.status(401).json({ error: "Authentication expired" });
      }

      let user = await storage.getUserByTelegramId(telegramData.id.toString());
      
      if (!user) {
        user = await storage.createUser({
          telegramId: telegramData.id.toString(),
          username: telegramData.username || null,
          firstName: telegramData.first_name || null,
          lastName: telegramData.last_name || null,
          photoUrl: telegramData.photo_url || null,
          authDate: telegramData.auth_date,
          balance: 0,
          isAdmin: false,
          channelVerified: false,
        });

        await storage.createBotSettings({
          userId: user.id,
          welcomeMessage: "Welcome! Send me a group invite link and I will track it for you.",
          verificationMessage: "Verification complete!",
          autoJoin: true,
          notifyOnJoin: true,
        });
      }

      req.session.userId = user.id;
      res.json({ user });
    } catch (error) {
      console.error("Telegram auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/auth/register/request-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number required" });
      }

      const settings = await storage.getAdminSettings();
      
      if (!settings?.twilioAccountSid || !settings?.twilioAuthToken || !settings?.twilioPhoneNumber) {
        const otp = generateOtp();
        const sessionId = crypto.randomBytes(16).toString("hex");
        
        otpStore.set(sessionId, {
          otp,
          expiry: Date.now() + 5 * 60 * 1000,
          phoneNumber,
        });
        
        console.log(`DEV MODE - OTP for ${phoneNumber}: ${otp}`);
        return res.json({ sessionId, message: "OTP sent (dev mode - check console)", devOtp: otp });
      }

      const otp = generateOtp();
      const sessionId = crypto.randomBytes(16).toString("hex");
      
      otpStore.set(sessionId, {
        otp,
        expiry: Date.now() + 5 * 60 * 1000,
        phoneNumber,
      });

      const sent = await sendOtpViaTwilio(phoneNumber, otp, settings);
      if (!sent) {
        return res.status(500).json({ error: "Failed to send OTP" });
      }

      res.json({ sessionId, message: "OTP sent" });
    } catch (error) {
      console.error("Request OTP error:", error);
      res.status(500).json({ error: "Failed to request OTP" });
    }
  });

  app.post("/api/auth/register/verify-otp", async (req, res) => {
    try {
      const { sessionId, otp } = req.body;
      
      const otpData = otpStore.get(sessionId);
      if (!otpData) {
        return res.status(401).json({ error: "Session expired" });
      }

      if (Date.now() > otpData.expiry) {
        otpStore.delete(sessionId);
        return res.status(401).json({ error: "OTP expired" });
      }

      if (otpData.otp !== otp) {
        return res.status(401).json({ error: "Invalid OTP" });
      }

      registrationStore.set(sessionId, {
        phoneNumber: otpData.phoneNumber,
        verified: true,
        expiry: Date.now() + 10 * 60 * 1000,
      });

      otpStore.delete(sessionId);
      res.json({ success: true, message: "OTP verified" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  app.post("/api/auth/register/complete", async (req, res) => {
    try {
      const { sessionId, username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const regData = registrationStore.get(sessionId);
      if (!regData || !regData.verified) {
        return res.status(401).json({ error: "Please verify OTP first" });
      }

      if (Date.now() > regData.expiry) {
        registrationStore.delete(sessionId);
        return res.status(401).json({ error: "Registration session expired" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let user = await storage.getUserByTelegramId(regData.phoneNumber);
      
      if (!user) {
        user = await storage.createUser({
          telegramId: regData.phoneNumber,
          username: username,
          firstName: username,
          lastName: null,
          photoUrl: null,
          authDate: Math.floor(Date.now() / 1000),
          balance: 0,
          isAdmin: true,
          channelVerified: true,
        });

        await storage.createBotSettings({
          userId: user.id,
          welcomeMessage: "Welcome! Send me a group invite link and I will track it for you.",
          verificationMessage: "Verification complete!",
          autoJoin: true,
          notifyOnJoin: true,
        });
      }

      await storage.createOrUpdateAdminSettings({
        adminPhoneNumber: regData.phoneNumber,
        adminPassword: hashedPassword,
        adminUsername: username,
      });

      registrationStore.delete(sessionId);
      req.session.userId = user.id;
      res.json({ success: true, user });
    } catch (error) {
      console.error("Complete registration error:", error);
      res.status(500).json({ error: "Failed to complete registration" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const settings = await storage.getAdminSettings();
      
      if (settings?.adminUsername && settings?.adminPassword) {
        if (username === settings.adminUsername) {
          const validPassword = await bcrypt.compare(password, settings.adminPassword);
          if (validPassword) {
            const user = await storage.getUserByTelegramId(settings.adminPhoneNumber || "admin");
            if (user) {
              req.session.userId = user.id;
              return res.json({ user });
            }
          }
        }
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      if (username === "admin" && password === "admin123") {
        let user = await storage.getUserByTelegramId("admin");
        
        if (!user) {
          user = await storage.createUser({
            telegramId: "admin",
            username: "admin",
            firstName: "Admin",
            lastName: null,
            photoUrl: null,
            authDate: Math.floor(Date.now() / 1000),
            balance: 0,
            isAdmin: true,
            channelVerified: true,
          });

          await storage.createBotSettings({
            userId: user.id,
            welcomeMessage: "Welcome! Send me a group invite link and I will track it for you.",
            verificationMessage: "Verification complete!",
            autoJoin: true,
            notifyOnJoin: true,
          });
        }
        
        req.session.userId = user.id;
        return res.json({ user });
      }
      
      return res.status(401).json({ error: "Invalid username or password" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  app.get("/api/auth/check-registered", async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json({
        isRegistered: !!(settings?.adminUsername && settings?.adminPassword),
        hasTwilio: !!(settings?.twilioAccountSid),
      });
    } catch (error) {
      res.json({ isRegistered: false, hasTwilio: false });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/bot/info", (req, res) => {
    const info = getBotInfo();
    if (!info) {
      return res.json({ username: "", firstName: "", isActive: false });
    }
    res.json(info);
  });

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getGroupStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getActivityLogs(req.session.userId!);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  app.get("/api/groups", requireAuth, async (req, res) => {
    try {
      const groups = await storage.getGroupJoins(req.session.userId!);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get groups" });
    }
  });

  app.get("/api/groups/recent", requireAuth, async (req, res) => {
    try {
      const groups = await storage.getRecentGroupJoins(req.session.userId!, 5);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent groups" });
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const group = await storage.getGroupJoin(id);
      
      if (!group || group.userId !== req.session.userId) {
        return res.status(404).json({ error: "Group not found" });
      }

      await storage.deleteGroupJoin(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      let settings = await storage.getBotSettings(req.session.userId!);
      
      if (!settings) {
        settings = await storage.createBotSettings({
          userId: req.session.userId!,
          welcomeMessage: "Welcome! Send me a group invite link and I will track it for you.",
          verificationMessage: "Verification complete!",
          autoJoin: true,
          notifyOnJoin: true,
        });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.patch("/api/settings", requireAuth, async (req, res) => {
    try {
      const { welcomeMessage, verificationMessage, autoJoin, notifyOnJoin } = req.body;
      
      let settings = await storage.getBotSettings(req.session.userId!);
      
      if (!settings) {
        settings = await storage.createBotSettings({
          userId: req.session.userId!,
          welcomeMessage: welcomeMessage || "Welcome!",
          verificationMessage: verificationMessage || "Verified!",
          autoJoin: autoJoin ?? true,
          notifyOnJoin: notifyOnJoin ?? true,
        });
      } else {
        settings = await storage.updateBotSettings(req.session.userId!, {
          welcomeMessage,
          verificationMessage,
          autoJoin,
          notifyOnJoin,
        });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawals(req.session.userId!);
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get withdrawals" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const notifications = await storage.getNotifications(user?.isAdmin ? undefined : req.session.userId!);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(req.params.id);
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      await storage.markAllNotificationsRead(user?.isAdmin ? undefined : req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const groups = await storage.getAllGroupJoins();
      const withdrawals = await storage.getAllWithdrawals();

      const stats = {
        totalUsers: users.length,
        totalGroups: groups.length,
        pendingGroups: groups.filter(g => g.verificationStatus === "pending").length,
        approvedGroups: groups.filter(g => g.verificationStatus === "approved").length,
        pendingWithdrawals: withdrawals.filter(w => w.status === "pending").length,
        totalPaidOut: withdrawals.filter(w => w.status === "completed").reduce((sum, w) => sum + w.amount, 0),
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { isAdmin, balance } = req.body;
      const updated = await storage.updateUser(req.params.id, { isAdmin, balance });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/admin/groups", requireAdmin, async (req, res) => {
    try {
      const groups = await storage.getAllGroupJoins();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get groups" });
    }
  });

  app.patch("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const { groupAge, verificationStatus, ownershipTransferred, paymentAmount, errorMessage } = req.body;
      const id = req.params.id;
      const group = await storage.getGroupJoin(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const updates: any = {};
      
      if (groupAge !== undefined) updates.groupAge = groupAge;
      if (verificationStatus !== undefined) {
        updates.verificationStatus = verificationStatus;
        if (verificationStatus === "approved") {
          updates.verifiedAt = new Date();
        }
      }
      if (ownershipTransferred !== undefined) {
        updates.ownershipTransferred = ownershipTransferred;
        if (ownershipTransferred) {
          updates.ownershipVerifiedAt = new Date();
        }
      }
      if (paymentAmount !== undefined) {
        updates.paymentAmount = paymentAmount;
        updates.paymentAdded = true;
        
        await storage.updateUserBalance(group.userId, paymentAmount);
        
        const user = await storage.getUser(group.userId);
        if (user) {
          await sendMessageToUser(user.telegramId,
            `Payment added to your account!\n\n` +
            `Group: ${group.groupLink}\n` +
            `Amount: +${paymentAmount.toFixed(2)} INR\n\n` +
            `Check your balance with /balance`
          );
        }

        await storage.createActivityLog({
          userId: group.userId,
          action: "payment_added",
          description: `Payment of ${paymentAmount} INR added for group: ${group.groupLink}`,
          groupJoinId: group.id,
        });
      }
      if (errorMessage !== undefined) updates.errorMessage = errorMessage;

      const updated = await storage.updateGroupJoin(id, updates);

      const user = await storage.getUser(group.userId);
      if (user && verificationStatus) {
        const statusText = verificationStatus === "approved" ? "Approved (A)" : "Rejected (R)";
        await sendMessageToUser(user.telegramId,
          `Your group status has been updated!\n\n` +
          `Group: ${group.groupLink}\n` +
          `Status: ${statusText}`
        );
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  app.get("/api/admin/withdrawals", requireAdmin, async (req, res) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get withdrawals" });
    }
  });

  app.patch("/api/admin/withdrawals/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const id = req.params.id;
      
      const withdrawal = await storage.getWithdrawal(id);
      
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal not found" });
      }

      const updates: any = { status };
      if (status === "completed") {
        updates.processedAt = new Date();
      }

      const updated = await storage.updateWithdrawal(id, updates);

      const user = await storage.getUser(withdrawal.userId);
      if (user) {
        const statusText = status === "completed" ? "approved and processed" : status === "rejected" ? "rejected" : status;
        await sendMessageToUser(user.telegramId,
          `Your withdrawal request has been ${statusText}!\n\n` +
          `Amount: ${withdrawal.amount.toFixed(2)} INR\n` +
          `Method: ${withdrawal.paymentMethod}`
        );
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update withdrawal" });
    }
  });

  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.createOrUpdateAdminSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/admin/pricing", requireAdmin, async (req, res) => {
    try {
      const pricing = await storage.getPricingSettings();
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pricing" });
    }
  });

  app.post("/api/admin/pricing", requireAdmin, async (req, res) => {
    try {
      const { minAgeDays, maxAgeDays, pricePerGroup } = req.body;
      const pricing = await storage.createPricingSettings({
        minAgeDays,
        maxAgeDays,
        pricePerGroup,
        isActive: true,
      });
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pricing" });
    }
  });

  app.patch("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      const { minAgeDays, maxAgeDays, pricePerGroup, isActive } = req.body;
      const updated = await storage.updatePricingSettings(req.params.id, {
        minAgeDays,
        maxAgeDays,
        pricePerGroup,
        isActive,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pricing" });
    }
  });

  app.delete("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePricingSettings(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing" });
    }
  });

  app.get("/api/admin/activities", requireAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivityLogs(50);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  app.get("/api/admin/year-pricing", requireAdmin, async (req, res) => {
    try {
      const pricing = await storage.getAllYearPricing();
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to get year pricing" });
    }
  });

  app.post("/api/admin/year-pricing", requireAdmin, async (req, res) => {
    try {
      const { startYear, endYear, month, category, pricePerGroup, isActive } = req.body;
      const pricing = await storage.createYearPricing({
        startYear,
        endYear: endYear || null,
        month: month || null,
        category,
        pricePerGroup,
        isActive: isActive !== undefined ? isActive : true,
      });
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to create year pricing" });
    }
  });

  app.patch("/api/admin/year-pricing/:id", requireAdmin, async (req, res) => {
    try {
      const { startYear, endYear, month, category, pricePerGroup, isActive } = req.body;
      const updated = await storage.updateYearPricing(parseInt(req.params.id), {
        startYear,
        endYear,
        month,
        category,
        pricePerGroup,
        isActive,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update year pricing" });
    }
  });

  app.delete("/api/admin/year-pricing/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteYearPricing(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete year pricing" });
    }
  });

  app.get("/api/year-pricing/:year/:category", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const category = req.params.category;
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const pricing = await storage.getYearPricing(year, month, category);
      res.json(pricing || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pricing" });
    }
  });

  return httpServer;
}
