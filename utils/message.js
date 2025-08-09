import {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags
} from 'discord.js';

import { GetPingRolesForChannel, GetEmojiForStock, GetWeatherData, GetWeatherPingRoleForChannel, GetShopVisibilityData } from "./db.js";
import { GetRobuxAmountForSuperSeeds } from './predictors/infpack.js';
import { ExpiringCache } from "./cache.js";

const ShopVisibilityCache = new ExpiringCache(5 * 60 * 1000);

export const EmojiMappings = {
    "Seed": "🌱",
    "Weather": "☀️",
    "Egg": "🥚",
    "Gear": "🔨",
    "Admin Restock": "👑",

    // Discord Emojis
    "Super Seeds": process.env.DEV_MODE ? "<:SuperSeed:1400308630951170148>" : "<:SuperSeed:1400308536201969754>",
    "Robux": process.env.DEV_MODE ? "<:Robux:1400309384684240976>" : "<:Robux:1400309498538889259>",
}

export const ConnectorEmojis = {
    "End": process.env.DEV_MODE ? "<:end:1399422777433260123>" : "<:end:1398493116272742420>",
    "Connect": process.env.DEV_MODE ? "<:connect:1399422765039358073>" : "<:connect:1398493096748253195>",
}

/**
 * Creates a text display component.
 * @param {string} content - The content for the text display.
 * @returns {TextDisplayBuilder} The text display component.
 */
export const CreateText = (content) => {
    return new TextDisplayBuilder()
        .setContent(content);
}

/**
 * Creates an embed message.
 * @param {Object} data - The data for the embed message.
 * @returns {ContainerBuilder} The embed message container.
 */
