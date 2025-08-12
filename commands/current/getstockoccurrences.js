import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed, EmojiMappings, CreateText } from "../../utils/message.js";
import { GetEmojiForStock, GetShopVisibilityDataMultiple } from "../../utils/db.js";
import { PredictStockOccurences, FindTypeForItem } from "../../utils/predictors/stock.js";

export default {
    data: new SlashCommandBuilder()
        .setName("getstockoccurrences")
        .setDescription("Finds next occurrences for a seed or gear")
        .addStringOption(option =>
            option.setName("item")
                .setDescription("item name")
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("max")
                .setDescription("Max occurrences to search (1-15)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(15)
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const itemName = interaction.options.getString("item");
        const max = interaction.options.getInteger("max") || 5;

        const occ = PredictStockOccurences(itemName, max);
        const type = FindTypeForItem(itemName);

        const emoji = GetEmojiForStock(itemName) || EmojiMappings[itemName] || "";
        const lines = occ.map((o, idx) => {
            const when = `<t:${o.unix}:f> (<t:${o.unix}:R>)`;
            return `- **${emoji ? emoji + " " : ""}${itemName}** (x${o.stock})\n   - ${when}`;
        }).join("\n");

        const embed = CreateEmbed({
            title: `Future Occurrences (${type})`,
            description: lines,
        });

        embed.addTextDisplayComponents(
            CreateText("-# This using a prediction algorithm and may not be 100% accurate!")
        )

        return await interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const query = (focused.value || "").toString().toLowerCase();

        let rows = [];
        try {
            rows = GetShopVisibilityDataMultiple(["Seed", "Gear"]).flat() || [];
        } catch (_) {}

        const suggestions = rows
            .filter(r => !query || r.toLowerCase().includes(query))
            .slice(0, 25)
            .map(r => ({ name: r, value: r }));

        await interaction.respond(suggestions);
    }
}



