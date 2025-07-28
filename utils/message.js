import {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags
} from 'discord.js';

import { GetPingRolesForChannel, GetEmojiForStock, GetWeatherData, GetWeatherPingRoleForChannel } from "./db.js";

export const EmojiMappings = {
    "Seed": "🌱",
    "Weather": "☀️",
    "Egg": "🥚",
    "Gear": "🔨",
    "Admin Restock": "👑",
}

export const ConnectorEmojis = {
    "End": "<:end:1398493116272742420>",
    "Connect": "<:connect:1398493096748253195>",
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
 * Creates a stock embed message.
 * 
 * @param {string} Type 
 * @param {Object} Data 
 * @param {number | undefined} ChannelID 
 * @returns 
 */
export const CreateStockEmbed = (Type, Data, ChannelID, Prefix) => {
    let Description = "";
    if (!Data || Object.keys(Data).length === 0) {
        Description = "No stock data available.";
    } else {
        Description = Object.entries(Data).map(([item_name, quantity], index) => {
            const connector = index === Object.keys(Data).length - 1 ? ConnectorEmojis.End : ConnectorEmojis.Connect;
            const emoji = GetEmojiForStock(item_name) || EmojiMappings[item_name] || "";

            return `${connector}**${emoji} ${item_name}** (x${quantity})`;
        }).join("\n")
    }

    const MessageData = {
        components: [
            CreateEmbed({
                title: `${EmojiMappings[Type] == undefined ? "" : EmojiMappings[Type] + " "}${Prefix || ""}${Type} Stock`,
                description: Description,
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
 * Creates a stock embed message.
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
                description: EventType == "Weather" ? `The weather is now set to **"${Data.emoji} ${Data.name}"**\nEnding <t:${Math.floor(Date.now() / 1000) + Timeout}:R> (${Timeout} seconds)` : `The **"${Data.emoji}${Data.name}"** special event has started.\nEnding <t:${Math.floor(Date.now() / 1000) + Timeout}:r> (${Timeout} seconds)`,
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

/** * Creates an admin restock embed message.
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