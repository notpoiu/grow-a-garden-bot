--// Config
local BaseURL = "http://localhost:8080"
local APIKey = "Mango"

local EventShopPresent = true

--// Waiting
if not game:IsLoaded() then
    game.Loaded:Wait()
end

--// Services
local HttpService = cloneref(game:GetService("HttpService"))
local Players = cloneref(game:GetService("Players"))
local ReplicatedStorage = cloneref(game:GetService("ReplicatedStorage"))
local VirtualUser = cloneref(game:GetService("VirtualUser"))

--// Variables
local LocalPlayer = Players.LocalPlayer

local GameEvents = ReplicatedStorage:WaitForChild("GameEvents")
local DataStream = GameEvents:WaitForChild("DataStream")

local DataFolder = ReplicatedStorage:WaitForChild("Data")
local SeedDataModule = DataFolder.SeedData
local GearDataModule = DataFolder.GearData
local PetEggsModule = DataFolder.PetRegistry.PetEggs
local EventShopDataModule = DataFolder.EventShopData

--// Modules
local SeedDataSrc = require(SeedDataModule)
local GearDataSrc = require(GearDataModule)
local PetEggsSrc = require(PetEggsModule)
local EventShopDataSrc = require(EventShopDataModule)

--// Initialization
do
    --// Seed Data Handler
    local SeedData = {}
    for Name, FruitData in SeedDataSrc do
        if not FruitData["FruitIcon"] then
            continue
        end
        
        SeedData[Name] = FruitData.FruitIcon
    end

    --// Gear Data Handler
    local GearData = {}
    for Name, ToolData in GearDataSrc do
        if not ToolData["Asset"] then
            continue
        end

        GearData[Name] = ToolData.Asset
    end

    --// Pet Data Handler
    local PetData = {}
    for Name, Data in PetEggsSrc do
        if not Data["HatchTime"] or not Data["Icon"] then
            continue
        end

        PetData[Name] = Data.Icon
    end

    --// Weather Data Handler
    local WeatherData = workspace:GetAttribute("AllWeather")

    --// Data Synchronization Requests
    for Name, Data in pairs({
        ["Seed"] = SeedData,
        ["Gear"] = GearData,
        ["Egg"] = PetData,
        ["Weather"] = WeatherData,
    }) do
        task.spawn(request, {
            Url = `{BaseURL}/data/update/{Name}`,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["Authorization"] = APIKey,
            },
            Body = if typeof(Data) == "string" then Data else HttpService:JSONEncode(Data),
        })

        print(`[Sync] Sent {Name} Data to Server`)
    end
end

LocalPlayer.Idled:Connect(function()
    VirtualUser:CaptureController()
    VirtualUser:ClickButton2(Vector2.new())
end)

--// Listening
--// Stock
DataStream.OnClientEvent:Connect(function(type, id, data)
    if type ~= "UpdateData" or id ~= `{LocalPlayer.Name}_DataServiceProfile` then
        return
    end

    --// Process Data
    local DataBatchQueue = {}

    --// Get Stock
    for Idx, Item in pairs(data) do
        if Idx % 10 == 0 then task.wait() end

        --// Variables
        local Path = Item[1]
        local RawStockData = Item[2]
        if Path:sub(-7) ~= "/Stocks" then
            continue
        end


        --// Event Shop
        if EventShopPresent and Path == "ROOT/EventShopStock/Stocks" then
            local DataToInsert = {
                type = "EventShop",
                data = {},
            }

            for Name, ItemData in RawStockData do
                local ItemInfo = EventShopDataSrc[Name]
                if not ItemInfo then
                    continue
                end

                DataToInsert.data[Name] = ItemData.MaxStock
            end

            table.insert(DataBatchQueue, DataToInsert)

        elseif Path == "ROOT/SeedStock/Stocks" then
            
            local DataToInsert = {
                type = "Seed",
                data = {},
            }

            for Name, ItemData in RawStockData do
                DataToInsert.data[Name] = ItemData.MaxStock
            end

            table.insert(DataBatchQueue, DataToInsert)

        elseif Path == "ROOT/GearStock/Stocks" then

            local DataToInsert = {
                type = "Gear",
                data = {},
            }

            for Name, ItemData in RawStockData do
                DataToInsert.data[Name] = ItemData.MaxStock
            end

            table.insert(DataBatchQueue, DataToInsert)

        elseif Path == "ROOT/PetEggStock/Stocks" then

            local DataToInsert = {
                type = "Egg",
                data = {},
            }

            for _, ItemData in RawStockData do
                DataToInsert.data[ItemData.EggName] = ItemData.MaxStock
            end

            table.insert(DataBatchQueue, DataToInsert)

        end

    end

    --// Send Data to Server
    for _, data in DataBatchQueue do
        task.spawn(request, {
            Url = `{BaseURL}/stock/update/{data.type}`,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["Authorization"] = APIKey,
            },
            Body = HttpService:JSONEncode(data.data),
        })

        print(`[Stock] Sent {data.type} Data to Server`)
    end

end)

--// Weather
ReplicatedStorage.GameEvents.WeatherEventStarted.OnClientEvent:Connect(function(weather, timeout)
    
end)

--// Special Events (e.g. Bee Swarm)
ReplicatedStorage.GameEvents.SpecialEventStarted.OnClientEvent:Connect(function(event, timeout)
    
end)