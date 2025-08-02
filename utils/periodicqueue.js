export class PeriodicQueue {
    constructor(processInterval = 5000, maxBatchSize = 10) {
        this.processInterval = processInterval; // How often to process the queue (ms)
        this.maxBatchSize = maxBatchSize; // Maximum items to process at once
        this.queue = [];
        this.isProcessing = false;
        this.intervalId = null;
        this.processingFunction = null;
        
        // Start the periodic processing
        this.startPeriodicProcessing();
    }
    
    // Add data to the queue
    add(data) {
        this.queue.push({
            data,
            timestamp: Date.now()
        });
    }
    
    // Add multiple items to the queue
    addBatch(items) {
        const timestamp = Date.now();
        const queueItems = items.map(data => ({ data, timestamp }));
        this.queue.push(...queueItems);
    }
    
    // Set the function that will process the queue data
    setProcessor(processingFunction) {
        this.processingFunction = processingFunction;
    }
    
    // Start periodic processing
    startPeriodicProcessing() {
        if (this.intervalId) return; // Already running
        
        this.intervalId = setInterval(() => {
            this.processQueue();
        }, this.processInterval);
    }
    
    // Stop periodic processing
    stopPeriodicProcessing() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    // Process the queue (can be called manually or automatically)
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
            // Get batch of items to process
            const batchSize = Math.min(this.maxBatchSize, this.queue.length);
            const batch = this.queue.splice(0, batchSize);
            
            if (this.processingFunction) {
                // Call the custom processing function with the batch
                await this.processingFunction(batch);
            } else {
                // Default processing: just log the data
                console.log('Processing batch:', batch.map(item => item.data));
            }
            
        } catch (error) {
            console.error('Error processing queue:', error);
            // Optionally re-add failed items back to queue
            // this.queue.unshift(...batch);
        } finally {
            this.isProcessing = false;
        }
    }
    
    // Force immediate processing
    async flush() {
        await this.processQueue();
    }
    
    // Get current queue status
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            isRunning: this.intervalId !== null
        };
    }
    
    // Clear the queue without processing
    clear() {
        this.queue = [];
    }
    
    // Get queue contents without removing them
    peek() {
        return [...this.queue];
    }
    
    // Cleanup method
    destroy() {
        this.stopPeriodicProcessing();
        this.clear();
        this.processingFunction = null;
    }
}