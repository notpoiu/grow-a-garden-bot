import express from 'express';

export const json = express.json();

export function auth(req, res, next) {
    const normalizedHeaders = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), value]));

    if (req.url == "/script" || req.url == "/" || req.url == "/dashboard") {
        return next();
    }

    if (normalizedHeaders['authorization'] !== process.env.CLIENT_API_KEY) {
        return res.status(401).send({ error: 'Unauthorized' });
    }

    next();
}