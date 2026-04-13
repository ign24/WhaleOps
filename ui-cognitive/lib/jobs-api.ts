export type CronJob = {
  id: string;
  description: string;
  cron_expr: string;
  next_run: string | null;
  status: "active" | "paused";
};

export type CreateJobBody = {
  cron_expr: string;
  prompt: string;
  description: string;
};

export type JobsApiError = {
  error: string;
  status: number;
};

export async function fetchJobs(): Promise<CronJob[]> {
  const response = await fetch("/api/jobs/cron", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(new Error(payload.error ?? `HTTP ${response.status}`), {
      status: response.status,
    });
  }
  return response.json() as Promise<CronJob[]>;
}

export async function createJob(body: CreateJobBody): Promise<CronJob> {
  const response = await fetch("/api/jobs/cron", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as CronJob & { error?: string };
  if (!response.ok) {
    throw Object.assign(new Error(payload.error ?? `HTTP ${response.status}`), {
      status: response.status,
    });
  }
  return payload;
}

export async function cancelJob(id: string): Promise<void> {
  const response = await fetch(`/api/jobs/cron/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(new Error(payload.error ?? `HTTP ${response.status}`), {
      status: response.status,
    });
  }
}
