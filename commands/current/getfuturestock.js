import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateStockEmbed, CreateEmbed, EmojiMappings } from "../../utils/message.js";
import { PredictStock } from "../../utils/predictors/stock.js";

const toUnix = (date) => Math.floor(date.getTime() / 1000);
const nextRestockUnix = (nowSec = Math.floor(Date.now() / 1000)) => {
    const base = Math.floor(nowSec / 300) * 300;
    return base + 300;
}

const restocksUntil = (targetDate) => {
    const targetUnix = toUnix(targetDate);
    const roundedTarget = Math.ceil(targetUnix / 300) * 300;
    const start = nextRestockUnix();
    if (roundedTarget <= start) return 0;
    return Math.floor((roundedTarget - start) / 300);
}

const listToMap = (arr) => {
    const map = {};
    for (const e of arr) {
        map[e.item] = e.stock;
    }
    return map;
}

export default {
    data: new SlashCommandBuilder()
        .setName("getfuturestock")
        .setDescription("Predicts future stock for a chosen type (Seed or Gear) by restocks or date")
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Which stock type to predict")
                .addChoices(
                    { name: "Seed", value: "Seed" },
                    { name: "Gear", value: "Gear" },
                )
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("restocks")
                .setDescription("How many restocks ahead to predict")
                .setRequired(false)
                .setMinValue(0)
        )
        .addStringOption(option =>
            option.setName("date")
                .setDescription("Target date/time (YYYY-MM-DD or ISO). Uses 5-minute restock intervals.")
                .setRequired(false)
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const type = interaction.options.getString("type");
        const restocks = interaction.options.getInteger("restocks");
        const dateString = interaction.options.getString("date");

        const provided = [restocks !== null && restocks !== undefined, !!dateString].filter(Boolean).length;
        if (provided !== 1) {
            return await interaction.reply({
                content: "Please provide exactly one of: restocks or date.",
                flags: MessageFlags.Ephemeral
            });
        }

        // Mode 1: Predict at N restocks ahead (Seed + Gear)
        if (restocks !== null && restocks !== undefined) {
            const list = PredictStock(type, restocks) || [];
            if (list.length === 0) {
                return await interaction.reply({
                    content: `No ${type.toLowerCase()} items predicted to stock in ${restocks} restock(s).`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const msg = CreateStockEmbed(type, listToMap(list), interaction.channelId, "Future ");
            await interaction.reply(msg);
            return;
        }

        // Mode 2: Predict for a target date
        if (dateString) {
            const target = new Date(dateString);
            if (isNaN(target.getTime())) {
                return await interaction.reply({
                    content: "Invalid date format. Please use YYYY-MM-DD or an ISO date.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const r = restocksUntil(target);
            const roundedUnix = Math.ceil(toUnix(target) / 300) * 300;

            const header = CreateEmbed({
                title: `${EmojiMappings[type] || ""} Future ${type} Stock`,
                description: `Predictions for <t:${roundedUnix}:f> (<t:${roundedUnix}:R>)\n-# Computed as ${r} restock(s) ahead.`
            });

            const list = PredictStock(type, r) || [];

            const msgs = [];
            msgs.push({ components: [header], flags: MessageFlags.IsComponentsV2 });

            if (list.length > 0) {
                msgs.push(CreateStockEmbed(type, listToMap(list), interaction.channelId, "Future "));
            }

            if (msgs.length === 1) {
                return await interaction.reply({
                    content: `No ${type.toLowerCase()} items predicted to stock by that time.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.reply(msgs[0]);
            for (let i = 1; i < msgs.length; i++) {
                await interaction.followUp(msgs[i]);
            }
            return;
        }

        // Item occurrences moved to /getstockoccurrences
    },
    // No autocomplete for this command
}


