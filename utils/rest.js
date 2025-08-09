import { ConcurrencyPool } from "./concurrencypool.js";
import Ratelimits from "../ratelimits.js";
import Logger from "../logger.js";
import { REST, Routes } from 'discord.js';
import { RemoveAllSubscriptionsForChannel } from "./db.js";

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DiscordREST = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
const MessageWorker = new ConcurrencyPool(Ratelimits.RequestsPerSecond, 1000);

// Global 429 handling: pause all sends when Discord indicates a global rate limit
let GlobalCooldownUntil = 0;
const WaitIfGlobalCooldown = async () => {
    const now = Date.now();
    if (now >= GlobalCooldownUntil) return;
    const delay = Math.max(0, GlobalCooldownUntil - now);
    await new Promise(r => setTimeout(r, delay));
}

/** 
 *   MassSendMessage is a function that sends messages to multiple Discord channels.
 *   It takes a Data object where each key is a channel ID and the value is the message content to send.
 */
export const MassSendMessage = async (Data) => {
    if (Object.keys(Data).length === 0) return;

    const Promises = Object.entries(Data).map(([channel_id, embed_data]) => {
        const SendMessageWorker = MessageWorker.execute(async () => {
            try {
                await WaitIfGlobalCooldown();
                let attempt = 0;
                const maxAttempts = 4;
                let lastErr;
                while (attempt < maxAttempts) {
                    attempt++;
                    const response = await fetch(`https://discord.com/api/channels/${channel_id}/messages`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bot ${process.env.BOT_TOKEN}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(embed_data)
                    });

                    if (response.ok) return response;

                    // Read body for diagnostics
                    let bodyText = "";
                    try { bodyText = await response.text(); } catch {}

                    // Handle rate limit or retryable errors
                    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
                        const isRateLimited = response.status === 429;
                        // Base backoff for 5xx; 429s should primarily honor server-provided delays
                        let retryAfterMs = Math.min(2000 * attempt, 8000);

                        let parsed = {};
                        try { parsed = JSON.parse(bodyText || '{}'); } catch {}

                        // Derive retry-after values from body and header
                        const bodyRetryAfterMs = typeof parsed.retry_after === 'number' && Number.isFinite(parsed.retry_after)
                            ? parsed.retry_after * 1000
                            : undefined;
                        const headerRaw = response.headers.get('retry-after');
                        const headerRetryAfterMs = headerRaw != null && headerRaw !== '' && Number.isFinite(Number(headerRaw))
                            ? Number(headerRaw) * 1000
                            : undefined;

                        if (isRateLimited) {
                            // Trust JSON body first; only fall back to header when body is missing
                            if (Number.isFinite(bodyRetryAfterMs)) {
                                retryAfterMs = bodyRetryAfterMs;
                            } else if (Number.isFinite(headerRetryAfterMs)) {
                                retryAfterMs = headerRetryAfterMs;
                            }
                        } else {
                            // For 5xx, optionally extend backoff with header if provided
                            if (Number.isFinite(headerRetryAfterMs)) {
                                retryAfterMs = Math.max(retryAfterMs, headerRetryAfterMs);
                            }
                        }

                        if (parsed.global) {
                            GlobalCooldownUntil = Date.now() + retryAfterMs;
                        }

                        Logger.warn(`Retrying send to ${channel_id} after ${retryAfterMs}ms (attempt ${attempt}/${maxAttempts}) due to ${response.status}. Body: ${(bodyText||"").slice(0,200)}`);
                        await new Promise(r => setTimeout(r, retryAfterMs));
                        continue;
                    }

                    // Auto-clean bad subscriptions on permanent errors
                    if (response.status === 403 || response.status === 404) {
                        Logger.error(`Cleaning subscriptions for channel ${channel_id} due to ${response.status}. Body: ${(bodyText||"").slice(0,200)}`);
                        try { RemoveAllSubscriptionsForChannel(channel_id); } catch {}
                    }

                    // Non-retryable
                    Logger.error(`Failed to send message to channel ${channel_id}: ${response.status} ${response.statusText} | Body: ${(bodyText||"").slice(0,400)}`);
                    return response;
                }
                throw lastErr || new Error('Exceeded max send attempts');
            } catch (err) {
                Logger.error(`Error sending message to channel ${channel_id}: ${err?.message || String(err)}`);
                throw err;
            }
        });

        return SendMessageWorker;
    });

    return Promise.allSettled(Promises);
}

/**
 *    UploadEmoji is a function that uploads an emoji to Discord.
 *    It takes an emoji name and image data, and returns the uploaded emoji data.
 *
 *    @param {string} emoji_name - The name of the emoji to upload.
 *    @param {string} emoji_image - The base64 encoded image data of the emoji.
 *    @returns {Promise<Object>} - The uploaded emoji data from Discord.
 */
export const UploadEmoji = async (emoji_name, emoji_image) => {
    const response = await fetch(`https://discord.com/api/v10/applications/${process.env.CLIENT_ID}/emojis`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.BOT_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: emoji_name,
            image: `data:image/png;base64,${emoji_image}`
        })
    })

    return response.json();
}

let AlreadyAlerted = [];

/**
 * GetSlashCommands is a function that retrieves all slash commands from the commands directory.
 * It scans the directory structure and imports each command file.
 */
export const GetSlashCommands = async () => {
    const FoldersPath = path.join(__dirname, '..', 'commands');
    const CommandFolders = fs.readdirSync(FoldersPath);
    const commands = [];
    
    for (const folder of CommandFolders) {
        const commandsPath = path.join(FoldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const output = await import(filePath);
                const command = output.default || output;

                if ('data' in command && 'execute' in command) {
                    commands.push(command.data);
                } else {
                    if (!AlreadyAlerted.includes(filePath)) {
                        AlreadyAlerted.push(filePath);
                        Logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
                    }
                }
            } catch (error) {
                Logger.error(`Failed to import command from ${filePath}: ${error.message}`);
            }
        }
    }

    return commands;
}

/**
 * * SynchronizeSlashCommands is a function that synchronizes the slash commands with Discord.
 * * It retrieves the commands using GetSlashCommands and updates them via Discord's REST API.
 * * It runs immediately to ensure the commands are up-to-date.
 */
export const SynchronizeSlashCommands = async () => {
    setImmediate(async () => {
        Logger.info('Synchronizing slash commands (/) with Discord...');

        try {
            const commands = await GetSlashCommands();
            await DiscordREST.put(
                Routes.applicationCommands(process.env.CLIENT_ID, 1307383623145623552),
                { body: commands.map(command => command.toJSON())}
            );

            Logger.info("");

            for (let i = 0; i < commands.length; i++) {
                Logger.info(`${i === 0 ? "┌" : i === commands.length - 1 ? "└" : "├"} ƒ /${commands[i].name}`);
            }

            Logger.info("");
            Logger.info(`Successfully synchronized ${commands.length} slash command(s).`);
            console.log();
            
        } catch (error) {
            Logger.error(`Failed to synchronize slash commands: ${error.message}`);
        }
    });
}