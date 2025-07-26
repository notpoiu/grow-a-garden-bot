import { GetSubscribedChannels, GetPingRolesForChannel } from "./db.js";
import { ConcurrencyPool } from "./concurrencypool.js";
import Ratelimits from "../ratelimits.js";
import { ContainerBuilder, TextDisplayBuilder, ButtonBuilder, MessageFlags, ButtonStyle, ActionRowBuilder } from 'discord.js';

const MessageWorker = new ConcurrencyPool(Ratelimits.RequestsPerSecond, 1000);

const QuickJoinButton = new ButtonBuilder()
    .setLabel("Quick Join")
    .setStyle(ButtonStyle.Link)
    .setURL("https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066")

const RestockActionRow = new ActionRowBuilder()
    .addComponents(QuickJoinButton)

const EmojiMappings = {
    "Seed": "🌱",
    "Weather": "☀️",
    "Gear": "🔨",
}

const ConnectorEmojis = {
    "End": "<end:1398493116272742420>",
    "Connect": "<connect:1398493096748253195>",
}

export const MassSendStockMessage = async (stock_type, message_type, restock_data) => {
    const channels = GetSubscribedChannels(stock_type);
    if (channels.length === 0) return;
    
    const Promises = channels.map(channel => {
        // Ping Roles
        const ping_roles = GetPingRolesForChannel(channel.channel_id, stock_type);

        let PingText = "";
        for (const role of ping_roles) {
            if (restock_data[role.name] === undefined) {
                continue;
            }

            PingText += `<@&${role.role_id}> `;
        }

        // Build the message content
        const PingTextComponent = new TextDisplayBuilder()
            .setContent(`-# ${PingText}`);

        const ContainerComponent = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`## ${EmojiMappings[stock_type]} ${stock_type} Stock Updated!`)
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        Object.entries(restock_data).map(([item_name, quantity], index) => {
                            const connector = index === Object.keys(restock_data).length - 1 ? ConnectorEmojis.End : ConnectorEmojis.Connect;
                            return `${connector}**${item_name}** (x${quantity})`;
                        }).join("\n")
                    )
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `-# This is stock as of <t:${Math.floor(Date.now() / 1000)}>`
                    )
            )
            .addActionRowComponents(RestockActionRow)

        const DataToSend = {
            components: [
                PingTextComponent,
                ContainerComponent
            ],
            flags: MessageFlags.IsComponentsV2
        }

        const SendMessageWorker = MessageWorker.execute(() => {
            return fetch(`https://discord.com/api/channels/${channel.channel_id}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${process.env.BOT_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(DataToSend)
            });
        });

        return SendMessageWorker
    });

    return Promise.allSettled(Promises)
}

export const MassSendWeatherMessage = async (weather_type, duration) => {
    const channels = GetSubscribedChannels('weather');
    if (channels.length === 0) return;

    const Promises = channels.map(channel => {
        // GetPingRolesForChannel(weather_type, channel.channel_id);
        const ping_roles = GetPingRolesForChannel(channel.channel_id, 'weather');
        let PingText = "";
        for (const role of ping_roles) {
            PingText += `<@&${role.role_id}> `;
        }

        const PingTextComponent = new TextDisplayBuilder()
            .setContent(`-# ${PingText}`);
        
        const ContainerComponent = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`## ${EmojiMappings['Weather']} Weather Update: ${weather_type}`)
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `The current weather is **${weather_type}** (Ends in ${duration} or <t:${Math.floor(Date.now() / 1000) + duration}>).`
                    )
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        `-# This weather update was sent at <t:${Math.floor(Date.now() / 1000)}>`
                    )
            )
            .addActionRowComponents(RestockActionRow);
        
        const DataToSend = {
            components: [
                PingTextComponent,
                ContainerComponent
            ],
            flags: MessageFlags.IsComponentsV2
        }

        const SendMessageWorker = MessageWorker.execute(() => {
            return fetch(`https://discord.com/api/channels/${channel.channel_id}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${process.env.BOT_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(DataToSend)
            });
        });

        return SendMessageWorker
    });

    return Promise.allSettled(Promises)
}

export const UploadEmoji = async (emoji_name, emoji_image) => {
    const response = await fetch(`https://discord.com/api/v10/applications/${process.env.APP_ID}/emojis`, {
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
