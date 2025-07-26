import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";

export default {
    data: new SlashCommandBuilder()
        .setName("donate")
        .setDescription("Provides information on how to support the bot."),
    
    async execute(interaction) {
        await interaction.reply({
            components: [
                CreateEmbed({
                    title: "Support the Bot",
                    description: "If you'd like to support the development and uptime of the bot, we take donations.\n- Litecoin: `Lhj9faMDTYXfTHgUSG7gaWn4WyoCWvfLzx`\n- Etherium: `0xEe8D68497286a5dD81854662697711200abCC5BB`\n- Bitcoin: `bc1q64aesx8crarvzy8und7ez7uf9j6qfzrjf4dmwg`",
                    footer: "This bot is being maintained with pocket money so any support is appreciated!",
                })
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
}