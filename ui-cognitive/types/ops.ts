export type OpsContainer = {
  name: string;
  id: string;
  image: string;
  status: string;
  state: string;
  ports: string[];
  created_at: string;
  started_at: string;
};

export type OpsNote = {
  id: string;
  container_name: string;
  note_type: "instruction" | "pattern" | "daily_summary" | "anomaly";
  content: string;
  created_at: string;
};

export type CronJobItem = {
  id: string;
  description: string;
  cron_expr: string;
  next_run: string | null;
  status: "active" | "paused";
};

export type OpsStatusResponse = {
  containers: OpsContainer[];
};

export type OpsNotesResponse = {
  notes: OpsNote[];
};

export type OpsContainerInspect = {
  name: string;
  id: string;
  image: string;
  status: string;
  running: boolean;
  exit_code: number;
  restart_count: number;
  restart_policy: string;
};

export type OpsSignalsSourceState = "ok" | "degraded";

export type OpsSignalsSourceHealth = {
  status: OpsSignalsSourceState;
  reason: string | null;
};

export type OpsAlertSeverity = "warning" | "error";

export type OpsExceptionAlert = {
  code: "degraded_containers" | "high_latency" | "high_error_rate" | "source_unavailable";
  severity: OpsAlertSeverity;
  message: string;
};

export type OpsStrategicSignals = {
  generatedAt: string;
  running: number;
  total: number;
  degraded: number;
  degradedNames: string[];
  activeJobs: number;
  avgLatencyMs: number | null;
  errorCount: number;
  sources: {
    status: OpsSignalsSourceHealth;
    jobs: OpsSignalsSourceHealth;
    observability: OpsSignalsSourceHealth;
  };
  alerts: OpsExceptionAlert[];
};
