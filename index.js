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
import Logger from './logger.js';

// Discord Bot
import { Client, Events, GatewayIntentBits, Collection, MessageFlags } from 'discord.js';

const client = new Client({
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
	if (!interaction.isChatInputCommand()) return;

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
});

// Login
client.login(process.env.BOT_TOKEN);
