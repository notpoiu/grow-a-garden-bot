import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateCurrentWeatherEmbed } from "../../utils/message.js";
import { GetCurrentWeatherAndEvents } from "../../utils/db.js";

export default {
    data: new SlashCommandBuilder()
        .setName("currentweather")
        .setDescription("Gets the current weather data")
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const weatherData = await GetCurrentWeatherAndEvents();
        
        return await interaction.reply(CreateCurrentWeatherEmbed(weatherData));
    }
}