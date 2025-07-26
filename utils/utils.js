import { GetStockTypes } from "./db.js";

export const GetAllTrackers = () => {
    let StockChoices = GetStockTypes()
    
    if (!StockChoices.some(choice => choice === "Weather")) {
        StockChoices.push("Weather");
    }

    if (!StockChoices.some(choice => choice === "Admin Restock")) {
        StockChoices.push("Admin Restock");
    }

    return StockChoices;
}

export const GetAllTimerTrackers = () => {
    return GetAllTrackers().filter(stock => stock !== "Admin Restock");
}