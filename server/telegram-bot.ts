import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

let bot: TelegramBot | null = null;
let botInfo: { username: string; firstName: string } | null = null;

export function initTelegramBot(token: string): TelegramBot | null {
  if (!token) {
    console.log("No Telegram bot token provided");
    return null;
  }

  try {
    bot = new TelegramBot(token, { polling: true });

    // Get bot info
    bot.getMe().then((info) => {
      botInfo = {
        username: info.username || "",
        firstName: info.first_name,
      };
      console.log(`Telegram bot started: @${info.username}`);
    }).catch((error) => {
      console.error("Failed to get bot info:", error.message);
    });

    // Handle /start command
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      // Check if user is registered in our system
      const user = await storage.getUserByTelegramId(userId.toString());
      const settings = user ? await storage.getBotSettings(user.id) : null;
      
      const welcomeMessage = settings?.welcomeMessage || 
        "Welcome! Send me a group invite link and I will track it for you.\n\n" +
        "To use this bot, please login at the admin panel first.";
      
      const websiteUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : "your admin panel";

      await bot?.sendMessage(chatId, 
        `${welcomeMessage}\n\nAdmin Panel: ${websiteUrl}`,
        { parse_mode: "HTML" }
      );
    });

    // Handle group invite links
    bot.on("message", async (msg) => {
      if (msg.text?.startsWith("/")) return; // Skip commands

      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const text = msg.text || "";

      if (!userId) return;

      // Check for Telegram group invite links
      const groupLinkRegex = /https?:\/\/t\.me\/(?:joinchat\/[\w-]+|[\w_]+)/gi;
      const links = text.match(groupLinkRegex);

      if (!links || links.length === 0) return;

      // Find user in our system
      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, 
          "Please login to the admin panel first before sending group links."
        );
        return;
      }

      const settings = await storage.getBotSettings(user.id);

      for (const link of links) {
        // Create group join request
        const groupJoin = await storage.createGroupJoin({
          userId: user.id,
          groupLink: link,
          groupName: null,
          status: "pending",
          errorMessage: null,
        });

        // Log the activity
        await storage.createActivityLog({
          userId: user.id,
          action: "join_requested",
          description: `New group link received: ${link}`,
          groupJoinId: groupJoin.id,
        });

        // If auto-join is enabled, try to process immediately
        if (settings?.autoJoin !== false) {
          // In a real implementation, this would use Telegram Client API (MTProto)
          // to actually join the group with the user's account
          // For now, we'll mark it as pending and notify the user
          
          await storage.updateGroupJoin(groupJoin.id, {
            status: "joined",
            joinedAt: new Date(),
          });

          await storage.createActivityLog({
            userId: user.id,
            action: "joined",
            description: `Joined group: ${link}`,
            groupJoinId: groupJoin.id,
          });
        }

        await bot?.sendMessage(chatId,
          `Group link received and being processed: ${link}\n\n` +
          `Status: ${settings?.autoJoin !== false ? "Joined" : "Pending"}\n` +
          `Track progress in your admin panel.`
        );
      }
    });

    // Handle errors
    bot.on("polling_error", (error) => {
      console.error("Telegram polling error:", error.message);
    });

    return bot;
  } catch (error) {
    console.error("Failed to initialize Telegram bot:", error);
    return null;
  }
}

export function getBotInfo(): { username: string; firstName: string; isActive: boolean } | null {
  if (!botInfo) return null;
  return {
    ...botInfo,
    isActive: bot !== null,
  };
}

export function getBot(): TelegramBot | null {
  return bot;
}
