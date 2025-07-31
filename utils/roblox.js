import Logger from "../logger.js";

export const GetAssetIdBinary = async (asset_id, encoding) => {
    const response = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${asset_id}&size=150x150&format=Png&isCircular=false`);
    if (!response.ok) {
        Logger.error(`Failed to fetch asset ID ${asset_id}: ${response.statusText}`);
        return false;
    }
    
    const data = await response.json();
    if (data.data.length === 0 || !data.data[0].imageUrl) {
        Logger.error(`No image found for asset ID ${asset_id}`);
        return false;
    }

    const imageResponse = await fetch(data.data[0].imageUrl);
    if (!imageResponse.ok) {
        Logger.error(`Failed to fetch image from ${data.data[0].imageUrl}: ${imageResponse.statusText}`);
        return false;
    }

    if (encoding) {
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer.toString(encoding);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Roblox Random Class Implementation
export class Random {
  // PCG parameters from Luau's mathlib (see PCG32_INC = 105)
  static MULT   = 6364136223846793005n;
  static INC    = 105n;                         // PCG32_INC | 1
  static MASK64 = (1n << 64n) - 1n;

  constructor(seed = Date.now()) {
    // 1) Two-step PCG seed, just like pcg32_seed(&state, seed) in Luau:
    this._state = 0n;
    this._inc   = Random.INC;
    this._nextInternal();                                    // warm-up #1
    this._state = (this._state + BigInt(Math.floor(seed))) & Random.MASK64;
    this._nextInternal();                                    // warm-up #2
  }

  // Advance state & return a 32-bit unsigned int (pcg32_random)
  _nextInternal() {
    const old = this._state;
    this._state = (old * Random.MULT + this._inc) & Random.MASK64;
    // XSH-RR output transform:
    const xorshifted = Number(((old >> 18n) ^ old) >> 27n) >>> 0;
    const rot        = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((32 - rot) & 31))) >>> 0;
  }

  // Build a full 64-bit fraction by calling the 32-bit core twice
  _nextFraction64() {
    const lo = BigInt(this._nextInternal());
    const hi = BigInt(this._nextInternal());
    const bits = (hi << 32n) | lo;
    // divide by 2^64 to get [0,1) double
    return Number(bits) / 2**64;
  }

  // Match Random:NextNumber([min,max))
  NextNumber(min = 0, max = 1) {
    const frac = this._nextFraction64();
    return min + frac * (max - min);
  }

  // (Optional) match math.random([l],[u]) for integers
  NextInteger(min, max) {
    if (max === undefined) {
      // single-arg: [1..min]
      const u = min;
      const r32 = this._nextInternal();
      const x = BigInt(u) * BigInt(r32);
      return Number((x >> 32n) + 1n);
    } else {
      // two-arg: [min..max]
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const u  = BigInt(hi - lo + 1);
      const r32 = this._nextInternal();
      const x = u * BigInt(r32);
      return Number((x >> 32n) + BigInt(lo));
    }
  }
}

// Super Seed Rewards Configuration
const SuperSeedRewards = {
    Free: [
        {
            Name: "50¢",
            Coins: 50,
            Chance: (1 / 3),
            Icon: "rbxassetid://111559087552483",
            Color: "rgb(255, 255, 0)"
        },
        {
            Name: "100¢",
            Coins: 100,
            Chance: (1 / 3),
            Icon: "rbxassetid://84541528477238",
            Color: "rgb(255, 255, 0)"
        },
        {
            Name: "Watering Can X1",
            Coins: 25,
            Chance: (1 / 3),
            Icon: "rbxassetid://108707176647018",
            Color: "rgb(170, 170, 170)"
        }
    ],
    Paid: [
        {
            Name: "Super Seed",
            Chance: 5,
            Icon: "rbxassetid://119802391042790",
            Color: "rgb(255, 0, 0)"
        },
        {
            Name: "Apple Seed",
            Chance: 20,
            Icon: "rbxassetid://128318449902634",
            Color: "rgb(0, 255, 0)"
        },
        {
            Name: "500¢",
            Chance: 20,
            Icon: "rbxassetid://94889540639216",
            Color: "rgb(255, 255, 0)"
        },
        {
            Name: "1,000¢",
            Chance: 20,
            Icon: "rbxassetid://123750064988458",
            Color: "rgb(255, 255, 0)"
        },
        {
            Name: "2,000¢",
            Chance: 20,
            Icon: "rbxassetid://71146286015050",
            Color: "rgb(255, 255, 0)"
        },
        {
            Name: "Watering Can X1",
            Chance: 25,
            Icon: "rbxassetid://108707176647018",
            Color: "rgb(170, 170, 170)"
        },
        {
            Name: "Watering Can X3",
            Chance: 10,
            Icon: "rbxassetid://70390145378562",
            Color: "rgb(170, 170, 170)"
        },
        {
            Name: "Watering Can X5",
            Chance: 5,
            Icon: "rbxassetid://73981405252852",
            Color: "rgb(170, 170, 170)"
        },
        {
            Name: "Watering Can X10",
            Chance: 3,
            Icon: "rbxassetid://106733159472445",
            Color: "rgb(170, 170, 170)"
        }
    ]
}

const ProductMaxThreshold = [
    [3250226689, 15], // Product ID, Max Index until its available
    [3250227730, 25],
    [3250228324, 40],
    [3250229031, 70],
    [3250229162, Number.MAX_SAFE_INTEGER]
];

const ForeverPackPrices = {
    [3250226689]: 37,
    [3250227730]: 99,
    [3250228324]: 175,
    [3250229031]: 375,
    [3250229162]: 495
}

/**
 * Selects a random item from an array based on weighted chances.
 * @param {Array<Object>} array - The array of items to choose from. Each item must have a 'Chance' property.
 * @param {Random} rng - The random number generator instance to use.
 * @returns {Object|null} The selected item.
 */
const RandomFromArray = (array, rng) => {
    let TotalChance = 0;
    for (const item of array) {
        TotalChance += item.Chance;
    }

    const randomValue = rng.NextNumber(0, TotalChance);

    let cumulativeChance = 0;
    for (const item of array) {
        cumulativeChance += item.Chance;
        if (randomValue < cumulativeChance) {
            return item;
        }
    }
    return null;
}

const InternalGetSuperSeedRewards = (seed, maxrewardindex) => {
    const rng = new Random(seed);
    const rewards = [];
    let foundException = false;

    for (let index = 1; index <= maxrewardindex; index++) {
        let productID;

        if (index === 1 || (index !== 2 && Math.max(index - 2, 0) % 5 !== 0)) {
            productID = 0;
        } else {
            for (const [id, threshold] of ProductMaxThreshold) {
                if (index < threshold) {
                    productID = id;
                    foundException = true;
                    break;
                }
            }

            if (!foundException) {
                productID = 0;
            }
        }

        foundException = false;

        const rewardArray = productID === 0 ? SuperSeedRewards.Free : SuperSeedRewards.Paid;
        rewards.push(RandomFromArray(rewardArray, rng));
    }

    return rewards;
}


// Super Pack Day on July 30 2025.
// Each UTC it will increment the day by 1.

// Super Pack Day = Seed for the Super Seed Rewards.
const SuperPackDay_Date = new Date(Date.UTC(2025, 6, 31, 0, 0, 0));
const SuperPackDay = 20300;

export const CalculateSeedPackDay = () => {
    const CurrentDate = new Date(Date.now());
    
    // Get the difference in days from the Super Pack Day
    const TimeDiff = CurrentDate.getTime() - SuperPackDay_Date.getTime();
    const DayDiff = Math.floor(TimeDiff / (1000 * 60 * 60 * 24));

    return DayDiff + SuperPackDay;
}


export const GetSuperSeedRewards = (maxrewardindex) => {
    return InternalGetSuperSeedRewards(CalculateSeedPackDay(), maxrewardindex);
}

/**
 * Simulates the reward process to calculate the Robux cost to acquire a specific number of "Super Seed" items.
 * @param {number} targetSuperSeedCount - The desired number of "Super Seed" items to acquire.
 * @returns {number} The total estimated Robux cost.
 */
export const GetRobuxAmountForSuperSeeds = (targetSuperSeedCount) => {
    if (targetSuperSeedCount <= 0) {
        return 0;
    }

    // RNG stuff
    const rng = new Random(CalculateSeedPackDay());
    let totalRobux = 0;
    let paidTimes = 0;
    let superSeedsFound = 0;
    let rewardIndex = 0;

    // 3. Loop, generating rewards until we've found enough Super Seeds.
    while (superSeedsFound < targetSuperSeedCount) {
        rewardIndex++;

        // Determine if the current reward index corresponds to a paid slot.
        const isPaidSlot = rewardIndex > 1 && (rewardIndex - 2) % 5 === 0;

        if (isPaidSlot) {
            // This is a paid slot. It always costs Robux, regardless of the reward.
            
            // a. Find the product ID for this index and add its cost to the total.
            let productID = 0;
            for (const [id, threshold] of ProductMaxThreshold) {
                if (rewardIndex < threshold) {
                    productID = id;
                    break;
                }
            }
            
            if (productID !== 0 && ForeverPackPrices[productID]) {
                paidTimes += 1;

                totalRobux += ForeverPackPrices[productID];
            }

            // b. Now, determine which reward is received from the paid pool.
            const reward = RandomFromArray(SuperSeedRewards.Paid, rng);
            if (reward && reward.Name === "Super Seed") {
                superSeedsFound++;
            }
        } else {
            // This is a free slot. It costs no Robux.
            // We still need to advance the random number generator to keep the sequence correct.
            RandomFromArray(SuperSeedRewards.Free, rng);
        }
    }

    return {
        price: totalRobux,
        paidTimes: paidTimes,
    }
}