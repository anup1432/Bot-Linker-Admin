import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { initTelegramBot, getBotInfo, sendMessageToUser } from "./telegram-bot";
import { telegramLoginSchema } from "@shared/schema";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const PgStore = connectPgSimple(session);

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
    userId?: number;
  }
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Admin middleware
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

// Verify Telegram login data
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "telegram-bot-admin-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    initTelegramBot(botToken);
  }

  // ============ AUTH ROUTES ============

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

      // In production, verify Telegram auth. In dev, allow mock logins for testing
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

  // ============ MULTI-STEP REGISTRATION/LOGIN ============

  // Step 1: Request OTP for registration
  app.post("/api/auth/register/request-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number required" });
      }

      const settings = await storage.getAdminSettings();
      
      if (!settings?.twilioAccountSid || !settings?.twilioAuthToken || !settings?.twilioPhoneNumber) {
        // For dev mode, skip Twilio and auto-generate OTP
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

  // Step 2: Verify OTP
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

      // Mark as verified and store for registration
      registrationStore.set(sessionId, {
        phoneNumber: otpData.phoneNumber,
        verified: true,
        expiry: Date.now() + 10 * 60 * 1000, // 10 minutes to complete registration
      });

      otpStore.delete(sessionId);
      res.json({ success: true, message: "OTP verified" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Step 3 & 4: Complete registration with username and password
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

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Find or create user by phone number
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

      // Store password in admin settings
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

  // Login with username and password (for returning users)
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
      
      // Fallback to simple admin credentials
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
  
  // Check if user is already registered
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

  // ============ BOT INFO ============

  app.get("/api/bot/info", (req, res) => {
    const info = getBotInfo();
    if (!info) {
      return res.json({ username: "", firstName: "", isActive: false });
    }
    res.json(info);
  });

  // ============ USER STATS ============

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getGroupStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // ============ ACTIVITIES ============

  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getActivityLogs(req.session.userId!);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  // ============ USER GROUPS ============

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
      const id = parseInt(req.params.id);
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

  // ============ USER SETTINGS ============

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

  // ============ USER WITHDRAWALS ============

  app.get("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawals(req.session.userId!);
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get withdrawals" });
    }
  });

  // ============ NOTIFICATIONS ============

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const notifications = await storage.getNotifications(user?.isAdmin ? undefined : req.session.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(parseInt(req.params.id));
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      await storage.markAllNotificationsRead(user?.isAdmin ? undefined : req.session.userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  // ============ ADMIN ROUTES ============

  // Admin dashboard stats
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

  // Admin - Get all users
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Admin - Update user
  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { isAdmin, balance } = req.body;
      const updated = await storage.updateUser(parseInt(req.params.id), { isAdmin, balance });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Admin - Get all groups
  app.get("/api/admin/groups", requireAdmin, async (req, res) => {
    try {
      const groups = await storage.getAllGroupJoins();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get groups" });
    }
  });

  // Admin - Update group (verify, set age, etc)
  app.patch("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const { groupAge, verificationStatus, ownershipTransferred, paymentAmount, errorMessage } = req.body;
      const id = parseInt(req.params.id);
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
        
        // Add payment to user balance
        await storage.updateUserBalance(group.userId, paymentAmount);
        
        // Notify user
        const user = await storage.getUser(group.userId);
        if (user) {
          await sendMessageToUser(user.telegramId,
            `Payment added to your account!\n\n` +
            `Group: ${group.groupLink}\n` +
            `Amount: +${paymentAmount.toFixed(2)} INR\n\n` +
            `Check your balance with /balance`
          );
        }

        // Create activity log
        await storage.createActivityLog({
          userId: group.userId,
          action: "payment_added",
          description: `Payment of ${paymentAmount} INR added for group: ${group.groupLink}`,
          groupJoinId: group.id,
        });
      }
      if (errorMessage !== undefined) updates.errorMessage = errorMessage;

      const updated = await storage.updateGroupJoin(id, updates);

      // Notify user about status change
      const user = await storage.getUser(group.userId);
      if (user && verificationStatus) {
        if (verificationStatus === "approved") {
          await sendMessageToUser(user.telegramId,
            `Your group has been verified!\n\n` +
            `Group: ${group.groupLink}\n` +
            `Status: Approved (A)\n` +
            `Age: ${groupAge || group.groupAge} days\n\n` +
            `Next: Transfer ownership to complete the process.`
          );
        } else if (verificationStatus === "rejected") {
          await sendMessageToUser(user.telegramId,
            `Your group was rejected.\n\n` +
            `Group: ${group.groupLink}\n` +
            `Reason: ${errorMessage || "Does not meet requirements"}`
          );
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating group:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  // Admin - Get all withdrawals
  app.get("/api/admin/withdrawals", requireAdmin, async (req, res) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get withdrawals" });
    }
  });

  // Admin - Process withdrawal
  app.patch("/api/admin/withdrawals/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const withdrawal = await storage.updateWithdrawal(parseInt(req.params.id), {
        status,
        processedAt: status === "completed" ? new Date() : undefined,
      });

      // Notify user
      if (withdrawal) {
        const user = await storage.getUser(withdrawal.userId);
        if (user) {
          if (status === "completed") {
            await sendMessageToUser(user.telegramId,
              `Withdrawal processed!\n\n` +
              `Amount: ${withdrawal.amount.toFixed(2)} INR\n` +
              `Method: ${withdrawal.paymentMethod}\n\n` +
              `Payment has been sent to your account.`
            );
          } else if (status === "rejected") {
            // Refund balance
            await storage.updateUserBalance(user.id, withdrawal.amount);
            await sendMessageToUser(user.telegramId,
              `Withdrawal request rejected.\n\n` +
              `Amount: ${withdrawal.amount.toFixed(2)} INR has been refunded to your balance.`
            );
          }
        }
      }

      res.json(withdrawal);
    } catch (error) {
      res.status(500).json({ error: "Failed to process withdrawal" });
    }
  });

  // Admin - Pricing settings
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
      const { minAgeDays, maxAgeDays, pricePerGroup, isActive } = req.body;
      const pricing = await storage.createPricingSettings({
        minAgeDays,
        maxAgeDays: maxAgeDays || null,
        pricePerGroup,
        isActive: isActive ?? true,
      });
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pricing" });
    }
  });

  app.patch("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      const { minAgeDays, maxAgeDays, pricePerGroup, isActive } = req.body;
      const pricing = await storage.updatePricingSettings(parseInt(req.params.id), {
        minAgeDays,
        maxAgeDays,
        pricePerGroup,
        isActive,
      });
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pricing" });
    }
  });

  app.delete("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePricingSettings(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing" });
    }
  });

  // Admin - Global settings (sanitized - no sensitive data exposed)
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      if (!settings) {
        return res.json({});
      }
      const sanitizedSettings = {
        id: settings.id,
        requiredChannelId: settings.requiredChannelId,
        requiredChannelUsername: settings.requiredChannelUsername,
        welcomeMessage: settings.welcomeMessage,
        minGroupAgeDays: settings.minGroupAgeDays,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      };
      res.json(sanitizedSettings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get admin settings" });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const { requiredChannelId, requiredChannelUsername, welcomeMessage, minGroupAgeDays } = req.body;
      const settings = await storage.createOrUpdateAdminSettings({
        requiredChannelId,
        requiredChannelUsername,
        welcomeMessage,
        minGroupAgeDays: minGroupAgeDays || 30,
      });
      const sanitizedSettings = {
        id: settings.id,
        requiredChannelId: settings.requiredChannelId,
        requiredChannelUsername: settings.requiredChannelUsername,
        welcomeMessage: settings.welcomeMessage,
        minGroupAgeDays: settings.minGroupAgeDays,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      };
      res.json(sanitizedSettings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update admin settings" });
    }
  });

  // Admin - Activity logs
  app.get("/api/admin/activities", requireAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivityLogs();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activities" });
    }
  });

  // ============ ADMIN AUTH & OTP ROUTES ============

  // Get admin settings (sanitized - no credentials exposed)
  app.get("/api/admin/auth-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json({
        adminPhoneNumber: settings?.adminPhoneNumber || "",
        hasPassword: !!settings?.adminPassword,
        hasTwilioCredentials: !!(settings?.twilioAccountSid && settings?.twilioAuthToken && settings?.twilioPhoneNumber),
        otpEnabled: settings?.otpEnabled || false,
        twoStepEnabled: settings?.twoStepEnabled || false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get auth settings" });
    }
  });

  // Update admin phone number
  app.post("/api/admin/phone", requireAdmin, async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number required" });
      }
      await storage.createOrUpdateAdminSettings({ adminPhoneNumber: phoneNumber });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update phone number" });
    }
  });

  // Update admin password
  app.post("/api/admin/password", requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.createOrUpdateAdminSettings({ adminPassword: hashedPassword });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // Update Twilio credentials
  app.post("/api/admin/twilio", requireAdmin, async (req, res) => {
    try {
      const { accountSid, authToken, phoneNumber } = req.body;
      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ error: "All Twilio credentials required" });
      }
      await storage.createOrUpdateAdminSettings({
        twilioAccountSid: accountSid,
        twilioAuthToken: authToken,
        twilioPhoneNumber: phoneNumber,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update Twilio credentials" });
    }
  });

  // Toggle OTP/2-step
  app.post("/api/admin/security-toggle", requireAdmin, async (req, res) => {
    try {
      const { otpEnabled, twoStepEnabled } = req.body;
      const settings = await storage.getAdminSettings();
      
      if (otpEnabled && !settings?.twilioAccountSid) {
        return res.status(400).json({ error: "Configure Twilio credentials first" });
      }
      if (twoStepEnabled && !settings?.adminPassword) {
        return res.status(400).json({ error: "Set password first" });
      }
      if ((otpEnabled || twoStepEnabled) && !settings?.adminPhoneNumber) {
        return res.status(400).json({ error: "Set phone number first" });
      }

      await storage.createOrUpdateAdminSettings({
        otpEnabled: otpEnabled ?? settings?.otpEnabled ?? false,
        twoStepEnabled: twoStepEnabled ?? settings?.twoStepEnabled ?? false,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update security settings" });
    }
  });

  // ============ ADMIN LOGIN WITH OTP ============

  // Check if admin login is configured
  app.get("/api/admin-login/check", async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json({
        isConfigured: !!(settings?.adminPhoneNumber && settings?.twilioAccountSid),
        otpEnabled: settings?.otpEnabled || false,
        twoStepEnabled: settings?.twoStepEnabled || false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check admin login" });
    }
  });

  // Request OTP for admin login
  app.post("/api/admin-login/request-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      const settings = await storage.getAdminSettings();
      
      if (!settings?.adminPhoneNumber || settings.adminPhoneNumber !== phoneNumber) {
        return res.status(401).json({ error: "Phone number not registered" });
      }
      
      if (!settings.otpEnabled) {
        return res.status(400).json({ error: "OTP not enabled" });
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
      res.status(500).json({ error: "Failed to request OTP" });
    }
  });

  // Verify OTP for admin login
  app.post("/api/admin-login/verify-otp", async (req, res) => {
    try {
      const { sessionId, otp, password } = req.body;
      const settings = await storage.getAdminSettings();
      
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

      if (settings?.twoStepEnabled && settings?.adminPassword) {
        if (!password) {
          return res.status(400).json({ error: "Password required", needsPassword: true });
        }
        const validPassword = await bcrypt.compare(password, settings.adminPassword);
        if (!validPassword) {
          return res.status(401).json({ error: "Invalid password" });
        }
      }

      otpStore.delete(sessionId);

      const adminUsers = await storage.getAllUsers();
      const adminUser = adminUsers.find(u => u.isAdmin);
      
      if (adminUser) {
        req.session.userId = adminUser.id;
        res.json({ success: true, user: adminUser });
      } else {
        res.status(500).json({ error: "No admin user found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  return httpServer;
}
