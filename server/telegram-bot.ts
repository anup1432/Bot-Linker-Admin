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
      const username = msg.from?.username;
      const firstName = msg.from?.first_name;
      const lastName = msg.from?.last_name;
      
      if (!userId) return;

      // Get admin settings
      const adminSettings = await storage.getAdminSettings();
      
      // Check if user exists, if not create them
      let user = await storage.getUserByTelegramId(userId.toString());
      if (!user) {
        user = await storage.createUser({
          telegramId: userId.toString(),
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          photoUrl: null,
          authDate: Math.floor(Date.now() / 1000),
          balance: 0,
          isAdmin: false,
          channelVerified: false,
        });

        // Notify admin about new user
        await storage.createNotification({
          userId: null,
          type: "new_user",
          title: "New User Joined",
          message: `${firstName || username || "User"} (@${username || userId}) joined the bot`,
          isRead: false,
          data: JSON.stringify({ telegramId: userId }),
        });
      }

      const welcomeMessage = adminSettings?.welcomeMessage || 
        "Welcome to Group Trading Bot!\n\n" +
        "Send me your group invite link and I'll verify it for you.";

      // Check if channel verification is required
      if (adminSettings?.requiredChannelUsername) {
        const channelUsername = adminSettings.requiredChannelUsername.replace("@", "");
        
        // Check if user is member of required channel
        try {
          const member = await bot?.getChatMember(`@${channelUsername}`, userId);
          const isMember = member && ["member", "administrator", "creator"].includes(member.status);
          
          if (isMember) {
            // Update user as verified
            await storage.updateUser(user.id, { channelVerified: true });
            
            await bot?.sendMessage(chatId,
              `${welcomeMessage}\n\n` +
              `Channel Verified!\n\n` +
              `Commands:\n` +
              `/balance - Check your balance\n` +
              `/withdraw - Withdraw your earnings\n` +
              `/mygroups - View your submitted groups\n` +
              `/help - Get help`,
              { parse_mode: "HTML" }
            );
          } else {
            await bot?.sendMessage(chatId,
              `${welcomeMessage}\n\n` +
              `Please join our channel first to use this bot:\n` +
              `https://t.me/${channelUsername}\n\n` +
              `After joining, click /start again.`,
              { 
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [[
                    { text: "Join Channel", url: `https://t.me/${channelUsername}` }
                  ]]
                }
              }
            );
          }
        } catch (error) {
          // Can't check membership, assume not verified
          await bot?.sendMessage(chatId,
            `${welcomeMessage}\n\n` +
            `Please join our channel first:\n` +
            `https://t.me/${channelUsername}\n\n` +
            `After joining, click /start again.`,
            { 
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[
                  { text: "Join Channel", url: `https://t.me/${channelUsername}` }
                ]]
              }
            }
          );
        }
      } else {
        // No channel verification required
        await storage.updateUser(user.id, { channelVerified: true });
        
        await bot?.sendMessage(chatId,
          `${welcomeMessage}\n\n` +
          `Commands:\n` +
          `/balance - Check your balance\n` +
          `/withdraw - Withdraw your earnings\n` +
          `/mygroups - View your submitted groups\n` +
          `/help - Get help`,
          { parse_mode: "HTML" }
        );
      }
    });

    // Handle /balance command
    bot.onText(/\/balance/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      const balance = user.balance || 0;
      await bot?.sendMessage(chatId,
        `Your current balance: ${balance.toFixed(2)} INR\n\n` +
        `Use /withdraw to withdraw your earnings.`,
        { parse_mode: "HTML" }
      );
    });

    // Handle /withdraw command
    bot.onText(/\/withdraw/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      const balance = user.balance || 0;

      if (balance <= 0) {
        await bot?.sendMessage(chatId,
          "Your balance is 0. You don't have any earnings to withdraw yet.\n\n" +
          "Submit group links and complete ownership transfer to earn!"
        );
        return;
      }

      await bot?.sendMessage(chatId,
        `Your balance: ${balance.toFixed(2)} INR\n\n` +
        `To withdraw, please send your payment details in this format:\n\n` +
        `/payout UPI your_upi_id@bank\n` +
        `or\n` +
        `/payout BANK Account_Number IFSC_Code Name`,
        { parse_mode: "HTML" }
      );
    });

    // Handle /payout command
    bot.onText(/\/payout (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const paymentInfo = match?.[1];
      
      if (!userId || !paymentInfo) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      const balance = user.balance || 0;

      if (balance <= 0) {
        await bot?.sendMessage(chatId, "Your balance is 0. Nothing to withdraw.");
        return;
      }

      // Parse payment method
      const parts = paymentInfo.trim().split(" ");
      const method = parts[0]?.toUpperCase();
      const details = parts.slice(1).join(" ");

      if (!method || !details) {
        await bot?.sendMessage(chatId, "Invalid format. Please use:\n/payout UPI your_upi_id\nor\n/payout BANK details");
        return;
      }

      // Create withdrawal request
      const withdrawal = await storage.createWithdrawal({
        userId: user.id,
        amount: balance,
        paymentMethod: method,
        paymentDetails: details,
        status: "pending",
      });

      // Reset user balance
      await storage.updateUser(user.id, { balance: 0 });

      // Notify admin
      await storage.createNotification({
        userId: null,
        type: "withdrawal_request",
        title: "New Withdrawal Request",
        message: `${user.firstName || user.username || "User"} requested withdrawal of ${balance.toFixed(2)} INR via ${method}`,
        isRead: false,
        data: JSON.stringify({ withdrawalId: withdrawal.id, userId: user.id }),
      });

      await bot?.sendMessage(chatId,
        `Withdrawal request submitted!\n\n` +
        `Amount: ${balance.toFixed(2)} INR\n` +
        `Method: ${method}\n` +
        `Details: ${details}\n\n` +
        `Your request will be processed soon.`
      );
    });

    // Handle /mygroups command
    bot.onText(/\/mygroups/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      const groups = await storage.getRecentGroupJoins(user.id, 10);

      if (groups.length === 0) {
        await bot?.sendMessage(chatId, "You haven't submitted any groups yet.\n\nSend me a group invite link to get started!");
        return;
      }

      let message = "Your recent group submissions:\n\n";
      
      for (const group of groups) {
        const status = getStatusEmoji(group.verificationStatus || "pending");
        const age = group.groupAge ? `${group.groupAge} days old` : "Age pending";
        const payment = group.paymentAdded ? `+${group.paymentAmount?.toFixed(2)} INR` : "";
        
        message += `${status} ${group.groupLink}\n`;
        message += `   Age: ${age}\n`;
        if (group.ownershipTransferred) {
          message += `   Ownership: Transferred\n`;
        }
        if (payment) {
          message += `   Payment: ${payment}\n`;
        }
        message += "\n";
      }

      await bot?.sendMessage(chatId, message);
    });

    // Handle /help command
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      
      await bot?.sendMessage(chatId,
        `How to use this bot:\n\n` +
        `1. Send me a Telegram group invite link\n` +
        `2. I'll verify the group age\n` +
        `3. If approved (A), transfer ownership to our account\n` +
        `4. Once ownership is verified, payment will be added to your balance\n` +
        `5. Withdraw your earnings anytime!\n\n` +
        `Commands:\n` +
        `/start - Start the bot\n` +
        `/balance - Check your balance\n` +
        `/withdraw - Withdraw earnings\n` +
        `/mygroups - View your groups\n` +
        `/help - This message`,
        { parse_mode: "HTML" }
      );
    });

    // Handle group invite links
    bot.on("message", async (msg) => {
      if (msg.text?.startsWith("/")) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const text = msg.text || "";

      if (!userId) return;

      // Check for Telegram group invite links
      const groupLinkRegex = /https?:\/\/t\.me\/(?:joinchat\/[\w-]+|\+[\w-]+|[\w_]+)/gi;
      const links = text.match(groupLinkRegex);

      if (!links || links.length === 0) return;

      // Find user in our system
      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      // Check if user is channel verified
      if (!user.channelVerified) {
        const adminSettings = await storage.getAdminSettings();
        if (adminSettings?.requiredChannelUsername) {
          await bot?.sendMessage(chatId,
            "Please join our channel first and click /start again."
          );
          return;
        }
      }

      const adminSettings = await storage.getAdminSettings();
      const minAgeDays = adminSettings?.minGroupAgeDays || 30;

      for (const link of links) {
        // Create group join request
        const groupJoin = await storage.createGroupJoin({
          userId: user.id,
          groupLink: link,
          groupName: null,
          groupId: null,
          groupAge: null,
          status: "pending",
          verificationStatus: "pending",
          ownershipTransferred: false,
          paymentAdded: false,
          paymentAmount: null,
          errorMessage: null,
        });

        // Log the activity
        await storage.createActivityLog({
          userId: user.id,
          action: "group_submitted",
          description: `New group link submitted: ${link}`,
          groupJoinId: groupJoin.id,
        });

        // Notify admin
        await storage.createNotification({
          userId: null,
          type: "new_group",
          title: "New Group Submitted",
          message: `${user.firstName || user.username || "User"} submitted a group: ${link}`,
          isRead: false,
          data: JSON.stringify({ groupJoinId: groupJoin.id }),
        });

        await bot?.sendMessage(chatId,
          `Group link received!\n\n` +
          `Link: ${link}\n` +
          `Status: Pending verification\n\n` +
          `We will check if the group is at least ${minAgeDays} days old.\n` +
          `You'll receive an update once verified.`
        );
      }
    });

    // Handle callback queries (for inline buttons)
    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id;
      const userId = query.from.id;
      const data = query.data;

      if (!chatId || !data) return;

      // Handle different callback actions
      if (data.startsWith("verify_group_")) {
        const groupId = data.replace("verify_group_", "");
        await handleGroupVerification(chatId, userId, groupId);
      }

      await bot?.answerCallbackQuery(query.id);
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

async function handleGroupVerification(chatId: number, userId: number, groupId: string) {
  // This would be called when admin verifies a group
  const group = await storage.getGroupJoin(groupId);
  if (!group) return;

  // Update group status
  await storage.updateGroupJoin(groupId, {
    verificationStatus: "approved",
    verifiedAt: new Date(),
  });

  // Notify user
  const user = await storage.getUser(group.userId);
  if (user && bot) {
    await bot.sendMessage(parseInt(user.telegramId),
      `Your group has been verified!\n\n` +
      `Group: ${group.groupLink}\n` +
      `Status: Approved (A)\n\n` +
      `Next step: Transfer ownership to our account.\n` +
      `Once ownership is verified, payment will be added to your balance.`
    );
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "approved": return "A";
    case "rejected": return "R";
    case "pending": return "P";
    default: return "?";
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

// Send message to user
export async function sendMessageToUser(telegramId: string, message: string): Promise<boolean> {
  if (!bot) return false;
  
  try {
    await bot.sendMessage(telegramId, message, { parse_mode: "HTML" });
    return true;
  } catch (error) {
    console.error("Failed to send message:", error);
    return false;
  }
}
