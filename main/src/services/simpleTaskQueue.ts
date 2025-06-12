import { EventEmitter } from 'events';

interface Job<T> {
  id: string;
  data: T;
  status: 'pending' | 'active' | 'completed' | 'failed';
  result?: any;
  error?: any;
}

export class SimpleQueue<T> extends EventEmitter {
  private jobs: Map<string, Job<T>> = new Map();
  private queue: string[] = [];
  private processing = false;
  private concurrency: number;
  private processor?: (job: Job<T>) => Promise<any>;
  private jobIdCounter = 0;

  constructor(name: string, concurrency = 1) {
    super();
    this.concurrency = concurrency;
    console.log(`[SimpleQueue] Created queue: ${name} with concurrency: ${concurrency}`);
  }

  process(concurrency: number, processor: (job: Job<T>) => Promise<any>) {
    this.concurrency = concurrency;
    this.processor = processor;
    console.log(`[SimpleQueue] Processor registered`);
    this.startProcessing();
  }

  async add(data: T): Promise<Job<T>> {
    const job: Job<T> = {
      id: String(++this.jobIdCounter),
      data,
      status: 'pending'
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    
    console.log(`[SimpleQueue] Job ${job.id} added to queue`);
    this.emit('waiting', job);
    
    // Start processing if not already running
    this.startProcessing();
    
    return job;
  }

  private activeJobs = 0;

  private async startProcessing() {
    if (!this.processor) {
      return;
    }

    // Process multiple jobs concurrently up to the concurrency limit
    while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
      this.processNextJob();
    }
  }

  private async processNextJob() {
    const jobId = this.queue.shift();
    if (!jobId) return;
    
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    this.activeJobs++;
    job.status = 'active';
    console.log(`[SimpleQueue] Processing job ${job.id} (active jobs: ${this.activeJobs}/${this.concurrency})`);
    this.emit('active', job);
    
    try {
      const result = await this.processor!(job);
      job.status = 'completed';
      job.result = result;
      console.log(`[SimpleQueue] Job ${job.id} completed`);
      this.emit('completed', job, result);
    } catch (error) {
      job.status = 'failed';
      job.error = error;
      console.error(`[SimpleQueue] Job ${job.id} failed:`, error);
      this.emit('failed', job, error);
    }
    
    this.activeJobs--;
    
    // Clean up completed job after a delay
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 5000);
    
    // Process next job if available
    if (this.queue.length > 0) {
      this.processNextJob();
    }
  }

  on(event: 'active' | 'completed' | 'failed' | 'waiting' | 'error', listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  async close() {
    // Clean up
    this.queue = [];
    this.jobs.clear();
  }
}