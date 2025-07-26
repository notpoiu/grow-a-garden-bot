import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";

export default {
    data: new SlashCommandBuilder()
        .setName("about")
        .setDescription("Provides information about the bot."),

    async execute(interaction) {
        
        await interaction.reply({
            components: [
                CreateEmbed({
                    title: "About this bot",
                    description: "A Discord bot that sends push notifications for grow a garden restocks.\nBot created and maintianed by [upio](https://www.upio.dev/).",
                    ActionRow: [
                        {
                            label: "Support Server",
                            link: "https://discord.gg/mspaint"
                        },
                    ]
                })
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
}