// Ratelimit definitons for the Discord REST api endpoints.

export default {
    RequestsPerSecond: 35, // Maximum is actually 50, but we use 35 to avoid hitting the limit for other requests
}