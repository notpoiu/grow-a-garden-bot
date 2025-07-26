import { GetSubscribedChannels, GetPingRolesForChannel } from "./db.js";
import { ConcurrencyPool } from "./concurrencypool.js";
import Ratelimits from "../ratelimits.js";
import { ContainerBuilder, TextDisplayBuilder, MessageFlags, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { RestockActionRow, EmojiMappings, ConnectorEmojis } from './message.js';

const MessageWorker = new ConcurrencyPool(Ratelimits.RequestsPerSecond, 1000);

/*
    MassSendMessage is a function that sends messages to multiple Discord channels.
    It takes a Data object where each key is a channel ID and the value is the message content to send.
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

/*
    UploadEmoji is a function that uploads an emoji to Discord.
    It takes an emoji name and image data, and returns the uploaded emoji data.

    Image Data should be a base64 encoded string of the image in PNG format.
*/
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
