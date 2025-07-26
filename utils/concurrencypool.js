export class ConcurrencyPool {
    constructor(MaximumJobs, Timeout = 1000) {
        this.MaximumJobs = MaximumJobs;
        this.Timeout = Timeout;
        this.queue = [];
        this.activeJobs = 0;
    }
    
    async execute(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.activeJobs >= this.MaximumJobs || this.queue.length === 0) return;
        
        const Timeout = this.Timeout / this.MaximumJobs;
        while (this.activeJobs < this.MaximumJobs && this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift();
            this.activeJobs++;

            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            }

            this.activeJobs--;

            // Wait before processing next request
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Timeout));
            }
        }
    }
}