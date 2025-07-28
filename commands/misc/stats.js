import { ApplicationIntegrationType, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { CreateEmbed, EmojiMappings } from "../../utils/message.js";
import { GetSubscribedChannelCount } from "../../utils/db.js";
import { GetAllTrackers } from "../../utils/utils.js";

const AllStockTypes = GetAllTrackers();

export default {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Provides statistics about the bot.")
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const application = await interaction.client.application.fetch();

        await interaction.reply({
            components: [
                CreateEmbed({
                    title: "📊 Tracker Statistics",
                    description: `**[Server Stats]:**\nNode.js Version: **${process.version}**\nMemory Usage: **${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB**\nShard(s): **${interaction.client.shard?.count ?? 1}**\n\n**[Bot Stats]:**\nTotal Servers: **${interaction.client.guilds.cache.size ?? "*Failed to get count*"}**\nTotal Users: **${application.approximateUserInstallCount ?? "*Failed to get count*"}**\n\n**[Tracking Stats]:**\n${AllStockTypes.map(type => `${EmojiMappings[type] ? EmojiMappings[type] + " " : ""}${type} Trackers Registered: **${GetSubscribedChannelCount(type)}**`).join("\n")}\n\nThis bot is created and maintained by [upio](https://www.upio.dev/).`,
                })
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
}