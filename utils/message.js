import {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder
} from 'discord.js';

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
    const { title, description, footer, ActionRow } = data;
    const ContainerComponent = new ContainerBuilder()
        .addTextDisplayComponents(
            CreateText(`## ${title}`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            CreateText(description)
        )
        .addSeparatorComponents(new SeparatorBuilder())

    if (ActionRow) {
        const ButtonComponents = ActionRow.map(button => {
            return new ButtonBuilder()
                .setLabel(button.label)
                .setStyle(ButtonStyle.Link)
                .setURL(button.link);
        });
        /*const QuickJoinButton = new ButtonBuilder()
            .setLabel("Quick Join")
            .setStyle(ButtonStyle.Link)
            .setURL("https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066")*/

        const RestockActionRow = new ActionRowBuilder()
            .addComponents(...ButtonComponents);

        ContainerComponent.addActionRowComponents(RestockActionRow);
    }

    if (footer) {
        ContainerComponent.addTextDisplayComponents(
            CreateText(`-# ${footer}`)
        )
    }
    
    return ContainerComponent
}