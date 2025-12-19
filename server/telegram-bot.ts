import TelegramBot from "node-telegram-bot-api";
import { storage, UserData } from "./mongo-storage";
import { 
  startSession, 
  processSessionStep, 
  getSessionState, 
  cancelSession,
  joinGroupAndGetInfo,
  getActiveClient,
  checkOwnership,
  startAdminSession,
  processAdminSessionStep,
  extractGroupYearAndMonth,
  classifyGroupType
} from "./userbot-manager";

let bot: TelegramBot | null = null;
let botInfo: { username: string; firstName: string } | null = null;

export function initTelegramBot(token: string): TelegramBot | null {
  if (!token) {
    console.log("No Telegram bot token provided");
    return null;
  }

  if (bot) {
    try {
      bot.stopPolling();
      bot.removeAllListeners();
    } catch (e) {
      console.log("Error stopping existing bot polling:", e);
    }
    bot = null;
  }
  
  if (process.env.NODE_ENV === 'production') {
    console.log("Using webhook mode for Telegram bot in production");
  }

  try {
    bot = new TelegramBot(token, { 
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 10
        }
      }
    });

    bot.getMe().then((info) => {
      botInfo = {
        username: info.username || "",
        firstName: info.first_name,
      };
      console.log(`Telegram bot started: @${info.username}`);
    }).catch((error) => {
      console.error("Failed to get bot info:", error.message);
    });

    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const username = msg.from?.username;
      const firstName = msg.from?.first_name;
      const lastName = msg.from?.last_name;
      
      if (!userId) return;

      const adminSettings = await storage.getAdminSettings();
      const adminUserId = process.env.ADMIN_USER_ID;
      const isAdminUser = adminUserId && userId.toString() === adminUserId;
      
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
          isAdmin: isAdminUser || false,
          channelVerified: false,
        });

        await storage.createNotification({
          userId: null,
          type: "new_user",
          title: "New User Joined",
          message: `${firstName || username || "User"} (@${username || userId}) joined the bot`,
          isRead: false,
          data: JSON.stringify({ telegramId: userId }),
        });
      } else if (isAdminUser && !user.isAdmin) {
        await storage.updateUser(user.id, { isAdmin: true });
        user.isAdmin = true;
      }

      const welcomeMessage = adminSettings?.welcomeMessage || 
        "Welcome to Group Trading Bot!\n\n" +
        "Send me your group invite link and I'll verify it for you.";

      if (adminSettings?.requiredChannelUsername) {
        const channelUsername = adminSettings.requiredChannelUsername.replace("@", "");
        
        try {
          const member = await bot?.getChatMember(`@${channelUsername}`, userId);
          const isMember = member && ["member", "administrator", "creator"].includes(member.status);
          
          if (isMember) {
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

    bot.onText(/\/price/, async (msg) => {
      const chatId = msg.chat.id;
      
      try {
        const priceItems = await storage.getAllPriceItems();
        
        if (priceItems.length === 0) {
          await bot?.sendMessage(chatId, "📋 Price list is currently empty.");
          return;
        }

        let priceMessage = "💰 <b>Price List</b>\n\n";
        
        for (const item of priceItems) {
          let statusIcon = "❌";
          if (item.status === "on") statusIcon = "✅";
          if (item.status === "not now") statusIcon = "⏳";
          
          priceMessage += `${statusIcon} <b>${item.name}</b>\n`;
          
          if (item.status === "off") {
            priceMessage += `Status: Not available\n\n`;
          } else if (item.status === "not now") {
            if (item.price) {
              priceMessage += `Price: ₹${item.price}\n`;
              priceMessage += `Status: Coming soon\n\n`;
            } else {
              priceMessage += `Status: Coming soon\n\n`;
            }
          } else {
            if (item.price) {
              priceMessage += `Price: ₹${item.price}\n`;
            }
            if (item.description) {
              priceMessage += `Info: ${item.description}\n`;
            }
            priceMessage += "\n";
          }
        }
        
        await bot?.sendMessage(chatId, priceMessage, { parse_mode: "HTML" });
      } catch (error) {
        console.error("Error fetching price list:", error);
        await bot?.sendMessage(chatId, "Error loading price list. Please try again later.");
      }
    });

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

      const parts = paymentInfo.trim().split(" ");
      const method = parts[0]?.toUpperCase();
      const details = parts.slice(1).join(" ");

      if (!method || !details) {
        await bot?.sendMessage(chatId, "Invalid format. Please use:\n/payout UPI your_upi_id\nor\n/payout BANK details");
        return;
      }

      const withdrawal = await storage.createWithdrawal({
        userId: user.id,
        amount: balance,
        paymentMethod: method,
        paymentDetails: details,
        status: "pending",
      });

      await storage.updateUser(user.id, { balance: 0 });

      await storage.createNotification({
        userId: null,
        type: "withdrawal_request",
        title: "New Withdrawal Request",
        message: `${user.firstName || user.username || "User"} requested withdrawal of ${balance.toFixed(2)} INR via ${method}`,
        isRead: false,
        data: JSON.stringify({ withdrawalId: withdrawal.id, oduserId: user.id }),
      });

      await bot?.sendMessage(chatId,
        `Withdrawal request submitted!\n\n` +
        `Amount: ${balance.toFixed(2)} INR\n` +
        `Method: ${method}\n` +
        `Details: ${details}\n\n` +
        `Your request will be processed soon.`
      );
    });

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

    bot.onText(/\/addsession/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      if (!user.isAdmin) {
        await bot?.sendMessage(chatId, "This command is only available for admins.");
        return;
      }

      const existingSession = await storage.getUserSessionByTelegramId("admin_session");
      if (existingSession?.isActive) {
        await bot?.sendMessage(chatId,
          "Admin session already exists and is active.\n\n" +
          "Send /removesession to remove the current session."
        );
        return;
      }

      const result = startAdminSession(userId.toString());
      await bot?.sendMessage(chatId, result.message);
    });

    bot.onText(/\/removesession/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user || !user.isAdmin) {
        await bot?.sendMessage(chatId, "This command is only available for admins.");
        return;
      }

      cancelSession(userId.toString());
      
      const session = await storage.getUserSessionByTelegramId("admin_session");
      if (session) {
        await storage.updateUserSession(session.id, { isActive: false });
      }

      await bot?.sendMessage(chatId,
        "Admin session has been removed.\n\n" +
        "Use /addsession to add a new session."
      );
    });

    bot.onText(/\/addsession2/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      if (!user.isAdmin) {
        await bot?.sendMessage(chatId, "This command is only available for admins.");
        return;
      }

      const existingSession = await storage.getUserSessionByTelegramId("admin_session_2");
      if (existingSession?.isActive) {
        await bot?.sendMessage(chatId,
          "🤖 Second userbot session already exists and is active.\n\n" +
          "Send /removesession2 to remove the current session."
        );
        return;
      }

      const result = startAdminSession(userId.toString(), "admin_session_2");
      await bot?.sendMessage(chatId, 
        "🤖 <b>Setting up Second Userbot</b>\n\n" +
        result.message,
        { parse_mode: "HTML" }
      );
    });

    bot.onText(/\/removesession2/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user || !user.isAdmin) {
        await bot?.sendMessage(chatId, "This command is only available for admins.");
        return;
      }

      cancelSession("admin_session_2");
      
      const session = await storage.getUserSessionByTelegramId("admin_session_2");
      if (session) {
        await storage.updateUserSession(session.id, { isActive: false });
      }

      await bot?.sendMessage(chatId,
        "🤖 Second userbot session has been removed.\n\n" +
        "Use /addsession2 to add a new second userbot session."
      );
    });

    bot.onText(/\/sessions/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user || !user.isAdmin) {
        await bot?.sendMessage(chatId, "This command is only available for admins.");
        return;
      }

      const session1 = await storage.getUserSessionByTelegramId("admin_session");
      const session2 = await storage.getUserSessionByTelegramId("admin_session_2");

      let message = "🤖 <b>Active Userbots</b>\n\n";
      
      message += "1️⃣ <b>Primary Userbot (A)</b>\n";
      if (session1?.isActive) {
        message += "✅ Active\n";
        message += `Phone: ${session1.phoneNumber || "Not set"}\n`;
        message += `Telegram ID: ${session1.telegramId}\n`;
      } else {
        message += "❌ Not configured\n";
        message += "Use /addsession to add\n";
      }
      
      message += "\n2️⃣ <b>Secondary Userbot (Verification)</b>\n";
      if (session2?.isActive) {
        message += "✅ Active\n";
        message += `Phone: ${session2.phoneNumber || "Not set"}\n`;
        message += `Telegram ID: ${session2.telegramId}\n`;
      } else {
        message += "❌ Not configured\n";
        message += "Use /addsession2 to add\n";
      }

      message += "\n<b>How it works:</b>\n";
      message += "1. Primary bot joins group & sends 'A' message\n";
      message += "2. Secondary bot verifies group (used/unused)\n";
      message += "3. If verified, admin transfers ownership\n";
      message += "4. Payment added to balance\n";

      await bot?.sendMessage(chatId, message, { parse_mode: "HTML" });
    });

    bot.onText(/\/cancel/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      if (!userId) return;

      const state = getSessionState(userId.toString());
      if (state) {
        cancelSession(userId.toString());
        await bot?.sendMessage(chatId, "Session setup cancelled.");
      } else {
        await bot?.sendMessage(chatId, "No ongoing session setup to cancel.");
      }
    });

    bot.on("message", async (msg) => {
      if (msg.text?.startsWith("/")) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      const text = msg.text || "";
      const messageId = msg.message_id;

      if (!userId) return;

      const sessionState = getSessionState(userId.toString());
      if (sessionState) {
        const user = await storage.getUserByTelegramId(userId.toString());
        if (!user) {
          await bot?.sendMessage(chatId, "Please /start the bot first.");
          return;
        }

        const result = await processAdminSessionStep(userId.toString(), text);
        await bot?.sendMessage(chatId, result.message);
        return;
      }

      const groupLinkRegex = /https?:\/\/t\.me\/(?:joinchat\/[\w-]+|\+[\w-]+|[\w_]+)/gi;
      const links = text.match(groupLinkRegex);

      if (!links || links.length === 0) return;

      const user = await storage.getUserByTelegramId(userId.toString());
      
      if (!user) {
        await bot?.sendMessage(chatId, "Please /start the bot first.");
        return;
      }

      if (!user.channelVerified) {
        const adminSettings = await storage.getAdminSettings();
        if (adminSettings?.requiredChannelUsername) {
          await bot?.sendMessage(chatId,
            "Please join our channel first and click /start again."
          );
          return;
        }
      }

      const adminSession = await storage.getUserSessionByTelegramId("admin_session");
      if (!adminSession || !adminSession.isActive) {
        await bot?.sendMessage(chatId,
          "Session not configured. Please contact admin to add session using /addsession command."
        );
        return;
      }

      const adminSettings = await storage.getAdminSettings();
      const minAgeDays = adminSettings?.minGroupAgeDays || 30;

      for (const link of links) {
        await bot?.sendMessage(chatId,
          `Processing group link...\n\n` +
          `Link: ${link}\n` +
          `Status: Joining and checking age...`
        );

        const groupInfo = await joinGroupAndGetInfo("admin_session", link);

        if (!groupInfo.success) {
          const groupJoin = await storage.createGroupJoin({
            userId: user.id,
            groupLink: link,
            groupName: null,
            groupId: null,
            groupAge: null,
            status: "failed",
            verificationStatus: "rejected",
            ownershipTransferred: false,
            paymentAdded: false,
            paymentAmount: null,
            errorMessage: groupInfo.error || "Failed to join group",
          });

          await storage.createActivityLog({
            userId: user.id,
            action: "group_join_failed",
            description: `Failed to join group: ${link} - ${groupInfo.error}`,
            groupJoinId: groupJoin.id,
          });

          await bot?.sendMessage(chatId,
            `Failed to process group!\n\n` +
            `Link: ${link}\n` +
            `Error: ${groupInfo.error}\n\n` +
            `Please check if the link is valid and try again.`
          );
          continue;
        }

        const groupAge = groupInfo.groupAge || 0;
        const deletedMessages = groupInfo.messageCount || 0;
        const isOldEnough = groupAge >= minAgeDays;
        const verificationStatus = isOldEnough ? "approved" : "rejected";
        const groupType = classifyGroupType(deletedMessages);
        const createdDate = new Date();
        createdDate.setDate(createdDate.getDate() - groupAge);
        const { year, month } = extractGroupYearAndMonth(createdDate);

        const groupJoin = await storage.createGroupJoin({
          userId: user.id,
          groupLink: link,
          groupName: groupInfo.groupName || null,
          groupId: groupInfo.groupId || null,
          groupAge: groupAge,
          groupYear: year,
          groupMonth: month,
          messageCount: groupInfo.messageCount || null,
          groupType: groupType,
          status: "joined",
          verificationStatus: verificationStatus,
          ownershipTransferred: false,
          paymentAdded: false,
          paymentAmount: null,
          errorMessage: null,
        });

        await storage.createActivityLog({
          userId: user.id,
          action: "group_joined",
          description: `Joined group: ${groupInfo.groupName || link} (${groupAge} days old)`,
          groupJoinId: groupJoin.id,
        });

        await storage.createNotification({
          userId: null,
          type: "new_group",
          title: "New Group Joined",
          message: `${user.firstName || user.username || "User"} joined group: ${groupInfo.groupName || link} (${groupAge} days old)`,
          isRead: false,
          data: JSON.stringify({ groupJoinId: groupJoin.id }),
        });

        if (isOldEnough) {
          const typeIcon = groupType === "used" ? "✓" : "⊘";
          const typeLabel = groupType === "used" ? "Used Group" : "Unused Group";
          const yearMonthInfo = year && month ? `${year}/${month}` : (year ? `${year}` : "Unknown");
          
          let priceInfo = "Price: Not configured";
          let priceComparisonMsg = "";
          let currentPrice = 0;
          
          try {
            // Use year-based pricing - check for specific month first (for 2024), then year range
            let yearPricing = null;
            const otherType = groupType === "used" ? "unused" : "used";
            let otherTypePricing = null;
            
            if (year) {
              // For 2024+, try monthly pricing first if month is available
              if (year >= 2024 && month) {
                yearPricing = await storage.getYearPricing(year, month, groupType);
                otherTypePricing = await storage.getYearPricing(year, month, otherType);
                
                // If monthly pricing not found or inactive, fall back to yearly
                if (!yearPricing || !yearPricing.isActive) {
                  yearPricing = await storage.getYearPricing(year, null, groupType);
                }
                if (!otherTypePricing || !otherTypePricing.isActive) {
                  otherTypePricing = await storage.getYearPricing(year, null, otherType);
                }
              } else {
                // For years before 2024 or when month not available, use year-only pricing
                // This will match year ranges like 2016-2022
                yearPricing = await storage.getYearPricing(year, null, groupType);
                otherTypePricing = await storage.getYearPricing(year, null, otherType);
              }
            }
            
            console.log(`[PRICING] Year: ${year}, Month: ${month}, Group type: ${groupType}`);
            console.log(`[PRICING] Year pricing found:`, yearPricing);
            console.log(`[PRICING] Other type pricing found:`, otherTypePricing);
            
            if (yearPricing && yearPricing.isActive) {
              priceInfo = `Price: ₹${yearPricing.pricePerGroup}`;
              currentPrice = yearPricing.pricePerGroup;
              
              if (groupType === "used" && otherTypePricing && otherTypePricing.isActive) {
                console.log(`[PRICING] Comparing: Used ₹${yearPricing.pricePerGroup} vs Unused ₹${otherTypePricing.pricePerGroup}`);
                if (yearPricing.pricePerGroup < otherTypePricing.pricePerGroup) {
                  priceComparisonMsg = `Group is used - Price is low. If you want to sell, here's your price: ₹${yearPricing.pricePerGroup}`;
                  console.log(`[PRICING] Used price is lower - showing comparison message`);
                }
              }
            } else {
              priceInfo = "Price: Not configured for this year";
            }
          } catch (e) {
            console.log("Could not fetch year pricing:", e);
          }
          
          let messageText = `Group Verified! (A)\n\n` +
            `Group: ${groupInfo.groupName || link}\n` +
            `Type: ${typeIcon} ${typeLabel}\n` +
            `${priceInfo}\n` +
            `Age: ${yearMonthInfo}\n` +
            `Members: ${groupInfo.memberCount || "Unknown"}\n\n`;
            
          if (priceComparisonMsg) {
            messageText += `${priceComparisonMsg}\n\n`;
          } else {
            messageText += `This group is approved!\n\n`;
          }
          
          messageText += `Next step: Transfer ownership of this group to our account.\n` +
            `Once you transfer ownership, send /checkowner to verify and receive payment.`;
          
          await bot?.sendMessage(chatId, messageText,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: "I've Transferred Ownership", callback_data: `check_owner_${groupJoin.id}` }
                ]]
              }
            }
          );

          await storage.updateGroupJoin(groupJoin.id, {
            verifiedAt: new Date(),
            paymentAmount: null,
          });
        } else {
          await bot?.sendMessage(chatId,
            `Group Not Approved\n\n` +
            `Group: ${groupInfo.groupName || link}\n` +
            `Type: ${groupType === "used" ? "✓" : "⊘"} ${groupType === "used" ? "Used Group" : "Unused Group"}\n\n` +
            `❌ Group is too new!\nMinimum required age: ${minAgeDays} days\nGroup age: ${groupAge} days`
          );
        }
      }
    });

    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id;
      const userId = query.from.id;
      const data = query.data;

      if (!chatId || !data) return;

      if (data.startsWith("verify_group_")) {
        const groupId = data.replace("verify_group_", "");
        await handleGroupVerification(chatId, userId, groupId);
      }

      if (data.startsWith("check_owner_")) {
        const groupJoinId = data.replace("check_owner_", "");
        await handleOwnershipCheck(chatId, userId, groupJoinId);
      }

      await bot?.answerCallbackQuery(query.id);
    });

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
  const group = await storage.getGroupJoin(groupId);
  if (!group) return;

  await storage.updateGroupJoin(groupId, {
    verificationStatus: "approved",
    verifiedAt: new Date(),
  });

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

