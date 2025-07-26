import { DatabaseSync } from "node:sqlite"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new DatabaseSync(join(__dirname, "../data/database.db"));

/*
    subscribed_channels: stores channels that have subscribed to stock updates (type specifies the kind of updates).
    roles: roles associated with ping stock updates in channels.
*/
const InternalEnsureTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS subscribed_channels (
            channel_id TEXT NOT NULL,
            type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS roles (
            channel_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            name TEXT NOT NULL,
            stock_type TEXT NOT NULL,

            FOREIGN KEY (channel_id) REFERENCES subscribed_channels(channel_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stock_data (
            type TEXT NOT NULL,
            rbxassetid TEXT NOT NULL,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shop_data (
            type TEXT NOT NULL,
            visible_items TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS weather_data (
            name TEXT PRIMARY KEY,
            original_name TEXT NOT NULL,
            emoji TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS current_stock_data (
            type TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL,
            timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
    `);
}

export const SetShopVisibilityData = (type, visible_items) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT OR REPLACE INTO shop_data (type, visible_items) VALUES (?, ?)");
    stmt.run(type, JSON.stringify(visible_items));
}

export const GetShopVisibilityData = (type) => {
    InternalEnsureTables();

    const data = db.prepare("SELECT visible_items FROM shop_data WHERE type = ?").get(type);
    if (!data) return null;

    return JSON.parse(data.visible_items);
}

export const GetCurrentStockData = (type) => {
    InternalEnsureTables();

    const data = db.prepare("SELECT data FROM current_stock_data WHERE type = ?").get(type);
    if (!data) return null;

    return JSON.parse(data.data);
}

export const SetCurrentStockData = (type, data) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT OR REPLACE INTO current_stock_data (type, data) VALUES (?, ?)");
    stmt.run(type, JSON.stringify(data));
}

export const GetStockTypes = () => {
    InternalEnsureTables();

    const stockTypes = db.prepare("SELECT DISTINCT type FROM stock_data").all();
    return stockTypes.map(type => type.type);
}

export const GetEmojiForStock = (stock) => {
    InternalEnsureTables();
    
    const emojiData = db.prepare("SELECT emoji FROM stock_data WHERE name = ?").get(stock);
    return emojiData ? emojiData.emoji : null;
}

export const GetAllStockOfType = (type) => {
    InternalEnsureTables();

    const stockData = db.prepare("SELECT * FROM stock_data WHERE type = ?").all(type);
    return stockData;
}

export const GetWeatherData = () => {
    InternalEnsureTables();

    const weatherData = db.prepare("SELECT * FROM weather_data").all();
    return weatherData;
}

export const AddWeatherData = (name, original_name, emoji) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT OR IGNORE INTO weather_data (name, original_name, emoji) VALUES (?, ?, ?)");
    stmt.run(name, original_name, emoji);
}

export const GetStockData = (type) => {
    InternalEnsureTables();

    const stockData = db.prepare("SELECT * FROM stock_data WHERE type = ?").all(type);
    return stockData;
}

export const AddStockData = (type, rbxassetid, name, emoji) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT INTO stock_data (type, rbxassetid, name, emoji) VALUES (?, ?, ?, ?)");
    stmt.run(type, rbxassetid, name, emoji);
}

export const GetPingRolesForChannel = (channel_id, stock_type) => {
    InternalEnsureTables();

    const roles = db.prepare("SELECT role_id FROM roles WHERE channel_id = ? AND stock_type = ?").all(channel_id, stock_type);
    return roles.map(role => role.role_id);
}

export const GetPingRoles = (stock_type) => {
    InternalEnsureTables();

    const roles = db.prepare("SELECT role_id FROM roles WHERE stock_type = ?").all(stock_type);
    return roles.map(role => role.role_id);
}

export const AddSubscribedChannel = (channel_id, type) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT OR IGNORE INTO subscribed_channels (channel_id, type) VALUES (?, ?)");
    stmt.run(channel_id, type);
}

export const RemoveSubscribedChannel = (channel_id) => {
    InternalEnsureTables();

    const stmt = db.prepare("DELETE FROM subscribed_channels WHERE channel_id = ?");
    stmt.run(channel_id);
}

export const AddPingRole = (channel_id, role_id, name) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT OR IGNORE INTO roles (channel_id, role_id, name) VALUES (?, ?, ?)");
    stmt.run(channel_id, role_id, name);
}

export const RemovePingRole = (channel_id, role_id) => {
    InternalEnsureTables();

    const stmt = db.prepare("DELETE FROM roles WHERE channel_id = ? AND role_id = ?");
    stmt.run(channel_id, role_id);
}

export const GetSubscribedChannels = (type) => {
    InternalEnsureTables();

    const channels = db.prepare("SELECT channel_id FROM subscribed_channels WHERE type = ?").all(type);
    return channels;
}
