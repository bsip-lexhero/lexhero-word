import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser, LexheroResponse } from '../common/contracts';
import type { WebhookRequestDto } from '../workflows/workflow.dto';
import { WorkflowService } from '../workflows/workflow.service';

type Job = {
  userId: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  response?: LexheroResponse;
  error?: string;
};

@Injectable()
export class WebhookJobService {
  private readonly jobs = new Map<string, Job>();
  private readonly ttlMs = 15 * 60_000;

  constructor(private readonly workflows: WorkflowService) {}

  start(user: AuthUser, dto: WebhookRequestDto) {
    this.removeExpiredJobs();
    const jobId = crypto.randomUUID();
    const job: Job = { userId: user.id, status: 'pending', createdAt: Date.now() };
    this.jobs.set(jobId, job);

    // Deliberately detach the long n8n request from the Office WebView request.
    // The add-in only keeps short polling requests open, avoiding its ~60s network limit.
    void this.workflows.execute(user, dto, true).then((response) => {
      job.status = 'completed';
      job.response = response;
    }).catch((error: unknown) => {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Analisi non riuscita';
    });

    return { jobId, status: job.status };
  }

  get(user: AuthUser, jobId: string) {
    this.removeExpiredJobs();
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== user.id) throw new NotFoundException('Analisi non trovata o scaduta.');
    return { status: job.status, response: job.response, error: job.error };
  }

  private removeExpiredJobs() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, job] of this.jobs) if (job.createdAt < cutoff) this.jobs.delete(id);
  }
}
