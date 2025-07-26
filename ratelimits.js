// Ratelimit definitons for the Discord REST api endpoints.

export default {
    RequestsPerSecond: 42, // Maximum is actually 50, but we use 42 to avoid hitting the limit for other requests
}