export const CreateEmbed = (data) => {
    const { title, description, footer, ActionRow } = data;
    const ContainerComponent = new ContainerBuilder()
        .addTextDisplayComponents(
            CreateText(`## ${title}`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            CreateText(description)
        )

    if (footer) {
        ContainerComponent.addTextDisplayComponents(
            CreateText(`-# ${footer}`)
        )
    }

    ContainerComponent.addSeparatorComponents(new SeparatorBuilder());

    if (ActionRow) {
        const ButtonComponents = ActionRow.map(button => {
            return new ButtonBuilder()
                .setLabel(button.label)
                .setStyle(ButtonStyle.Link)
                .setURL(button.link);
        });

        const RestockActionRow = new ActionRowBuilder()
            .addComponents(...ButtonComponents);

        ContainerComponent.addActionRowComponents(RestockActionRow);
    }
    
    return ContainerComponent
}

/**
 * 
 * Creates a stock embed message for a restock.
 * 
 * @param {string} Type 
 * @param {Object} Data 
 * @param {number | undefined} ChannelID 
 * @returns 
 */
export const CreateStockEmbed = (Type, Data, ChannelID, Prefix, DisableJoinButton) => {
    const Display = GetShopVisibilityData(Type);

    let Description = "";
    if (!Data || Object.keys(Data).length === 0) {
        Description = "No stock data available.";
    } else {
        ShopVisibilityCache.CleanExpired();

        // Visibility filter: keep only items present in shop visibility list
        const isVisible = (name) => {
            if (!Array.isArray(Display) || Display.length === 0) return true;
            for (const item of Display) {
                if (item === name) return true;
                if (item && typeof item === 'object' && item.name === name) return true;
            }
            return false;
        };

        // Zero filter: hide entries with quantity <= 0 for display purposes
        const filteredEntries = Object.entries(Data).filter(([name, qty]) => Number(qty) > 0 && isVisible(name));

        if (filteredEntries.length === 0) {
            Description = "No stock data available.";
        } else {
            const cacheKey = `${Type}_${filteredEntries.map(([n]) => n).sort().join('_')}`;
            
            let sortedEntries;
            if (ShopVisibilityCache.Has(cacheKey)) {
                const cachedOrder = ShopVisibilityCache.Get(cacheKey);
                sortedEntries = filteredEntries.sort(([itemA], [itemB]) => {
                    const indexA = cachedOrder.indexOf(itemA);
                    const indexB = cachedOrder.indexOf(itemB);
                    return indexA - indexB;
                });
            } else {
                sortedEntries = filteredEntries.sort(([itemA], [itemB]) => {
                    const indexA = Display ? Display.findIndex(item => item === itemA || item.name === itemA) : -1;
                    const indexB = Display ? Display.findIndex(item => item === itemB || item.name === itemB) : -1;
                    
                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return -1;
                    if (indexB === -1) return 1;
                    
                    return indexA - indexB;
                });
                
                // Cache the sorted order
                const sortedOrder = sortedEntries.map(([itemName]) => itemName);
                ShopVisibilityCache.Set(cacheKey, sortedOrder);
            }

            // Build description with safety limit to avoid Discord payload size errors
            const MAX_DESCRIPTION_CHARS = 3500;
            let lines = [];
            let used = 0;
            for (let i = 0; i < sortedEntries.length; i++) {
                const [item_name, quantity] = sortedEntries[i];
                const connector = i === sortedEntries.length - 1 ? ConnectorEmojis.End : ConnectorEmojis.Connect;
                const emoji = GetEmojiForStock(item_name) || EmojiMappings[item_name] || "";
                const line = `${connector}**${emoji} ${item_name}** (x${quantity})`;

                // +1 for newline when joined later
                if (used + line.length + (lines.length > 0 ? 1 : 0) > MAX_DESCRIPTION_CHARS) {
                    const remaining = sortedEntries.length - i;
                    if (remaining > 0) {
                        lines.push(`${ConnectorEmojis.End}... and ${remaining} more item(s)`);
                    }
                    break;
                }
                lines.push(line);
                used += line.length + (lines.length > 1 ? 1 : 0);
            }
            Description = lines.join("\n");
        }
    }

    const EmbedOptions = {
        title: `${EmojiMappings[Type] == undefined ? "" : EmojiMappings[Type] + " "}${Prefix || ""}${Type} Stock`,
        description: Description,
    }

    if (DisableJoinButton == undefined || DisableJoinButton == false || DisableJoinButton == null)
        EmbedOptions["ActionRow"] = [
            {
                label: "Quick Join",
                link: "https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066"
            }
        ]

    const MessageData = {
        components: [
            CreateEmbed(EmbedOptions)
        ],
        flags: MessageFlags.IsComponentsV2
    }


    if (ChannelID) {
        const ping_roles = GetPingRolesForChannel(ChannelID, Type);

        let PingText = "";
        for (const role of ping_roles) {
            if (Data[role.name] === undefined) {
                continue;
            }

            PingText += `<@&${role.role_id}> `;
        }

        if (ping_roles.length !== 0 && PingText.length > 0) {
            MessageData.components.unshift(
                CreateText(`-# ${PingText}`)
            )
        }

        MessageData["allowed_mentions"] = {
            parse: ["roles"]
        }
    }
    return MessageData;
}

/**
 * 
 * Creates a stock embed message for weather or events.
 * 
 * @param {string} Type 
 * @param {Object} Data 
 * @param {number | undefined} ChannelID 
 * @returns 
 */
export const CreateEventEmbed = (EventType, Name, Timeout, ChannelID) => {
    const WeatherData = GetWeatherData();
    let Data = WeatherData.find(w => w.original_name === Name) || {
        emoji: "",
        name: Name,
    }

    const MessageData = {
        components: [
            CreateEmbed({
                title: `${EmojiMappings[EventType] == undefined ? "" : EmojiMappings[EventType] + " "}${EventType} Notifier`,
                description: EventType == "Weather" ? `The weather is now set to **"${Data.emoji ? Data.emoji + " " : ""}${Data.name}"**\nEnding <t:${Math.floor(Date.now() / 1000) + Timeout}:R> (${Timeout} seconds)` : `The **"${Data.emoji}${Data.name}"** special event has started.\nEnding <t:${Math.floor(Date.now() / 1000) + Timeout}:r> (${Timeout} seconds)`,
                ActionRow: [
                    {
                        label: "Quick Join",
                        link: "https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066"
                    }
                ]
            })
        ],
        flags: MessageFlags.IsComponentsV2
    }


    if (ChannelID) {
        const ping_role = GetWeatherPingRoleForChannel(ChannelID, Name);
        if (!ping_role) {
            return MessageData;
        }

        MessageData.components.unshift(
            CreateText(`-# <@&${ping_role}>`)
        );

        MessageData["allowed_mentions"] = {
            parse: ["roles"]
        }
    }
    return MessageData;
}

/**
 * 
 * Creates a current weather embed message.
 *
 * @param {Array<Object>} weatherData - The weather data to include in the embed.
 * @returns {ContainerBuilder} The current weather embed message container.
 */
export const CreateCurrentWeatherEmbed = (weatherData) => {
    const WeatherData = GetWeatherData();

    return {
        components: [
            CreateEmbed({
                title: `${EmojiMappings["Weather"]} Current Weather & Events`,
                description: weatherData.length > 0 ? weatherData.map(
                    w => {
                        const data = WeatherData.find(weather => weather.original_name === w.name) || {
                            emoji: "",
                            name: w.name,
                        };

                        let Prefix = "";
                        if (!data || !data.name || !data.emoji) {
                            Prefix = `**${w.name}**`;
                        } else {
                            Prefix = `**${data.emoji} ${data.name}**`;
                        }

                        return `${Prefix} - Ends <t:${w.created_at + w.timeout}:R> (${(w.created_at + w.timeout) - Math.floor(Date.now() / 1000)} seconds)`;
                    }
                ).join("\n") : `No current weather or events.`,
                ActionRow: [
                    {
                        label: "Quick Join",
                        link: "https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066"
                    }
                ]
            })
        ],
        flags: MessageFlags.IsComponentsV2
    }
}

/**
 * 
 * Creates an admin restock embed message.
 * 
 * @param {string} Type - The type of stock.
 * @param {string} Stock - The stock name.
 * @param {number} ChannelID - The channel ID to send the embed to.
 * @returns {ContainerBuilder} The admin restock embed message container.
 */
export const CreateAdminRestockEmbed = (Type, Stock, ChannelID) => {
    const MessageData = {
        components: [
            CreateEmbed({
                title: `${EmojiMappings["Admin Restock"]} Admin Restock`,
                description: `**${GetEmojiForStock(Stock)}${Stock}** has been restocked!`,
                ActionRow: [
                    {
                        label: "Quick Join",
                        link: "https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066"
                    }
                ]
            })
        ],
        flags: MessageFlags.IsComponentsV2
    }

    if (ChannelID) {
        const ping_roles = GetPingRolesForChannel(ChannelID, Type);

        let PingText = "";
        for (const role of ping_roles) {
            if (role.name === Stock) {
                PingText += `<@&${role.role_id}> `;
            }
        }

        if (ping_roles.length !== 0 && PingText.length > 0) {
            MessageData.components.unshift(
                CreateText(`-# ${PingText}`)
            )
        }

        MessageData["allowed_mentions"] = {
            parse: ["roles"]
        }
    }
    return MessageData;
}

/**
 * 
 * Creates a super seeds embed message.
 *
 * @param {number} count - The number of super seeds.
 * @returns {ContainerBuilder} The super seeds embed message container.
 */
export const CreateSuperSeedsEmbed = (count, date) => {
    const RobuxCost = Array.from({ length: count }, (_, i) => {
        const { price, paidTimes } = GetRobuxAmountForSuperSeeds(i + 1, date);
        return `Super Seed #${i + 1}: **${price.toLocaleString()}** ${EmojiMappings["Robux"]} (${paidTimes.toLocaleString()} reward${paidTimes === 1 ? "" : "s"} paid)`;
    })

    // compute tomorrow at 00:00 UTC:
    const now = date || new Date();
    const tomorrowUtcMidnight = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0
    );

    const SuperSeedEmbed = CreateEmbed({
        title: `${EmojiMappings["Super Seeds"]} Super Seeds ${now.getUTCMonth() + 1}/${now.getUTCDate()}`,
        description: `${RobuxCost.join("\n")}`,
    })

    if (!date) {
        SuperSeedEmbed
            .addTextDisplayComponents(
                CreateText(`-# The Forever Pack should reset <t:${Math.floor(tomorrowUtcMidnight / 1000)}:R>`)
            );
    }

    return {
        components: [
            SuperSeedEmbed
        ],
        flags: MessageFlags.IsComponentsV2
    }
}