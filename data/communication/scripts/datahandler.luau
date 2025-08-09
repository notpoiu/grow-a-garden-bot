--// Config
local BaseURL = base_url
local APIKey = api_key
local OnlySendStaticData = only_send_static_data or false

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

local ModulesFolder = ReplicatedStorage:WaitForChild("Modules")
local UpdateServiceModule = ModulesFolder:WaitForChild("UpdateService")
local DataServiceModule = ModulesFolder:WaitForChild("DataService")

local DataFolder = ReplicatedStorage:WaitForChild("Data")
local SeedDataModule = DataFolder.SeedData
local GearDataModule = DataFolder.GearData
local PetEggsDataModule = DataFolder.PetEggData
local PetEggsModule = DataFolder.PetRegistry.PetEggs

local EventShopDataModule = DataFolder.EventShopData

--// Modules
local SeedDataSrc = require(SeedDataModule)
local GearDataSrc = require(GearDataModule)

local PetEggsDataSrc = require(PetEggsDataModule) --// For Data
local PetEggsSrc = require(PetEggsModule) ---// For Images

local EventShopDataSrc = require(EventShopDataModule)

local UpdateServiceSrc = require(UpdateServiceModule)
local DataServiceSrc = require(DataServiceModule)

local SeedRNGSeed = DataServiceSrc:GetData().SeedStock.Seed
local GearRNGSeed = DataServiceSrc:GetData().GearStock.Gear

--// Functions
local function RemoveRichText(str)
	str = str:gsub("<br%s*/>", "\n")
	return str:gsub("<[^<>]->", "")
end

local function ExtractItemAndShop(message) -- [ItemName] was restocked in the [ShopName] shop!
	local itemName, shopName = string.match(message, "^(.-) was restocked in the (.-) shop!?$")
	return itemName, tostring(shopName or ""):gsub("^%l", string.upper)
end

--// Initialization
do
	--// Helper Functions
	local function GetDataFromModule(module, callback)
		local IconData = {}
		for Name, Data in module do
			local Result, CustomResponse = callback(Data, Name)
			if typeof(Result) == nil then
				continue
			end

			if not CustomResponse then
				Result = Data[Result]
			end

			IconData[Name] = Result
		end

		local VisibleData = {}
		for Name, Data in module do
			if
				(typeof(Data.DisplayInShop) == "boolean" and Data.DisplayInShop == false)
				or (UpdateServiceSrc:IsHiddenFromUpdate(Name) or UpdateServiceSrc:IsHiddenAfterUpdate(Name))
			then
				continue
			end

			local Order = if Data["LayoutOrder"] then Data.LayoutOrder else 0

			VisibleData[Name] = Order
		end

		--// Sort Visible Data by Layout Order
		local StagedSortedData = {}
		for Name, LayoutOrder in VisibleData do
			table.insert(StagedSortedData, { Name, LayoutOrder })
		end

		table.sort(StagedSortedData, function(a, b)
			return a[2] < b[2]
		end)

		VisibleData = StagedSortedData

		--// Update Visible Data to be an array
		local SortedVisibleData = {}
		for _, Data in VisibleData do
			table.insert(SortedVisibleData, Data[1])
		end

		return IconData, SortedVisibleData
	end

	--// Seed Data Handler
	local SeedData, VisibleSeeds = GetDataFromModule(SeedDataSrc, function(Data)
		if not Data["FruitIcon"] then
			return nil
		end

		return "FruitIcon"
	end)

	--// Gear Data Handler
	local GearData, VisibleGear = GetDataFromModule(GearDataSrc, function(Data)
		if not Data["Asset"] then
			return nil
		end

		return "Asset"
	end)

	--// Pet Data Handler
	local PetData, VisibleEgg = GetDataFromModule(PetEggsDataSrc, function(_, Name)
		if not PetEggsSrc[Name] then
			return nil
		end

		local Data = PetEggsSrc[Name]
		if not Data["Icon"] or not Data["HatchTime"] then
			return nil
		end

		return Data["Icon"], true
	end)

	--// Weather Data Handler
	local WeatherData = workspace:GetAttribute("AllWeather")

	--// Data Synchronization Requests
	for Name, Data in pairs({
		["Seed"] = SeedData,
		["SeedVisibilityShop"] = VisibleSeeds,

		["Gear"] = GearData,
		["GearVisibilityShop"] = VisibleGear,

		["Egg"] = PetData,
		["EggVisibilityShop"] = VisibleEgg,

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

	--// Predictor Data Handler
	for Type, Seed in pairs({
		["Seed"] = SeedRNGSeed,
		["Gear"] = GearRNGSeed,
	}) do
		task.spawn(request, {
			Url = `{BaseURL}/predictor/seed/{Type}`,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["Authorization"] = APIKey,
			},
			Body = HttpService:JSONEncode({ seed = Seed }),
		})

		print(`[Predictor] Sent Seed for {Type} to Server`)
	end

	-- Build filtered, sorted arrays for predictor data dump (mirrors Predictor.lua)
	local FilteredSeedArray = {}
	for seedName, seedInfo in SeedDataSrc do
		if seedInfo.StockChance ~= 0 then
			local entry = {}
			for k, v in seedInfo do
				entry[k] = v
			end
			entry.name = seedName
			table.insert(FilteredSeedArray, entry)
		end
	end

	table.sort(FilteredSeedArray, function(a, b)
		local aPrice = a.Price or 0
		local bPrice = b.Price or 0
		if aPrice == bPrice then
			local aOrder = a.LayoutOrder or 0
			local bOrder = b.LayoutOrder or 0
			return aOrder < bOrder
		end
		return aPrice < bPrice
	end)

	local FilteredGearArray = {}
	for name, data in GearDataSrc do
		local entry = {}
		for k, v in data do
			entry[k] = v
		end
		entry.name = name
		table.insert(FilteredGearArray, entry)
	end

	table.sort(FilteredGearArray, function(a, b)
		if a.name == "Medium Toy" and b.name == "Medium Treat" then
			return false
		elseif a.name == "Medium Treat" and b.name == "Medium Toy" then
			return true
		else
			local aPrice = a.Price or 0
			local bPrice = b.Price or 0
			return aPrice < bPrice
		end
	end)

	for Type, Data in pairs({
		["Seed"] = FilteredSeedArray,
		["Gear"] = FilteredGearArray,
	}) do
		task.spawn(request, {
			Url = `{BaseURL}/predictor/data_dump/{Type}`,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["Authorization"] = APIKey,
			},
			Body = HttpService:JSONEncode({ data = Data }),
		})

		print(`[Predictor] Sent Data Dump for {Type} to Server`)
	end
