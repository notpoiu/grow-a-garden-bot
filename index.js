// Initialization
import 'dotenv/config';

console.log(`    GAG Stock Bot - by upio

    ┌ ○ Environment: ${process.env.NODE_ENV || "development"}
    ├ ○ Version: ${process.env.VERSION || "1.0.0"}
    └ ○ Node.js Version: ${process.version}
`)


// imports
import { InitServer } from "./data/communication/server/server.js";
import { SynchronizeSlashCommands, GetSlashCommands } from "./utils/rest.js";
import { GetReactionRoleMessage, GetPingRolesForChannel } from "./utils/db.js";
import { CreateEmbed } from "./utils/message.js";
import Logger from './logger.js';

// Discord Bot
import { Client, Events, GatewayIntentBits, Collection, MessageFlags } from 'discord.js';
import { AddPingRole } from './utils/db.js';

export const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Load commands asynchronously
(async () => {
    const commandFiles = await GetSlashCommands();  // This gets the command data for Discord
    
    // Now we need to load the actual command objects for execution
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);
    
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            try {
                const commandModule = await import(filePath);
                const command = commandModule.default || commandModule;
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                }
            } catch (error) {
                console.error(`Failed to load command from ${filePath}:`, error);
            }
        }
    }
})();

// Event Handlers
client.once(Events.ClientReady, readyClient => {
	Logger.success(`Logged in as ${readyClient.user.tag}`);
    
    console.log();

    Logger.info("Starting communication server...");
    InitServer().then(() => {
        
        SynchronizeSlashCommands()

    }).catch(error => {
        Logger.error(`Failed to initialize server: ${error.message}`);
    });
});

client.on(Events.InteractionCreate, async interaction => {
	// Slash Command Handling
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
    
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
    
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            }
        }
    }

    // Autocomplete Handling
    if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command || typeof command.autocomplete !== 'function') return;
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(`Autocomplete error for ${interaction.commandName}:`, error);
        }
    }

    // String Select Menu Handling
    if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        // Reaction Roles
        if (id.startsWith("reactionrole_")) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

            const messageContext = GetReactionRoleMessage(interaction.message.id);
            if (!messageContext) {
                return await interaction.editReply({ content: "This reaction role message is no longer valid." });
            }

            const { channel_id: tracking_channel_id, stock_type: stock } = messageContext;
            const selectedValues = interaction.values;

            let errored = false;

            try {
                const dbRoles = GetPingRolesForChannel(tracking_channel_id, stock);
                const allStockRoleIds = new Set(dbRoles.map(r => r.role_id));

                const memberRolesToKeep = interaction.member.roles.cache.filter(role => !allStockRoleIds.has(role.id));

                const rolesToAddPromises = selectedValues.map(async (value) => {
                    const StockName = value.replace("reactionrole_", "");
                    const RoleName = `${StockName} Ping`;
                    
                    // Check database for existing role
                    const existingDbRole = dbRoles.find(dbRole => dbRole.name === StockName);
                    
                    let stockRole;
                    if (existingDbRole) {
                        // Try to get the role from guild cache
                        stockRole = interaction.guild.roles.cache.get(existingDbRole.role_id);
                        
                        // If role doesn't exist in guild anymore, create new one and update database
                        if (!stockRole) {
                            stockRole = await interaction.guild.roles.create({
                                name: RoleName,
                                permissions: [],
                                reason: `Reaction role for ${value} restock updates`
                            });
                            
                            AddPingRole(tracking_channel_id, stockRole.id, StockName, stock);
                        }
                    } else {
                        // Create new role and add to database
                        stockRole = await interaction.guild.roles.create({
                            name: RoleName,
                            permissions: [],
                            reason: `Reaction role for ${value} restock updates`
                        });

                        AddPingRole(tracking_channel_id, stockRole.id, StockName, stock);
                    }
                    
                    return stockRole.id;
                });

                const rolesToAdd = await Promise.all(rolesToAddPromises);

                const finalRoles = [...memberRolesToKeep.keys(), ...rolesToAdd];
                await interaction.member.roles.set(finalRoles);
            } catch (error) {
                errored = true;
                Logger.error(`Failed to handle reaction role interaction: ${error.message}`);
                
                const ErrorEmbed = CreateEmbed({
                    title: "⚠️ Error | Reaction Roles",
                    description: "There was an error while processing your reaction role request. Please try again later.",
                    footer: "If the issue persists, contact an admin.",
                })

                const MessageData = {
                    components: [ErrorEmbed],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                }
                
                if (interaction.replied || interaction.deferred) {
                    return await interaction.followUp(MessageData)
                }

                return await interaction.reply(MessageData);
            }

            if (!errored) {
                const description = selectedValues.length > 0 
                    ? `Successfully updated your reaction roles for **${stock}** stock.`
                    : `Successfully removed all reaction roles for **${stock}** stock.`;

                await interaction.editReply({
                    components: [
                        CreateEmbed({
                            title: "Reaction Role Updated",
                            description: description,
                            footer: "You can change your selection at any time using the same menu.",
                        })
                    ],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }
        }
    }
});

// Login
client.login(process.env.BOT_TOKEN);