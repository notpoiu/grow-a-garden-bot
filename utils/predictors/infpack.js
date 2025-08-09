import { Random } from '../roblox.js';

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

export const CalculateSeedPackDay = (UnixTimestamp) => {
    const CurrentDate = new Date(UnixTimestamp || Date.now());
    
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
export const GetRobuxAmountForSuperSeeds = (targetSuperSeedCount, seed) => {
    if (targetSuperSeedCount <= 0) {
        return 0;
    }

    // RNG stuff
    const rng = new Random(CalculateSeedPackDay(seed));
    let totalRobux = 0;
    let paidTimes = 0;
    let superSeedsFound = 0;
    let rewardIndex = 0;

    while (superSeedsFound < targetSuperSeedCount) {
        rewardIndex++;

        const isPaidSlot = rewardIndex > 1 && (rewardIndex - 2) % 5 === 0;

        if (isPaidSlot) {
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

            const reward = RandomFromArray(SuperSeedRewards.Paid, rng);
            if (reward && reward.Name === "Super Seed") {
                superSeedsFound++;
            }
        } else {
            // We still need to advance the random number generator to keep the sequence correct.
            RandomFromArray(SuperSeedRewards.Free, rng);
        }
    }

    return {
        price: totalRobux,
        paidTimes: paidTimes,
    }
}