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