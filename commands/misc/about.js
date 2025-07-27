import { ApplicationIntegrationType, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { client } from "../../index.js";
import { CreateEmbed } from "../../utils/message.js";

export default {
    data: new SlashCommandBuilder()
        .setName("about")
        .setDescription("Provides information about the bot.")
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const application = await client.application.fetch();

        await interaction.reply({
            components: [
                CreateEmbed({
                    title: "About this bot",
                    description: `A Discord bot that sends push notifications for grow a garden restocks\nUsed by over **${application.approximateGuildCount ?? "*Failed to get count*"} servers** and **${application.approximateUserInstallCount ?? "*Failed to get count*"} users**.\n\nBot created and maintained by [upio](https://www.upio.dev/).`,
                    ActionRow: [
                        {
                            label: "Support Server",
                            link: "https://discord.gg/mspaint"
                        },
                        {
                            label: "Authorize Bot",
                            link: "https://discord.com/oauth2/authorize?client_id=1398481293016174682"
                        }
                    ]
                })
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
}