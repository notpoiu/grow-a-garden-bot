// Imports
import { GetStockData, AddStockData, GetWeatherData, AddWeatherData } from '../../../utils/db.js';
import { ResponseSchema } from '../../../ai/weather/schema.js';
import { UploadEmoji } from '../../../utils/rest.js';

import express from 'express';
import { json, auth } from './middleware.js';

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

// Initialization
const app = express();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// Middleware
app.use(json, auth);

// Routes
app.post('/weather_update', async (req, res) => {
    const { type, data } = req.body;

    if (!type || !data) {
        return res.status(400).send({ error: 'Missing type or data' });
    }

    //await MassSendStockMessage('weather', type, data);

    res.status(200).send({ message: 'Weather update sent successfully' });
});

app.post('/stock_update', async (req, res) => {
    const { type, category, data } = req.body;

    if (!type || !category || !data) {
        return res.status(400).send({ error: 'Missing type, category or data' });
    }

    await MassSendStockMessage(category, type, data);

    res.status(200).send({ message: 'Stock update sent successfully' });
})

app.post("/stock/update/:type", async (req, res) => {
    const { type } = req.params;

    if (!type) {
        return res.status(400).send({ error: 'Missing type parameter' });
    }

    const data = req.body;

    console.log(`[Stock] Received update for type: ${type}`, data);
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
            console.error('Invalid data format for weather update');
            return res.status(400).send({ error: 'Invalid data format' });
        }

        const AllWeatherData = GetWeatherData();
        const ExistingData = AllWeatherData.map(weather => weather.original_name);

        const DataToInsert = data.filter(weather => !ExistingData.includes(weather));

        if (DataToInsert.length === 0) {
            console.log('No new weather data to update');
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
        console.log('Weather data updated successfully!');
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

    res.status(200).send({ message: 'Stock data updated successfully' });
    console.log('Stock data updated successfully!');
});


export const InitServer = () => {
    app.listen(8080, () => {
        console.log('HTTP server is running on port 8080');
    })
}