end

LocalPlayer.Idled:Connect(function()
	VirtualUser:CaptureController()
	VirtualUser:ClickButton2(Vector2.new())
end)

--// Listening
if OnlySendStaticData then
	print("[DataHandler] Sent static data! Skipping further updates.")
	return
end

--// Stock
DataStream.OnClientEvent:Connect(function(type, id, data)
	if type ~= "UpdateData" or id ~= `{LocalPlayer.Name}_DataServiceProfile` then
		return
	end

	--// Process Data
	local DataBatchQueue = {}

	--// Get Stock
	for Idx, Item in pairs(data) do
		if Idx % 10 == 0 then
			task.wait()
		end

		--// Variables
		local Path = Item[1]
		local RawStockData = Item[2]

		--// Predictor Data Handler
		if Path == "ROOT/SeedStock/Seed" then
			if RawStockData ~= SeedRNGSeed then
				SeedRNGSeed = RawStockData

				task.spawn(request, {
					Url = `{BaseURL}/predictor/seed/Seed`,
					Method = "POST",
					Headers = {
						["Content-Type"] = "application/json",
						["Authorization"] = APIKey,
					},
					Body = HttpService:JSONEncode({ seed = SeedRNGSeed }),
				})

				print(`[Predictor] Sent Seed for Seed to Server`)
			end
		elseif Path == "ROOT/GearStock/Gear" then
			if RawStockData ~= GearRNGSeed then
				GearRNGSeed = RawStockData

				task.spawn(request, {
					Url = `{BaseURL}/predictor/seed/Gear`,
					Method = "POST",
					Headers = {
						["Content-Type"] = "application/json",
						["Authorization"] = APIKey,
					},
					Body = HttpService:JSONEncode({ seed = GearRNGSeed }),
				})
			end
		end

		--// Stock Data Handler
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
				if not DataToInsert.data[ItemData.EggName] then
					DataToInsert.data[ItemData.EggName] = 0
				end

				DataToInsert.data[ItemData.EggName] += ItemData.Stock
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
	if not weather or not timeout then
		return
	end

	if timeout < 10 then
		warn(`[Weather] Timeout is less than 10 seconds: {timeout}`)
		return
	end

	task.spawn(request, {
		Url = `{BaseURL}/stock/update/Weather`,
		Method = "POST",
		Headers = {
			["Content-Type"] = "application/json",
			["Authorization"] = APIKey,
		},
		Body = HttpService:JSONEncode({
			["name"] = weather,
			["timeout"] = timeout,
		}),
	})
	print(`[Weather] Sent Weather: {weather} with Timeout: {timeout} to Server`)
end)

--// Special Events (e.g. Bee Swarm)
ReplicatedStorage.GameEvents.SpecialEventStarted.OnClientEvent:Connect(function(event, timeout)
	if not event or not timeout then
		return
	end

	if timeout < 10 then
		warn(`[SpecialEvent] Timeout is less than 10 seconds: {timeout}`)
		return
	end

	task.spawn(request, {
		Url = `{BaseURL}/stock/update/Weather`,
		Method = "POST",
		Headers = {
			["Content-Type"] = "application/json",
			["Authorization"] = APIKey,
		},
		Body = HttpService:JSONEncode({
			["name"] = event,
			["timeout"] = timeout,
		}),
	})
	print(`[SpecialEvent] Sent Event: {event} with Timeout: {timeout} to Server`)
end)

--// Admin Restock
ReplicatedStorage.GameEvents.Notification.OnClientEvent:Connect(function(message)
	message = tostring(message)

	if message:match("was restocked in the") then
		local itemName, shopName = ExtractItemAndShop(RemoveRichText(message))
		if not itemName then
			return
		end

		task.spawn(request, {
			Url = `{BaseURL}/stock/update/Admin%20Restock`,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["Authorization"] = APIKey,
			},
			Body = HttpService:JSONEncode({
				["shop"] = shopName,
				["stock"] = itemName,
			}),
		})
		print(`[AdminRestock] Sent Restock for {itemName} in {shopName} to Server`)
	end
end)
