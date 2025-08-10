import { GetStockSeedData, GetStockDataDump, GetStockTypes } from "../db.js"
import { Random } from "../roblox.js"

const SortDataToGameOrder = (type, data) => {
    if (!Array.isArray(data)) return [];

    // Clone to avoid mutating external state
    let arr = data.slice();

    if (type === "Gear") {
        // Special-case: "Medium Treat" should come before "Medium Toy" like Luau
        arr.sort((a, b) => {
            const an = String(a.name || "");
            const bn = String(b.name || "");
            if (an === "Medium Toy" && bn === "Medium Treat") return 1;
            if (an === "Medium Treat" && bn === "Medium Toy") return -1;

            const pa = Number(a.Price ?? 0);
            const pb = Number(b.Price ?? 0);
            return pa - pb;
        });
    } else {
        // Filter out entries with zero chance like Luau filteredSeedData
        arr = arr.filter((it) => Number(it.StockChance) !== 0);

        // Sort by Price asc, then LayoutOrder asc (fallback to 0 if missing)
        arr.sort((a, b) => {
            const pa = Number(a.Price ?? 0);
            const pb = Number(b.Price ?? 0);
            if (pa === pb) {
                const la = Number(a.LayoutOrder ?? 0);
                const lb = Number(b.LayoutOrder ?? 0);
                return la - lb;
            }
            return pa - pb;
        });
    }

    return arr;
}

const GetMinMaxFromStockAmount = (stockAmount) => {
    if (stockAmount == null) return [1, 1];

    if (Array.isArray(stockAmount)) {
        if (stockAmount.length >= 2) {
            const min = Number(stockAmount[0]);
            const max = Number(stockAmount[1]);
            if (Number.isFinite(min) && Number.isFinite(max)) return [min, max];
        } else if (stockAmount.length === 1) {
            const val = Number(stockAmount[0]);
            if (Number.isFinite(val)) return [val, val];
        }
    }

    // Object-like cases: support 0/1, '0'/'1', 1/2, '1'/'2', or Min/Max keys
    if (typeof stockAmount === "object") {
        if (0 in stockAmount && 1 in stockAmount) {
            const min = Number(stockAmount[0]);
            const max = Number(stockAmount[1]);
            if (Number.isFinite(min) && Number.isFinite(max)) return [min, max];
        }
        if ('0' in stockAmount && '1' in stockAmount) {
            const min = Number(stockAmount['0']);
            const max = Number(stockAmount['1']);
            if (Number.isFinite(min) && Number.isFinite(max)) return [min, max];
        }
        if (1 in stockAmount && 2 in stockAmount) {
            const min = Number(stockAmount[1]);
            const max = Number(stockAmount[2]);
            if (Number.isFinite(min) && Number.isFinite(max)) return [min, max];
        }
        if ('1' in stockAmount && '2' in stockAmount) {
            const min = Number(stockAmount['1']);
            const max = Number(stockAmount['2']);
            if (Number.isFinite(min) && Number.isFinite(max)) return [min, max];
        }
        if ('Min' in stockAmount && 'Max' in stockAmount) {
            const min = Number(stockAmount.Min);
            const max = Number(stockAmount.Max);
            if (Number.isFinite(min) && Number.isFinite(max)) return [min, max];
        }
    }

    return [1, 1];
}

const PredictQuantity = (seed, name, data) => {
    const rng = new Random(seed);

    for (const item of data) {
        const roll = rng.NextInteger(1, item.StockChance);

        const [minAmt, maxAmt] = GetMinMaxFromStockAmount(item.StockAmount);
        const stock = rng.NextInteger(minAmt, maxAmt);

        if (item.name == name && roll == 1) {
            return stock;
        }
    }
}

