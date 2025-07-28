export class ExpiringCache {
    constructor(ExpiryTime = 5 * 60 * 1000) {
        this.ExpiryTime = ExpiryTime;
        this.Cache = new Map();
    }

    Set(key, value) {
        this.Cache.set(key, {
            Data: value,
            Timestamp: Date.now()
        });
    }

    Get(key) {
        const entry = this.Cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.Timestamp > this.ExpiryTime) {
            this.Cache.delete(key);
            return null;
        }

        return entry.Data;
    }

    Has(key) {
        const entry = this.Cache.get(key);
        if (!entry) return false;

        const now = Date.now();
        if (now - entry.Timestamp > this.ExpiryTime) {
            this.Cache.delete(key);
            return false;
        }

        return true;
    }

    Delete(key) {
        return this.Cache.delete(key);
    }

    Clear() {
        this.Cache.clear();
    }

    CleanExpired() {
        const now = Date.now();
        for (const [key, entry] of this.Cache.entries()) {
            if (now - entry.Timestamp > this.ExpiryTime) {
                this.Cache.delete(key);
            }
        }
    }

    GetSize() {
        return this.Cache.size;
    }

    GetKeys() {
        return Array.from(this.Cache.keys());
    }
}