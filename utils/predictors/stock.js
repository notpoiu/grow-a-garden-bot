import { GetStockDataDump, GetStockTypes } from "../db.js"
import { Random } from "../roblox.js"

const RestockCycleDurations = {
    Seed: 5 * 60,
    Gear: 5 * 60,
    Egg: 30 * 60
}

const SeedOffset = 473451234;

const SortDataToGameOrder = (type, data) => {
    if (!Array.isArray(data)) return [];

    let arr = data.slice();
    if (type === "Gear") {
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

const GetRestockCycleSeconds = (type) => {
    const duration = RestockCycleDurations[type];
    return Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : 300;
}

const GetBaseSeed = (type) => {
    const period = GetRestockCycleSeconds(type);
    const nowSec = Math.floor(Date.now() / 1000);

    return Math.floor(nowSec / period) + SeedOffset;
}

const GetRestockUnix = (restock_amount, restock_cycle_duration = 300) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const currentCycleStart = nowSec - (nowSec % restock_cycle_duration);
    return currentCycleStart + (restock_amount * restock_cycle_duration);
}

// Returns all items predicted to be in stock after `restocks` future restocks for the given `type`.
// Each entry: { item, stock, restocks }
export const PredictStock = (type, restocks = 0) => {
    const baseSeed = GetBaseSeed(type);
    
    const raw = GetStockDataDump(type);
    
    const data = SortDataToGameOrder(type, raw);
    if (!data || !Array.isArray(data)) return null;
    
    const rng = new Random(baseSeed + restocks);
    let results = [];

    for (const item of data) {
        const roll = rng.NextInteger(1, item.StockChance);

        const [minAmt, maxAmt] = GetMinMaxFromStockAmount(item.StockAmount);
        const amount = rng.NextInteger(minAmt, maxAmt);

        if (roll === 1 && amount > 0 && item.DisplayInShop) {
            results.push({ item: item.name, stock: amount, restocks: restocks });
        }
    }
    
    return results;
}

// Helper to find which stock `type` contains an item by name, by scanning known types' data dumps
export const FindTypeForItem = (itemName) => {
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

const MaxSearch = 2_000_000;
export const PredictStockOccurences = (itemName, occurrences) => {
    const type = FindTypeForItem(itemName);
    if (!type) return [];

    let totalOccurences = 0;

    const restockCycleDuration = GetRestockCycleSeconds(type);

    const results = [];
    for (let offset = 0; offset <= MaxSearch; offset++) {
        if (totalOccurences >= occurrences) break;

        const stock = PredictStock(type, offset);

        const found = stock.find((i) => i.item === itemName);
        if (found) {
            totalOccurences += 1;
            results.push({
                item: itemName,
                stock: found.stock,
                restocks: offset,
                unix: GetRestockUnix(offset, restockCycleDuration)
            });
        }
    }

    return results;
}