import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "./storage";
import type { UserSession } from "@shared/schema";
import CryptoJS from "crypto-js";

const getEncryptionKey = (): string => {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long for secure encryption");
  }
  return key;
};

const activeClients: Map<string, TelegramClient> = new Map();
const pendingSessions: Map<string, {
  step: "api_id" | "api_hash" | "phone" | "code" | "password";
  apiId?: string;
  apiHash?: string;
  phoneNumber?: string;
  client?: TelegramClient;
  phoneCodeHash?: string;
  userId?: string;
}> = new Map();

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(text, key, { iv: iv });
  return iv.toString() + ":" + encrypted.toString();
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted format");
  }
  const iv = CryptoJS.enc.Hex.parse(parts[0]);
  const encrypted = parts[1];
  const decrypted = CryptoJS.AES.decrypt(encrypted, key, { iv: iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export function getSessionState(telegramId: string) {
  return pendingSessions.get(telegramId);
}

export function startSession(telegramId: string, userId: string) {
  pendingSessions.set(telegramId, { step: "api_id", userId });
  return { step: "api_id", message: "Please enter your API ID:\n\n(You can get your API ID from my.telegram.org)" };
}

export async function processSessionStep(
  telegramId: string, 
  userId: string,
  input: string
): Promise<{ step: string; message: string; success?: boolean; error?: string }> {
  const state = pendingSessions.get(telegramId);
  
  if (!state) {
    return { step: "none", message: "Session not started. Use /session to start." };
  }

  switch (state.step) {
    case "api_id":
      if (!/^\d+$/.test(input.trim())) {
        return { step: "api_id", message: "Invalid API ID. Please enter a valid number:" };
      }
      state.apiId = input.trim();
      state.step = "api_hash";
      pendingSessions.set(telegramId, state);
      return { step: "api_hash", message: "Please enter your API Hash:" };

    case "api_hash":
      if (input.trim().length < 10) {
        return { step: "api_hash", message: "Invalid API Hash. Please enter a valid hash:" };
      }
      state.apiHash = input.trim();
      state.step = "phone";
      pendingSessions.set(telegramId, state);
      return { step: "phone", message: "Please enter your phone number (with country code, e.g., +91XXXXXXXXXX):" };

    case "phone":
      const phoneNumber = input.trim().replace(/\s+/g, "");
      if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
        return { step: "phone", message: "Invalid phone number. Please enter with country code (e.g., +91XXXXXXXXXX):" };
      }
      
      state.phoneNumber = phoneNumber;
      
      try {
        const stringSession = new StringSession("");
        const client = new TelegramClient(
          stringSession, 
          parseInt(state.apiId!), 
          state.apiHash!, 
          {
            connectionRetries: 5,
          }
        );
        
        await client.connect();
        
        const result = await client.sendCode(
          { apiId: parseInt(state.apiId!), apiHash: state.apiHash! },
          phoneNumber
        );
        
        state.client = client;
        state.phoneCodeHash = result.phoneCodeHash;
        state.step = "code";
        pendingSessions.set(telegramId, state);
        
        return { 
          step: "code", 
          message: "OTP sent to your Telegram. Please enter the code you received:" 
        };
      } catch (error: any) {
        console.error("Error sending code:", error);
        pendingSessions.delete(telegramId);
        return { 
          step: "error", 
          message: `Failed to send OTP: ${error.message}. Please try /session again.`,
          error: error.message
        };
      }

    case "code":
      const code = input.trim().replace(/\s+/g, "");
      if (!/^\d{5,6}$/.test(code)) {
        return { step: "code", message: "Invalid code. Please enter the 5-6 digit code:" };
      }
      
      try {
        const client = state.client!;
        
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: state.phoneNumber!,
            phoneCodeHash: state.phoneCodeHash!,
            phoneCode: code,
          })
        );
        
        const sessionString = (client.session as StringSession).save();
        
        const existingSession = await storage.getUserSessionByTelegramId(telegramId);
        
        if (existingSession) {
          await storage.updateUserSession(existingSession.id, {
            apiId: encrypt(state.apiId!),
            apiHash: encrypt(state.apiHash!),
            phoneNumber: encrypt(state.phoneNumber!),
            sessionString: encrypt(sessionString),
            isActive: true,
            updatedAt: new Date(),
          });
        } else {
          await storage.createUserSession({
            userId,
            telegramId,
            apiId: encrypt(state.apiId!),
            apiHash: encrypt(state.apiHash!),
            phoneNumber: encrypt(state.phoneNumber!),
            sessionString: encrypt(sessionString),
            isActive: true,
          });
        }
        
        activeClients.set(telegramId, client);
        pendingSessions.delete(telegramId);
        
        return { 
          step: "complete", 
          message: "Session created successfully! Your account is now connected as a userbot.\n\nYou can now send group links and I will join them using your account to check the group age.",
          success: true
        };
      } catch (error: any) {
        console.error("Error signing in:", error);
        
        if (error.message?.includes("SESSION_PASSWORD_NEEDED")) {
          state.step = "password";
          pendingSessions.set(telegramId, state);
          return { 
            step: "password", 
            message: "Two-factor authentication is enabled. Please enter your 2FA password:" 
          };
        }
        
        pendingSessions.delete(telegramId);
        return { 
          step: "error", 
          message: `Failed to sign in: ${error.message}. Please try /session again.`,
          error: error.message
        };
      }

    case "password":
      try {
        const client = state.client!;
        
        await client.signInWithPassword(
          { apiId: parseInt(state.apiId!), apiHash: state.apiHash! },
          { 
            password: async () => input.trim(),
            onError: (err: Error) => { throw err; }
          }
        );
        
        const sessionString = (client.session as StringSession).save();
        
        const existingSession = await storage.getUserSessionByTelegramId(telegramId);
        
        if (existingSession) {
          await storage.updateUserSession(existingSession.id, {
            apiId: encrypt(state.apiId!),
            apiHash: encrypt(state.apiHash!),
            phoneNumber: encrypt(state.phoneNumber!),
            sessionString: encrypt(sessionString),
            isActive: true,
            updatedAt: new Date(),
          });
        } else {
          await storage.createUserSession({
            userId,
            telegramId,
            apiId: encrypt(state.apiId!),
            apiHash: encrypt(state.apiHash!),
            phoneNumber: encrypt(state.phoneNumber!),
            sessionString: encrypt(sessionString),
            isActive: true,
          });
        }
        
        activeClients.set(telegramId, client);
        pendingSessions.delete(telegramId);
        
        return { 
          step: "complete", 
          message: "Session created successfully! Your account is now connected.\n\nYou can now send group links and I will join them using your account.",
          success: true
        };
      } catch (error: any) {
        console.error("Error with 2FA:", error);
        pendingSessions.delete(telegramId);
        return { 
          step: "error", 
          message: `2FA authentication failed: ${error.message}. Please try /session again.`,
          error: error.message
        };
      }

    default:
      return { step: "none", message: "Unknown state. Please use /session to start again." };
  }
}

