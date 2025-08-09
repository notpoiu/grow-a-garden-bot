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
