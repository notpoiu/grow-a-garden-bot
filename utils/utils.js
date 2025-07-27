import { GetStockTypes, GetShopVisibilityData, GetWeatherData, GetEmojiForStock } from "./db.js";
import { CreateAdminRestockEmbed, CreateEventEmbed, CreateStockEmbed, EmojiMappings } from "./message.js";
import GraphemeSplitter from 'grapheme-splitter';

const EmojiSplitter = new GraphemeSplitter();

export const GetAllTrackers = (add_admin = true) => {
    let StockChoices = GetStockTypes()
    
    if (!StockChoices.some(choice => choice === "Weather")) {
        StockChoices.push("Weather");
    }

    if (add_admin) {
        if (!StockChoices.some(choice => choice === "Admin Restock")) {
            StockChoices.push("Admin Restock");
        }
    }

    return StockChoices;
}

export const GetAllTimerTrackers = () => {
    return GetAllTrackers().filter(stock => stock !== "Admin Restock" && stock !== "Weather");
}

export const GetDesignatedMsgGenerationFunction = (type) => {
    const Stocks = GetStockTypes();
    if (Stocks.includes(type)) {
        return (stock, data, channel_id, prefix = "") => CreateStockEmbed(stock, data, channel_id, prefix);
    }

    if (type === "Weather") {
        return (_, data, channel_id) => CreateEventEmbed("Weather", data["name"], data["timeout"], channel_id);
    }

    if (type === "Admin Restock") {
        return (_, data, channel_id) => CreateAdminRestockEmbed(data["shop"], data["stock"], channel_id);
    }

    return null;
}

export const GetSortedStockData = (type) => {
    const Stocks = GetStockTypes();
    if (Stocks.includes(type)) {
        return GetShopVisibilityData(type);
    }

    if (type === "Weather") {
        return GetWeatherData().sort((a, b) => a.original_name.localeCompare(b.original_name)).map(weather => weather.name);
    }
}

export const GetEmoji = (data, multiple = false) => {
    const stockEmoji = GetEmojiForStock(data);
    if (stockEmoji !== null) {
        return stockEmoji;
    }

    const weatherData = GetWeatherData().find(weather => weather.original_name === data || weather.name === data);
    if (weatherData !== undefined) {
        if (!multiple) {
            return EmojiSplitter.splitGraphemes(weatherData.emoji)[0];
        }

        return weatherData.emoji;
    }

    const mappings = EmojiMappings[data];
    if (mappings !== undefined) {
        return mappings;
    }

    return "";
}