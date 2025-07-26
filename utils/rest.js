import { ConcurrencyPool } from "./concurrencypool.js";
import Ratelimits from "../ratelimits.js";
import Logger from "../logger.js";
import { REST, Routes } from 'discord.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MessageWorker = new ConcurrencyPool(Ratelimits.RequestsPerSecond, 1000);
const DiscordREST = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

/** 
 *   MassSendMessage is a function that sends messages to multiple Discord channels.
 *   It takes a Data object where each key is a channel ID and the value is the message content to send.
 */
export const MassSendMessage = async (Data) => {
    if (Object.keys(Data).length === 0) return;

    const Promises = Object.entries(Data).map(([channel_id, embed_data]) => {
        const SendMessageWorker = MessageWorker.execute(() => {
            return fetch(`https://discord.com/api/channels/${channel_id}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${process.env.BOT_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(embed_data)
            });
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
                    Logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
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

            Logger.success(`Successfully synchronized ${commands.length} slash command(s).`);
        } catch (error) {
            Logger.error(`Failed to synchronize slash commands: ${error.message}`);
        }
    });
}