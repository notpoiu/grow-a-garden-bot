import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";
import { GetAllTrackers } from "../../utils/utils.js";

const StockChoices = GetAllTrackers()
    .map(stock => ({
        name: stock,
        value: stock
    }));

export default {
    data: new SlashCommandBuilder()
        .setName("track")
        .setDescription("Starts tracking a stock")
        .addStringOption(option =>
            option.setName("stock")
                .setDescription("The stock to start tracking")
                .setRequired(true)
                .addChoices(
                    ...StockChoices
                )
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to track the stock in (if not specified, the current channel will be used)')
        ),

    async execute(interaction) {
        const stock = interaction.options.getString("stock");
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        
        // Check for permissions to send messages in the channel
        if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Tracking Setup",
                        description: `I do not have permission to send messages in ${channel}. Please grant me the 'Send Messages' permission to track this stock.`,
                        footer: "Check my permissions and try again.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        
    }
}