const PredictEggQuantity = (seed, name, data) => {
    const rng = new Random(seed);
    let Quantity = 0;

    for (let i = 0; i < 3; i++) {
        for (const item of data) {
            const roll = rng.NextInteger(1, item.StockChance);
    
            if (item.EggName == name && roll == 1) {
                Quantity += 1;
            }
        }
    }

    return Quantity == 0 ? null : Quantity
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

const RNGInfo = {
    Seed: {
        refSeedStr: 5848996,
        refUnixStr: 1754698800,
        restock_cycle_duration: 5 * 60
    },

    Gear: {
        refSeedStr: 5848996,
        refUnixStr: 1754698800,
        restock_cycle_duration: 5 * 60
    },

    Egg: {
        refSeedStr: 974876,
        refUnixStr: 1754777400,
        restock_cycle_duration: 30 * 60
    }
}

// Cache dynamic offsets per type to avoid recomputing each call
const dynamicSeedOffsetByType = Object.create(null);

const GetRestockCycleSeconds = (type) => {
    const info = RNGInfo[type];
    const duration = info?.restock_cycle_duration;
    return Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : 300;
}

const GetBaseSeed = (type) => {
    const period = GetRestockCycleSeconds(type);
    const nowSec = Math.floor(Date.now() / 1000);
    const ticksNow = Math.floor(nowSec / period);

    // Resolve or compute dynamic offset
    if (!(type in dynamicSeedOffsetByType)) {
        let offset = null;

        // 1) Reference constants
        const info = RNGInfo[type] || {};
        const refSeedStr = info.refSeedStr;
        const refUnixStr = info.refUnixStr;
        if (Number(refSeedStr) > 0 && Number(refUnixStr) > 0) {
            const refTicks = Math.floor(Number(refUnixStr) / period);
            const refSeed = Number(refSeedStr);
            if (Number.isFinite(refTicks) && Number.isFinite(refSeed)) {
                offset = refSeed - refTicks;
            }
        }

        // 2) Fallback: single DB read
        if (offset === null) {
            try {
                const rec = GetStockSeedData(type);
                if (rec && rec.seed != null) {
                    const dbSeed = Number(rec.seed);
                    const tsSec = Number(rec.timestamp);
                    const ticksAt = Number.isFinite(tsSec) && tsSec > 0 ? Math.floor(tsSec / period) : ticksNow;
                    if (Number.isFinite(dbSeed)) {
                        offset = dbSeed - ticksAt;
                    }
                }
            } catch {}
        }

        // 3) Last resort
        if (offset === null) offset = 0;

        dynamicSeedOffsetByType[type] = offset;
    }

    const base = ticksNow + dynamicSeedOffsetByType[type];
    return normalizeSeedTo32Bit(base);
}

const GetNextRestockUnix = (nowUnix = Math.floor(Date.now() / 1000), Duration = 300) => {
    const base = Math.floor(nowUnix / Duration) * Duration;
    return base + Duration; // always the next future boundary
}

// Returns all items predicted to be in stock after `restocks` future restocks for the given `type`.
// Each entry: { item, stock, restocks }
export const PredictStock = (type, restocks = 0) => {
    const baseSeed = GetBaseSeed(type);

    const raw = GetStockDataDump(type);
    const data = SortDataToGameOrder(type, raw);
    if (!data || !Array.isArray(data)) return null;

    const offset = Math.max(0, Math.floor(restocks));
    const rng = new Random(baseSeed + offset);
    let results = [];

    if (type == "Egg") {
        const resultsMapping = {}
        let totalNonCommonEggs = 0
        
        for (let i = 0; i < 3; i++) {
            for (const item of data) {
                const roll = rng.NextInteger(1, item.StockChance);
                
                if (roll === 1) {
                    if (!resultsMapping[item.EggName])
                        resultsMapping[item.EggName] = 0
                    
                    resultsMapping[item.EggName] += 1

                    if (item.EggName !== "Common Egg") {
                        totalNonCommonEggs += 1
                    }
                }
            }
        }

        results = Object.entries(resultsMapping).map(([name, count]) => {
            const isCommon = name === "Common Egg"
            return {
                item: name,
                stock: isCommon ? 3 - totalNonCommonEggs : count,
                restocks: Math.max(0, Math.floor(restocks))
            };
        });
    } else {
        for (const item of data) {
            const roll = rng.NextInteger(1, item.StockChance);
            const [minAmt, maxAmt] = GetMinMaxFromStockAmount(item.StockAmount);
            const stock = rng.NextInteger(minAmt, maxAmt);
            if (roll === 1) {
                results.push({ item: item.name, stock, restocks: Math.max(0, Math.floor(restocks)) });
            }
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

    const baseSeed = GetBaseSeed(type);

    const raw = GetStockDataDump(type);
    const data = SortDataToGameOrder(type, raw);
    if (!data || !Array.isArray(data)) return [];

    const maxSearch = 2_000_000; // safety cap similar to Lua reference
    const results = [];
    let offset = 0;

    const RestockCycleDuration = RNGInfo[type].restock_cycle_duration

    const now = Math.floor(Date.now() / 1000);
    const secondsUntilNext = GetNextRestockUnix(now, RestockCycleDuration) - now;

    const PredictQuantityFunc = type == "Egg" ? PredictEggQuantity : PredictQuantity

    while (results.length < occurrences && offset <= maxSearch) {
        const qty = PredictQuantityFunc(baseSeed + offset, itemName, data);
        if (qty != null) {
            const extraIntervals = offset > 0 ? (offset - 1) : 0; // match Luau: next restock for offset 0 or 1
            const future = now + secondsUntilNext + (extraIntervals * RestockCycleDuration);
            const unix = Math.floor((future / 60) + 0.5) * 60; // round to nearest minute like Luau
            results.push({ item: itemName, stock: qty, restocks: offset, unix });
        }
        offset += 1;
    }

    return results;
}