export function cancelSession(telegramId: string) {
  const state = pendingSessions.get(telegramId);
  if (state?.client) {
    try {
      state.client.disconnect();
    } catch (e) {}
  }
  pendingSessions.delete(telegramId);
}

export async function getActiveClient(telegramId: string, userId?: string): Promise<TelegramClient | null> {
  if (activeClients.has(telegramId)) {
    const client = activeClients.get(telegramId)!;
    if (client.connected) {
      return client;
    }
    activeClients.delete(telegramId);
  }
  
  const session = await storage.getUserSessionByTelegramId(telegramId);
  if (!session || !session.isActive || !session.sessionString) {
    return null;
  }
  
  if (userId && session.userId !== userId) {
    console.error("User ID mismatch for session");
    return null;
  }
  
  try {
    const apiId = parseInt(decrypt(session.apiId));
    const apiHash = decrypt(session.apiHash);
    const sessionString = decrypt(session.sessionString);
    
    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
    
    await client.connect();
    
    if (!client.connected) {
      console.error("Failed to connect client");
      await storage.updateUserSession(session.id, { isActive: false });
      return null;
    }
    
    activeClients.set(telegramId, client);
    await storage.updateUserSession(session.id, { lastUsed: new Date() });
    
    return client;
  } catch (error) {
    console.error("Error connecting client:", error);
    await storage.updateUserSession(session.id, { isActive: false });
    return null;
  }
}

