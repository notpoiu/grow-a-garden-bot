import { GetStockSeedData, GetStockDataDump, GetStockTypes } from "../db.js"
import { Random } from "../roblox.js"

const PredictQuantity = (seed, name, data) => {
    const rng = new Random(seed);

    for (const item of data) {
        const roll = rng.NextInteger(1, item.StockChance);
        const stock = rng.NextInteger(item.StockAmount[1], item.StockAmount[2]);

        if (item.name == name && roll == 1) {
            return stock;
        }
    }
}

// Normalize arbitrary seed input (string/number/bigint) to a safe 32-bit integer for deterministic seeding
const normalizeSeedTo32Bit = (seed) => {
    try {
        const MASK32 = (1n << 32n) - 1n;
        const big = BigInt(String(seed).trim());
        const mod = big & MASK32;
        return Number(mod); // < 2^32 fits safely in JS Number without precision loss
    } catch (_) {
        const n = Number(seed);
        if (!Number.isFinite(n)) return 0;
        // keep within uint32
        return ((n % 0x100000000) + 0x100000000) % 0x100000000;
    }
}


const refSeedStr = 5848996;
const refUnixStr = 1754698800;

let dynamicSeedOffset = null; // integer constant so that: currentSeed = floor(now/300) + dynamicSeedOffset
const getCalibratedBaseSeed = (type) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const ticks = Math.floor(nowSec / 300); // number of 5-min intervals since epoch

    if (dynamicSeedOffset === null) {
        if (refSeedStr && refUnixStr) {
            const refSeed = Number(refSeedStr);
            const refTicks = Math.floor(Number(refUnixStr) / 300);
            if (Number.isFinite(refSeed) && Number.isFinite(refTicks)) {
                dynamicSeedOffset = refSeed - refTicks;
            }
        }

        // Fallback: use one DB read to calibrate
        if (dynamicSeedOffset === null) {
            const dbSeed = GetStockSeedData(type) || GetStockSeedData(type === "Seed" ? "Gear" : "Seed");
            if (dbSeed !== null && dbSeed !== undefined) {
                const seedNum = Number(dbSeed);
                if (Number.isFinite(seedNum)) {
                    dynamicSeedOffset = seedNum - ticks;
                }
            }
        }

        // Last resort: zero offset
        if (dynamicSeedOffset === null) dynamicSeedOffset = 0;
    }

    const base = ticks + dynamicSeedOffset;
    return normalizeSeedTo32Bit(base);
}

// Compute the next 5-minute boundary from a given unix time (seconds)
const getNextRestockUnix = (nowUnix = Math.floor(Date.now() / 1000)) => {
    const base = Math.floor(nowUnix / 300) * 300;
    return base + 300; // always the next future boundary
}

// Returns all items predicted to be in stock after `restocks` future restocks for the given `type`.
// Each entry: { item, stock, restocks }
export const PredictStock = (type, restocks = 0) => {
    const baseSeed = getCalibratedBaseSeed(type);

    const data = GetStockDataDump(type);
    if (!data || !Array.isArray(data)) return null;

    const offset = Math.max(0, Math.floor(restocks));
    const rng = new Random(baseSeed + offset);
    const results = [];

    for (const item of data) {
        const roll = rng.NextInteger(1, item.StockChance);
        const stock = rng.NextInteger(item.StockAmount[1], item.StockAmount[2]);
        if (roll === 1) {
            results.push({ item: item.name, stock, restocks: Math.max(0, Math.floor(restocks)) });
        }
    }

    return results;
}

// Helper to find which stock `type` contains an item by name, by scanning known types' data dumps
const findTypeForItem = (itemName) => {
    try {
        const types = GetStockTypes ? GetStockTypes() : [];
        for (const type of types) {
            const dump = GetStockDataDump(type);
            if (dump && Array.isArray(dump) && dump.some((i) => i.name === itemName)) {
                return type;
            }
        }
    } catch {}
    return null;
}

// Finds the next `occurrences` times an item appears in stock for a given `type`.
// Overload: PredictStockOccurences(type, item_name, occurrences)
//           PredictStockOccurences(item_name, occurrences)  // auto-detects type
export const PredictStockOccurences = (...args) => {
    let type;
    let itemName;
    let occurrences;
    let nowUnix; // optional unix time, for external timestamp computations

    if (args.length === 3) {
        [type, itemName, occurrences] = args;
    } else if (args.length === 2) {
        [itemName, occurrences] = args;
        type = findTypeForItem(itemName);
        if (!type) return [];
    } else {
        return [];
    }

    const baseSeed = getCalibratedBaseSeed(type);

    const data = GetStockDataDump(type);
    if (!data || !Array.isArray(data)) return [];

    const maxSearch = 2_000_000; // safety cap similar to Lua reference
    const results = [];
    let offset = 0;
    const now = Math.floor(Date.now() / 1000);
    const secondsUntilNext = getNextRestockUnix(now) - now;

    while (results.length < occurrences && offset <= maxSearch) {
        const qty = PredictQuantity(baseSeed + offset, itemName, data);
        if (qty != null) {
            const extraIntervals = offset > 0 ? (offset - 1) : 0; // match Luau: next restock for offset 0 or 1
            const future = now + secondsUntilNext + (extraIntervals * 300);
            const unix = Math.floor((future / 60) + 0.5) * 60; // round to nearest minute like Luau
            results.push({ item: itemName, stock: qty, restocks: offset, unix });
        }
        offset += 1;
    }

    return results;
}