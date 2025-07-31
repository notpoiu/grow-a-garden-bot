import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";
import { GetAllTrackers } from "../../utils/utils.js";
import { AddSubscribedChannel, IsChannelSubscribed } from "../../utils/db.js";

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

        if (channel == null || channel == undefined) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Tracking Setup",
                        description: "You must specify a valid channel to track this stock.",
                        footer: "Please select a valid channel and try again.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

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

        // Check if the user has permission to manage channels
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Tracking Setup",
                        description: "You do not have permission to manage channels in this server. Please contact an admin to set up tracking.",
                        footer: "You can still track stocks in channels you have permission to manage.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        if (IsChannelSubscribed(channel.id, stock)) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Tracking Setup",
                        description: `You are already tracking **${stock}** in ${channel}.`,
                        footer: "You can stop tracking this stock using the /untrack command.",
                    })
                ],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        AddSubscribedChannel(channel.id, stock);

        return await interaction.reply({
            components: [
                CreateEmbed({
                    title: "Tracking Setup",
                    description: `Successfully started tracking **${stock}** in ${channel}. You will receive notifications for restocks in this channel.`,
                    footer: "You can stop tracking this stock using the /untrack command.",
                })
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
}