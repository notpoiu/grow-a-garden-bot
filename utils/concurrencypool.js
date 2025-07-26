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
        
        while (this.activeJobs < this.MaximumJobs && this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift();
            this.activeJobs++;

            // Process job asynchronously without awaiting
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
            
            // After a job completes, wait before processing more if we're still at capacity
            if (this.activeJobs >= this.MaximumJobs) {
                await new Promise(resolve => setTimeout(resolve, this.Timeout));
            }
            
            // Try to process more jobs from the queue
            this.processQueue();
        }
    }
}