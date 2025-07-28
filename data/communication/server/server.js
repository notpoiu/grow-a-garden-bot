// Imports
import { GetStockData, AddStockData, GetWeatherData, AddWeatherData, SetCurrentStockData, GetSubscribedChannels, SetShopVisibilityData, QueryDatabase, AddCurrentWeatherOrEvent } from '../../../utils/db.js';
import { ResponseSchema } from '../../../ai/weather/schema.js';
import { GetAssetIdBinary } from '../../../utils/roblox.js';
import { GetDesignatedMsgGenerationFunction } from '../../../utils/utils.js';
import { MassSendMessage, UploadEmoji } from '../../../utils/rest.js';
import Logger from '../../../logger.js';

import chalk from 'chalk';

import express from 'express';
import { json, auth } from './middleware.js';

import { GoogleGenAI } from '@google/genai';

import { exec } from "child_process";
import { promisify } from "util";

import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// Initialization
const app = express();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// Middleware
app.use(json, auth);

// Static Files
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'data/communication/server/pages'));

// Routes
app.get("/", (req, res) => {
    res.render("index", { 
        DISCORD_URL: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}` 
    });
});

app.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

app.get("/script", (req, res) => {
    res.sendFile("datahandler.luau", { root: "data/communication/scripts" });
});

// SQL Query Endpoint
app.post("/sql/query", async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).send({ error: 'Missing query parameter' });
    }

    Logger.info(`Received SQL query: ${query}`);
    try {
        const result = QueryDatabase(query);
        res.status(200).send({ data: result });
    } catch (error) {
        Logger.error(`SQL query error: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
})

app.get("/sql/schema", async (req, res) => {
    try {
        const tables = await QueryDatabase("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        const tableNames = tables.map(t => t.name);
        res.status(200).send({ data: tableNames });
    } catch (error) {
        Logger.error(`Schema query error: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Update Stock Endpoint
app.post("/stock/update/:type", async (req, res) => {
    let { type } = req.params;

    if (!type) {
        return res.status(400).send({ error: 'Missing type parameter' });
    }

    const data = req.body;

    Logger.info(`Received stock update for type ${type} at ${new Date().toISOString()}.`);

    let ExpendedType = type;
    if (type === "Admin Restock") {
        ExpendedType = data["shop"]
    } else if (type === "SpecialEvent") {
        ExpendedType = "Weather"
        type = "Weather";
    }

    // Update Stock Data
    if (type === "Weather") {
        Logger.info(`Adding current weather or event: ${data.name} with timeout ${data.timeout}`);
        AddCurrentWeatherOrEvent(data.name, data.timeout);
    } else {
        SetCurrentStockData(ExpendedType, data);
    }

    // Send Push Notification
    const SubscribedChannels = GetSubscribedChannels(type);
    if (SubscribedChannels.length === 0) {
        Logger.info(`No channels subscribed to ${type} stock updates.`);
        return res.status(200).send({ message: 'No channels subscribed to this stock type.' });
    }

    const Messages = {};

    // Handle Stocks
    const GenerateEmbedFunction = GetDesignatedMsgGenerationFunction(type);
    if (!GenerateEmbedFunction) {
        Logger.error(`No message generation function found for stock type: ${type}`);
        return res.status(400).send({ error: 'Invalid stock type' });
    }

    for (const Channel of SubscribedChannels) {
        Messages[Channel.channel_id] = GenerateEmbedFunction(type, data, Channel.channel_id, "Latest ");
    }

    Logger.info(`Sending push notification to ${SubscribedChannels.length} channels for ${type} stock updates.`);
    MassSendMessage(Messages)
    return res.status(200).send({ message: 'Stock data updated and notifications sent.' });
})

// Update Data Endpoint
app.post('/data/update/:type', async (req, res) => {
    let { type } = req.params;

    if (!type) {
        return res.status(400).send({ error: 'Missing type parameter' });
    }

    const data = req.body;

    Logger.info(`Received static data update for type ${type} at ${new Date().toISOString()}.`);
    
    // Weather Update (Edge Case)
    if (type == "Weather") {
        if (!Array.isArray(data) || data.length === 0) {
            Logger.error('Invalid data format for weather update');
            return res.status(400).send({ error: 'Invalid data format' });
        }

        const AllWeatherData = GetWeatherData();
        const ExistingData = AllWeatherData.map(weather => weather.original_name);

        const DataToInsert = data.filter(weather => !ExistingData.includes(weather));

        if (DataToInsert.length === 0) {
            Logger.info('No new weather data to update');
            return res.status(200).send({ message: 'No new weather data to update' });
        }

        // Generate Weather Pretty Names and Associated Emojis via gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: 'application/json',
                responseSchema: ResponseSchema,
                systemInstruction: fs.readFileSync("ai/weather/system.md", "utf-8"),
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: JSON.stringify(DataToInsert) }],
                }
            ],
        });
        
        // Handle AI Response
        const { data: weatherData } = JSON.parse(response.text);

        for (const weather of weatherData) {
            const { associatedEmoji, originalName, prettifiedName } = weather;

            AddWeatherData(prettifiedName, originalName, associatedEmoji);
        }

        res.status(200).send({ message: 'Weather data updated successfully' });
        Logger.success('Weather data updated successfully!');
        return;    
    } else if (type.endsWith("VisibilityShop")) {
        // Visibility Update
        type = type.replace("VisibilityShop", "").trim();

        if (data === null) {
            Logger.error('Invalid data format for visibility update');
            return res.status(400).send({ error: 'Invalid data format for visibility update' });
        }

        // Update visibility data
        SetShopVisibilityData(type, data);
        res.status(200).send({ message: 'Visibility data updated successfully' });
        Logger.success(`Visibility data for ${type} updated successfully!`);
        return;
    }

    // Stock Update
    const AllStockData = GetStockData(type);
    const ExistingData = AllStockData.map(stock => stock.name);

    const DataToInsert = Object.entries(data).filter(([key, rbxassetid]) => !ExistingData.includes(key));
    if (DataToInsert.length === 0) {
        Logger.info(`No new stock data to update for type ${type}`);
        return res.status(200).send({ message: 'No new stock data to update' });
    }

    Logger.info(`Inserting ${DataToInsert.length} new stock items for type ${type}`);

    let completed = 0;
    for (let [name, rbxassetid] of DataToInsert) {
        if (rbxassetid.startsWith('rbxassetid://')) {
            rbxassetid = rbxassetid.replace('rbxassetid://', '');
        }

        const SanitizedName = name.toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')  // Replace non-alphanumeric chars (except underscore) with underscore
            .replace(/_+/g, '_')          // Replace multiple underscores with single underscore
            .replace(/^_|_$/g, '');       // Remove leading/trailing underscores

        try {
            const ImageData = await GetAssetIdBinary(rbxassetid, "base64");
            if (!ImageData) {
                completed++;
                continue;
            }
    
            const data = await UploadEmoji(
                SanitizedName,
                ImageData
            );
    
            if (!data.id || !data.name) {
                Logger.error(`Failed to upload emoji for ${name}: Invalid response from Discord`);
                completed++;
                continue;
            }
    
            AddStockData(type, rbxassetid, name, `<:${data.name}:${data.id}>`);
        } catch (error) {
            completed++;
            Logger.error(`Failed to upload emoji for ${name}: ${error.message}`);
        }

        completed++;
        await setTimeout(() => {}, 350);

        if (completed % 10 === 0) {
            Logger.info(`Processed ${completed} items for type ${type}`);
        }
    }

    res.status(200).send({ message: 'Static Data updated successfully' });
    Logger.success(`Static Data for ${type} updated successfully!`);
});

// Utility Functions

/**
 * Get the local IP address of the server.
 */
const getLocalIP = async () => {
    const platform = os.platform();
    let command;
    
    if (platform === 'win32') {
        command = "ipconfig | findstr /i \"IPv4 Address\"";
    } else if (platform === 'darwin') {
        command = "ipconfig getifaddr en0";
    } else {
        command = "hostname -I | awk '{print $1}'";
    }
    
    try {
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr) {
            throw new Error(stderr);
        }
        
        let ip = stdout.trim();
        
        // Clean up Windows output format if needed
        if (platform === 'win32' && ip) {
            const match = ip.match(/\d+\.\d+\.\d+\.\d+/);
            ip = match ? match[0] : 'Not found';
        }
        
        return ip;
    } catch (error) {
        return 'Not available';
    }
};


export const InitServer = async () => {
    let port = process.env.PORT || 8080;
    const localIP = await getLocalIP();
    let successfullyStarted = false;

    while (!successfullyStarted && port < 9000) {
        try {
            app.listen(port, () => {
                Logger.info("");
                Logger.info('   ▲ Communication Server');
                Logger.info(`   - Local: http://localhost:${port}`);
                Logger.info(`   - Network: http://${localIP}:${port}`);
                Logger.info("");

                Logger.success(`${chalk.green('✓')} Server started successfully on port ${port}`);
                console.log();
            });
            successfullyStarted = true;
        } catch (error) {
            Logger.error(`Failed to start server on port ${port}: ${error.message} - trying port ${port + 1} instead`);
            port += 1;
        }
    }

    if (!successfullyStarted) {
        Logger.error('Failed to start server on any port from 8080 to 9000');
        throw new Error('Server failed to start');
    }
}