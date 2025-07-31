import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateSuperSeedsEmbed } from "../../utils/message.js";

export default {
    data: new SlashCommandBuilder()
        .setName("superseeds")
        .setDescription("Gets how many robux you need to get x super seeds for the current day")
        .addIntegerOption(option =>
            option.setName("count")
                .setDescription("The number of super seeds to get")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(35)
        )
        .addStringOption(option =>
            option.setName("date")
                .setDescription("The date to calculate the super seeds for (YYYY-MM-DD format)")
                .setRequired(false)
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const count = interaction.options.getInteger("count") || 5;
        const dateString = interaction.options.getString("date");
        
        let date;
        if (dateString) {
            const parsedDate = new Date(dateString);
            if (isNaN(parsedDate.getTime())) {
                return await interaction.reply({
                    content: "Invalid date format. Please use YYYY-MM-DD.",
                    flags: MessageFlags.Ephemeral
                });
            }
            date = parsedDate;
        }
        
        return await interaction.reply(CreateSuperSeedsEmbed(count, date));
    }
}