export async function joinGroupAndGetInfo(
  telegramId: string, 
  groupLink: string
): Promise<{
  success: boolean;
  groupId?: string;
  groupName?: string;
  groupAge?: number;
  memberCount?: number;
  error?: string;
}> {
  const client = await getActiveClient(telegramId);
  
  if (!client) {
    return { success: false, error: "No active session. Please use /session to connect your account." };
  }
  
  try {
    let inviteHash: string | null = null;
    let username: string | null = null;
    
    const joinChatMatch = groupLink.match(/t\.me\/joinchat\/([a-zA-Z0-9_-]+)/);
    const plusMatch = groupLink.match(/t\.me\/\+([a-zA-Z0-9_-]+)/);
    const usernameMatch = groupLink.match(/t\.me\/([a-zA-Z0-9_]+)$/);
    
    if (joinChatMatch) {
      inviteHash = joinChatMatch[1];
    } else if (plusMatch) {
      inviteHash = plusMatch[1];
    } else if (usernameMatch && !["joinchat"].includes(usernameMatch[1].toLowerCase())) {
      username = usernameMatch[1];
    }
    
    let chat: any;
    
    if (inviteHash) {
      try {
        const checkResult = await client.invoke(
          new Api.messages.CheckChatInvite({ hash: inviteHash })
        );
        
        if (checkResult instanceof Api.ChatInviteAlready) {
          chat = checkResult.chat;
        } else if (checkResult instanceof Api.ChatInvite) {
          const joinResult = await client.invoke(
            new Api.messages.ImportChatInvite({ hash: inviteHash })
          ) as any;
          
          if (joinResult?.chats && joinResult.chats.length > 0) {
            chat = joinResult.chats[0];
          }
        }
      } catch (error: any) {
        if (error.message?.includes("INVITE_HASH_EXPIRED")) {
          return { success: false, error: "This invite link has expired." };
        }
        if (error.message?.includes("USER_ALREADY_PARTICIPANT")) {
          const dialogs = await client.getDialogs({});
          for (const dialog of dialogs) {
            if (dialog.entity && "title" in dialog.entity) {
              chat = dialog.entity;
              break;
            }
          }
        }
        throw error;
      }
    } else if (username) {
      try {
        const entity = await client.getEntity(username);
        chat = entity;
        
        if (chat instanceof Api.Channel || chat instanceof Api.Chat) {
          try {
            await client.invoke(
              new Api.channels.JoinChannel({ channel: chat })
            );
          } catch (e: any) {
            if (!e.message?.includes("USER_ALREADY_PARTICIPANT")) {
              throw e;
            }
          }
        }
      } catch (error: any) {
        if (error.message?.includes("USERNAME_NOT_OCCUPIED")) {
          return { success: false, error: "This group/channel doesn't exist." };
        }
        throw error;
      }
    } else {
      return { success: false, error: "Invalid group link format." };
    }
    
    if (!chat) {
      return { success: false, error: "Could not get group information." };
    }
    
    let groupAge = 0;
    let groupName = "";
    let groupId = "";
    let memberCount = 0;
    
    if (chat instanceof Api.Channel || chat instanceof Api.Chat) {
      groupId = chat.id.toString();
      groupName = (chat as any).title || "";
      
      if (chat instanceof Api.Channel) {
        memberCount = (chat as any).participantsCount || 0;
      }
      
      const creationDate = (chat as any).date;
      if (creationDate) {
        const createdAt = new Date(creationDate * 1000);
        const now = new Date();
        groupAge = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    
    return {
      success: true,
      groupId,
      groupName,
      groupAge,
      memberCount,
    };
  } catch (error: any) {
    console.error("Error joining group:", error);
    return { success: false, error: error.message || "Failed to join group." };
  }
}

export async function checkOwnership(
  telegramId: string,
  groupId: string
): Promise<{ isOwner: boolean; error?: string }> {
  const client = await getActiveClient(telegramId);
  
  if (!client) {
    return { isOwner: false, error: "No active session." };
  }
  
  try {
    const result = await client.invoke(
      new Api.channels.GetParticipant({
        channel: groupId,
        participant: "me",
      })
    );
    
    const participant = result.participant;
    
    if (participant instanceof Api.ChannelParticipantCreator) {
      return { isOwner: true };
    }
    
    return { isOwner: false };
  } catch (error: any) {
    console.error("Error checking ownership:", error);
    return { isOwner: false, error: error.message };
  }
}

export async function disconnectClient(telegramId: string) {
  const client = activeClients.get(telegramId);
  if (client) {
    try {
      await client.disconnect();
    } catch (e) {}
    activeClients.delete(telegramId);
  }
  
  const session = await storage.getUserSessionByTelegramId(telegramId);
  if (session) {
    await storage.updateUserSession(session.id, { isActive: false });
  }
}
