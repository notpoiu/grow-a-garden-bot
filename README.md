# Stock Watcher Source Code
Source released cuz i didnt feel like keeping the bot up

## Setting up

env variables:
```
BOT_TOKEN=discord bot token
CLIENT_ID=client id of the application

# Gemini API Key for Weather Data
GEMINI_API_KEY=Gemini API key for automatically getting approriate weather emoji stuff

# Client
CLIENT_API_KEY=Api Key To Update Database

# dev
DEV_MODE=true
```

starting up:
```
npm run dev
```

then setup a bot that executes this:
```lua
api_key="Api Key To Update Database"
base_url="http://localhost:8080" -- url to ur hosted api or whatever idk bro
loadstring(game:HttpGet(`{base_url}/script.luau`))()
```

and ur done
