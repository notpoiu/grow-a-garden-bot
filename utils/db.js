import { DatabaseSync } from "node:sqlite"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new DatabaseSync(join(__dirname, "../data/database.db"), {});

/*
    subscribed_channels: stores channels that have subscribed to stock updates (type specifies the kind of updates).
    roles: roles associated with ping stock updates in channels.
*/

const InternalEnsureTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS subscribed_channels (
            channel_id TEXT NOT NULL,
            type TEXT NOT NULL,
            PRIMARY KEY (channel_id, type)
        );

        CREATE TABLE IF NOT EXISTS roles (
            channel_id TEXT NOT NULL,
            role_id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            stock_type TEXT NOT NULL,

            FOREIGN KEY (channel_id, stock_type) REFERENCES subscribed_channels(channel_id, type) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reaction_role_messages (
            message_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            stock_type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stock_data (
            type TEXT NOT NULL,
            rbxassetid TEXT NOT NULL,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stock_rng_data (
            type TEXT PRIMARY KEY NOT NULL,
            seed TEXT NOT NULL,
            timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS stock_data_dump (
            type TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shop_data (
            type TEXT PRIMARY KEY NOT NULL,
            visible_items TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS weather_data (
            name TEXT PRIMARY KEY,
            original_name TEXT NOT NULL,
            emoji TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS current_weather_and_events (
            name TEXT PRIMARY KEY NOT NULL,
            timeout INTEGER NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS current_stock_data (
            type TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL,
            timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
    `);
}

const InternalTrimAllNonValidWeatherEvents = () => {
    db.exec("DELETE FROM current_weather_and_events WHERE CAST(strftime('%s', 'now') AS INTEGER) > created_at + timeout");
}

export const QueryDatabase = (query, params = []) => {
    InternalEnsureTables();

    return db.prepare(query).all(...params);
}

export const SetStockRNGData = (type, seed) => {
    InternalEnsureTables();
    const stmt = db.prepare("INSERT OR REPLACE INTO stock_rng_data (type, seed, timestamp) VALUES (?, ?, CAST(strftime('%s','now') AS INTEGER))");
    stmt.run(type, seed);
}

export const GetStockSeedData = (type) => {
    InternalEnsureTables();
    const data = db.prepare("SELECT seed, timestamp FROM stock_rng_data WHERE type = ? ORDER BY rowid DESC LIMIT 1").get(type);
    return data || null;
}

export const SetStockDataDump = (type, data) => {
    InternalEnsureTables();
    const stmt = db.prepare("INSERT OR REPLACE INTO stock_data_dump (type, data) VALUES (?, ?)");
    stmt.run(type, JSON.stringify(data));
}

export const GetStockDataDump = (type) => {
    InternalEnsureTables();
    const data = db.prepare("SELECT data FROM stock_data_dump WHERE type = ? ORDER BY rowid DESC LIMIT 1").get(type);
    return data ? JSON.parse(data.data) : null;
}

export const GetCurrentWeatherAndEvents = () => {
    InternalEnsureTables();
    InternalTrimAllNonValidWeatherEvents();

    return db.prepare("SELECT * FROM current_weather_and_events").all();
}

export const AddCurrentWeatherOrEvent = (name, timeout) => {
    InternalEnsureTables();
    InternalTrimAllNonValidWeatherEvents();

    const stmt = db.prepare("INSERT INTO current_weather_and_events (name, timeout) VALUES (?, ?)");
    stmt.run(name, timeout);
}

export const AddReactionRoleMessage = (message_id, channel_id, stock_type) => {
    InternalEnsureTables();
    const stmt = db.prepare("INSERT OR REPLACE INTO reaction_role_messages (message_id, channel_id, stock_type) VALUES (?, ?, ?)");
    stmt.run(message_id, channel_id, stock_type);
}

export const GetReactionRoleMessage = (message_id) => {
    InternalEnsureTables();
    return db.prepare("SELECT * FROM reaction_role_messages WHERE message_id = ?").get(message_id);
}

export const GetReactionRoleMessageInChannel = (channel_id, stock_type) => {
    InternalEnsureTables();
    return db.prepare("SELECT * FROM reaction_role_messages WHERE channel_id = ? AND stock_type = ?").get(channel_id, stock_type);
}

export const RemoveReactionRoleMessage = (message_id) => {
    InternalEnsureTables();
    const stmt = db.prepare("DELETE FROM reaction_role_messages WHERE message_id = ?");
    stmt.run(message_id);
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

export const GetShopVisibilityDataMultiple = (types) => {
    InternalEnsureTables();

    const placeholders = types.map(() => '?').join(',');

    const stmt = db.prepare(`SELECT visible_items FROM shop_data WHERE type IN (${placeholders})`);
    const data = stmt.all(...types);

    return data.map(d => JSON.parse(d.visible_items));
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
    return weatherData
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

    const roles = db.prepare("SELECT * FROM roles WHERE channel_id = ? AND stock_type = ?").all(channel_id, stock_type);
    return roles;
}

export const GetWeatherPingRoleForChannel = (channel_id, weather_name) => {
    InternalEnsureTables();

    const role = db.prepare("SELECT * FROM roles WHERE channel_id = ? AND stock_type = ? AND name = ?").get(channel_id, "Weather", weather_name);
    return role ? role.role_id : null;
}

export const GetPingRoles = (stock_type) => {
    InternalEnsureTables();

    const roles = db.prepare("SELECT role_id FROM roles WHERE stock_type = ?").all(stock_type);
    return roles.map(role => role.role_id);
}

export const GetSubscribedChannelCount = (type) => {
    InternalEnsureTables();

    const count = db.prepare("SELECT COUNT(*) as count FROM subscribed_channels WHERE type = ?").get(type);
    return count ? count.count : 0;
}

export const AddSubscribedChannel = (channel_id, type) => {
    InternalEnsureTables();

    const stmt = db.prepare("INSERT OR IGNORE INTO subscribed_channels (channel_id, type) VALUES (?, ?)");
    stmt.run(channel_id, type);
}

export const RemoveSubscribedChannel = (channel_id, type) => {
    InternalEnsureTables();

    const stmt = db.prepare("DELETE FROM subscribed_channels WHERE channel_id = ? AND type = ?");
    stmt.run(channel_id, type);
}

export const RemoveAllSubscriptionsForChannel = (channel_id) => {
    InternalEnsureTables();

    const stmt = db.prepare("DELETE FROM subscribed_channels WHERE channel_id = ?");
    stmt.run(channel_id);
}

export const IsChannelSubscribed = (channel_id, type) => {
    InternalEnsureTables();

    const result = db.prepare("SELECT 1 FROM subscribed_channels WHERE channel_id = ? AND type = ?").get(channel_id, type);
    return !!result;
}

export const AddPingRole = (channel_id, role_id, name, stock_type) => {
    InternalEnsureTables();
    
    const stmt = db.prepare("INSERT OR REPLACE INTO roles (channel_id, role_id, name, stock_type) VALUES (?, ?, ?, ?)");
    stmt.run(channel_id, role_id, name, stock_type);
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
