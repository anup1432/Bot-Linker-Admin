import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { initTelegramBot, getBotInfo, sendMessageToUser } from "./telegram-bot";
import { telegramLoginSchema } from "@shared/schema";
import crypto from "crypto";

declare module "express-session" {
  interface SessionData {
    userId?: string;
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

      if (process.env.NODE_ENV === "production") {
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
      const { id } = req.params;
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
      const notification = await storage.markNotificationRead(req.params.id);
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
      const updated = await storage.updateUser(req.params.id, { isAdmin, balance });
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
      
      const group = await storage.getGroupJoin(req.params.id);
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

      const updated = await storage.updateGroupJoin(req.params.id, updates);

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
      const withdrawal = await storage.updateWithdrawal(req.params.id, {
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
      const pricing = await storage.updatePricingSettings(req.params.id, {
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
      await storage.deletePricingSettings(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing" });
    }
  });

  // Admin - Global settings
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAdminSettings();
      res.json(settings || {});
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
      res.json(settings);
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

  return httpServer;
}
