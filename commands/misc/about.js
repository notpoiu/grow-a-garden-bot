import { ApplicationIntegrationType, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";
import { GetSubscribedChannelCount } from "../../utils/db.js";
import { GetAllTrackers } from "../../utils/utils.js";

const AllStockTypes = GetAllTrackers();

export default {
    data: new SlashCommandBuilder()
        .setName("about")
        .setDescription("Provides information about the bot.")
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const application = await interaction.client.application.fetch();

        await interaction.reply({
            components: [
                CreateEmbed({
                    title: "About this bot",
                    description: `A Discord bot that sends push notifications for grow a garden restocks\nUsed by over **${interaction.client.guilds.cache.size ?? "*Failed to get count*"} servers** and **${application.approximateUserInstallCount ?? "*Failed to get count*"} users**.\n${AllStockTypes.map(type => `Amount of channels tracking ${type}: ${GetSubscribedChannelCount(type)}`).join("\n")}\nBot created and maintained by [upio](https://www.upio.dev/).`,
                    ActionRow: [
                        {
                            label: "Website",
                            link: "https://gag-watcher.upio.dev/"
                        },
                        {
                            label: "Support Server",
                            link: "https://discord.gg/mspaint"
                        },
                        {
                            label: "Authorize Bot",
                            link: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}`
                        }
                    ]
                })
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
}