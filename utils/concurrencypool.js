export class ConcurrencyPool {
    constructor(MaximumJobsPerWindow, WindowMs = 1000) {
        // This pool enforces a rate of MaximumJobsPerWindow per WindowMs
        this.MaximumJobsPerWindow = Math.max(1, Number(MaximumJobsPerWindow) || 1);
        this.WindowMs = Math.max(1, Number(WindowMs) || 1000);

        this.queue = [];
        this.activeJobs = 0;

        // Token bucket for rate limiting
        this.tokens = this.MaximumJobsPerWindow;
        this._refillTimer = setInterval(() => {
            this.tokens = this.MaximumJobsPerWindow;
            this.processQueue();
        }, this.WindowMs).unref?.();
    }

    async execute(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.queue.length === 0) return;

        while (this.tokens > 0 && this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift();
            this.tokens--;
            this.activeJobs++;
            this.processJob(fn, resolve, reject);
        }
    }

    async processJob(fn, resolve, reject) {
        try {
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.activeJobs--;
            // Attempt to process more if tokens are available
            this.processQueue();
        }
    }
}