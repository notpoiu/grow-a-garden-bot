// Imports
import { GetStockData, AddStockData, GetWeatherData, AddWeatherData, SetCurrentStockData } from '../../../utils/db.js';
import { ResponseSchema } from '../../../ai/weather/schema.js';
import { GetAssetIdBinary } from '../../../utils/roblox.js';
import { UploadEmoji } from '../../../utils/rest.js';
import Logger from '../../../logger.js';

import express from 'express';
import { json, auth } from './middleware.js';

import { GoogleGenAI } from '@google/genai';

import { exec } from "child_process";
import os from 'os';
import fs from 'fs';
import { promisify } from "util";

const execAsync = promisify(exec);

import chalk from 'chalk';

// Initialization
const app = express();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// Middleware
app.use(json, auth);

// Routes
// Update Stock Endpoint
app.post("/stock/update/:type", async (req, res) => {
    const { type } = req.params;

    if (!type) {
        return res.status(400).send({ error: 'Missing type parameter' });
    }

    const data = req.body;

    Logger.info(`[Stock] Received update for type: ${type}`);
    SetCurrentStockData(type, data);
})

// Update Data Endpoint
app.post('/data/update/:type', async (req, res) => {
    const { type } = req.params;

    if (!type) {
        return res.status(400).send({ error: 'Missing type parameter' });
    }

    const data = req.body;
    
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
    }

    // Stock Update
    const AllStockData = GetStockData(type);
    const ExistingData = AllStockData.map(stock => stock.name);
    
    const DataToInsert = Object.entries(data).filter(([key, rbxassetid]) => !ExistingData.includes(key));
    if (DataToInsert.length === 0) {
        return res.status(200).send({ message: 'No new stock data to update' });
    }

    for (let [name, rbxassetid] of DataToInsert) {
        if (rbxassetid.startsWith('rbxassetid://')) {
            rbxassetid = rbxassetid.replace('rbxassetid://', '');
        }

        const SanitizedName = name.toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')  // Replace non-alphanumeric chars (except underscore) with underscore
            .replace(/_+/g, '_')          // Replace multiple underscores with single underscore
            .replace(/^_|_$/g, '');       // Remove leading/trailing underscores

        const ImageData = await GetAssetIdBinary(rbxassetid, "base64");
        if (!ImageData) {
            continue;
        }

        const data = await UploadEmoji(
            SanitizedName,
            ImageData
        );

        if (!data.id || !data.name) {
            return res.status(500).send({ error: 'Failed to upload emoji' });
        }

        AddStockData(type, rbxassetid, name, `<:${data.name}:${data.id}>`);

        await setTimeout(() => {}, 250);
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