async function handleOwnershipCheck(chatId: number, userId: number, groupJoinId: string) {
  const group = await storage.getGroupJoin(groupJoinId);
  if (!group) {
    await bot?.sendMessage(chatId, "Group not found.");
    return;
  }

  const user = await storage.getUser(group.userId);
  if (!user || user.telegramId !== userId.toString()) {
    await bot?.sendMessage(chatId, "You don't have permission to check this group.");
    return;
  }

  if (!group.groupId) {
    await bot?.sendMessage(chatId, "Group ID not found. Please submit the link again.");
    return;
  }

  await bot?.sendMessage(chatId, "Checking ownership status...");

  const ownershipResult = await checkOwnership("admin_session", group.groupId);

  if (ownershipResult.isOwner) {
    // Use year-based pricing for payment
    let paymentAmount = 50; // default
    const groupYear = group.groupYear;
    const groupMonth = group.groupMonth;
    const groupType = group.groupType || "unused";
    
    try {
      let yearPricing = null;
      
      if (groupYear) {
        // For 2024+, try monthly pricing first if month is available
        if (groupYear >= 2024 && groupMonth) {
          yearPricing = await storage.getYearPricing(groupYear, groupMonth, groupType);
          
          // If monthly pricing not found or inactive, fall back to yearly
          if (!yearPricing || !yearPricing.isActive) {
            yearPricing = await storage.getYearPricing(groupYear, null, groupType);
          }
        } else {
          // For years before 2024 or when month not available, use year-only pricing
          // This will match year ranges like 2016-2022
          yearPricing = await storage.getYearPricing(groupYear, null, groupType);
        }
      }
      
      if (yearPricing && yearPricing.isActive) {
        paymentAmount = yearPricing.pricePerGroup;
      }
      
      console.log(`[OWNERSHIP] Year: ${groupYear}, Month: ${groupMonth}, Type: ${groupType}, Price: ${paymentAmount}`);
    } catch (e) {
      console.log("Could not fetch year pricing for ownership:", e);
    }

    await storage.updateGroupJoin(groupJoinId, {
      ownershipTransferred: true,
      ownershipVerifiedAt: new Date(),
      paymentAdded: true,
      paymentAmount: paymentAmount,
    });

    await storage.updateUserBalance(user.id, paymentAmount);

    await storage.createActivityLog({
      userId: user.id,
      action: "ownership_verified",
      description: `Ownership verified for group: ${group.groupLink}. Payment: ${paymentAmount} INR`,
      groupJoinId: group.id,
    });

    await storage.createNotification({
      userId: null,
      type: "ownership_verified",
      title: "Ownership Verified",
      message: `${user.firstName || user.username || "User"} transferred ownership of group. Payment: ${paymentAmount} INR`,
      isRead: false,
      data: JSON.stringify({ groupJoinId: group.id }),
    });

    await bot?.sendMessage(chatId,
      `Ownership Verified!\n\n` +
      `Group: ${group.groupLink}\n` +
      `Payment Added: +${paymentAmount.toFixed(2)} INR\n\n` +
      `Your new balance: ${((user.balance || 0) + paymentAmount).toFixed(2)} INR\n\n` +
      `Use /withdraw to withdraw your earnings.`
    );
  } else {
    await bot?.sendMessage(chatId,
      `Ownership not verified!\n\n` +
      `It seems you haven't transferred ownership yet.\n` +
      `Please make sure you've transferred the group ownership and try again.\n\n` +
      `Error: ${ownershipResult.error || "Not the owner"}`
    );
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "approved": return "(A)";
    case "rejected": return "(R)";
    case "pending": return "(P)";
    default: return "(?)";
  }
}

export function getBotInfo() {
  if (!botInfo) return null;
  return { ...botInfo, isActive: bot !== null };
}

export async function sendMessageToUser(telegramId: string, message: string) {
  if (!bot) return false;
  try {
    await bot.sendMessage(telegramId, message);
    return true;
  } catch (error) {
    console.error("Failed to send message:", error);
    return false;
  }
}
