// Initialization
import 'dotenv/config';

console.log(`    ▲ GAG Stock Bot - by upio

    ┌ ○ Environment: ${process.env.NODE_ENV || "development"}
    ├ ○ Version: ${process.env.VERSION || "1.0.0"}
    └ ○ Node.js Version: ${process.version}
`)


// imports
import { InitServer } from "./data/communication/server/server.js";


InitServer();