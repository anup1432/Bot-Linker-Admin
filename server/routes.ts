import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { initTelegramBot, getBotInfo } from "./telegram-bot";
import { telegramLoginSchema } from "@shared/schema";
import crypto from "crypto";

// Extend Express Request type
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

// Verify Telegram login data
function verifyTelegramAuth(data: Record<string, unknown>, botToken: string): boolean {
  const { hash, ...authData } = data;
  
  if (!hash || typeof hash !== "string") return false;
  
  // Create data-check-string
  const checkString = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key]}`)
    .join("\n");
  
  // Create secret key
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  
  // Calculate HMAC
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  
  return hmac === hash;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize session
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "telegram-bot-admin-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Initialize Telegram bot
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    initTelegramBot(botToken);
  }

  // ============ AUTH ROUTES ============

  // Get current user
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

  // Telegram login
  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        return res.status(500).json({ error: "Bot not configured" });
      }

      // Validate the data
      const parseResult = telegramLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid login data" });
      }

      const telegramData = parseResult.data;

      // Verify Telegram auth (skip in development for testing)
      if (process.env.NODE_ENV === "production") {
        if (!verifyTelegramAuth(req.body, botToken)) {
          return res.status(401).json({ error: "Invalid authentication" });
        }
      }

      // Check if auth is not too old (max 1 day)
      const authAge = Date.now() / 1000 - telegramData.auth_date;
      if (authAge > 86400) {
        return res.status(401).json({ error: "Authentication expired" });
      }

      // Find or create user
      let user = await storage.getUserByTelegramId(telegramData.id.toString());
      
      if (!user) {
        user = await storage.createUser({
          telegramId: telegramData.id.toString(),
          username: telegramData.username || null,
          firstName: telegramData.first_name || null,
          lastName: telegramData.last_name || null,
          photoUrl: telegramData.photo_url || null,
          authDate: telegramData.auth_date,
        });

        // Create default bot settings
        await storage.createBotSettings({
          userId: user.id,
          welcomeMessage: "Welcome! Send me a group invite link and I will track it for you.",
          verificationMessage: "Verification complete!",
          autoJoin: true,
          notifyOnJoin: true,
        });
      }

      // Set session
      req.session.userId = user.id;
      
      res.json({ user });
    } catch (error) {
      console.error("Telegram auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Logout
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

  // ============ STATS ============

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

  // ============ GROUPS ============

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

  app.post("/api/groups/:id/retry", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const group = await storage.getGroupJoin(id);
      
      if (!group || group.userId !== req.session.userId) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Update status to pending for retry
      const updated = await storage.updateGroupJoin(id, {
        status: "joined",
        joinedAt: new Date(),
        errorMessage: null,
      });

      // Log the retry
      await storage.createActivityLog({
        userId: req.session.userId!,
        action: "joined",
        description: `Retried joining group: ${group.groupLink}`,
        groupJoinId: id,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to retry join" });
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

  // ============ SETTINGS ============

  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      let settings = await storage.getBotSettings(req.session.userId!);
      
      // Create default settings if none exist
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

  return httpServer;
}
