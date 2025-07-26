import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder } from 'discord.js';

export const QuickJoinButton = new ButtonBuilder()
    .setLabel("Quick Join")
    .setStyle(ButtonStyle.Link)
    .setURL("https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066")

export const RestockActionRow = new ActionRowBuilder()
    .addComponents(QuickJoinButton)

export const EmojiMappings = {
    "Seed": "🌱",
    "Weather": "☀️",
    "Gear": "🔨",
}

export const ConnectorEmojis = {
    "End": "<end:1398493116272742420>",
    "Connect": "<connect:1398493096748253195>",
}

export const CreateText = (content) => {
    return new TextDisplayBuilder()
        .setContent(content);
}

export const CreateEmbed = (data) => {
    const { title, description, footer, actionrow } = data;
    const ContainerComponent = new ContainerBuilder()
        .addTextDisplayComponents(
            CreateText(`## ${title}`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            CreateText(description)
        )
        .addSeparatorComponents(new SeparatorBuilder())
    
    if (footer) {
        ContainerComponent.addTextDisplayComponents(
            CreateText(`-# ${footer}`)
        )
    }

    if (actionrow) {
        ContainerComponent.addActionRowComponents(RestockActionRow);
    }
    
    return ContainerComponent
}