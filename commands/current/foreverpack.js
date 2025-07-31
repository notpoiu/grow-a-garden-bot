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
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const count = interaction.options.getInteger("count") || 5;
        return await interaction.reply(CreateSuperSeedsEmbed(count));
    }
}