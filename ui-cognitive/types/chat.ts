export type ChatRole = "system" | "user" | "assistant";

export type TextBlock = { type: "text"; text: string };
export type ImageUrlBlock = { type: "image_url"; image_url: { url: string } };
export type ContentBlock = TextBlock | ImageUrlBlock;

export type GatewayChatMessage = {
  role: ChatRole;
  content: string | ContentBlock[];
};

export type MessageAttachment = {
  name: string;
  type: "code" | "image";
};

export type UiChatMessage = {
  id: string;
  timestamp: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  feedback?: {
    reaction: "up" | "down";
    comment?: string;
    updatedAt: string;
  };
  intermediateSteps?: Array<ActivityEntry | AgentActivityEvent>;
  attachments?: MessageAttachment[];
};

export type ToolEventStream = "tool_call" | "tool_start" | "tool_end";

export type ToolEvent = {
  stream: ToolEventStream;
  toolName: string;
};

export type ChatModelMetadata = {
  model?: string;
  provider?: string;
  costCategory?: "free" | "low" | "medium" | "high" | "unknown";
  billingType?: "trial" | "paid" | "self-hosted" | "unknown";
  budgetState?: "ok" | "warning" | "limited";
  estimatedCostUsd?: number;
  cumulativeSessionCostUsd?: number;
  cumulativeUserCostUsd?: number;
  fallbackFromModel?: string;
  guardrailEvent?: "none" | "warning" | "fallback" | "block";
  warningMessage?: string;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isEstimated: boolean;
  estimatedCostUsd?: number;
  cumulativeSessionCostUsd?: number;
  cumulativeUserCostUsd?: number;
  budgetState?: "ok" | "warning" | "limited";
};

export type AgentActivityEvent = {
  stream: string;
  timestamp: number;
  stepId?: string;
  parentStepId?: string;
  runId?: string;
  workflowRunId?: string;
  conversationId?: string;
  agentId?: string;
  name?: string;
  source?: string;
  model?: string;
  provider?: string;
  state?: string;
  phase?: string;
  status?: string;
  kind?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  text?: string;
  dedupeKey?: string;
};

export type ActivityStatus = "pending" | "running" | "completed" | "failed";

export type ActivityEntryKind = "lifecycle" | "agent" | "tool";

export type ActivityEntry = {
  id: string;
  stepId?: string;
  parentStepId?: string;
  runId?: string;
  conversationId?: string;
  label: string;
  kind: ActivityEntryKind;
  status: ActivityStatus;
  startedAt: number;
  completedAt?: number;
  model?: string;
  detail?: string;
  toolNameNormalized?: string;
  sandboxPath?: string;
  commandSummary?: string;
  returnCodeSummary?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
};

export type OpsSnapshot = {
  containersReferenced: string[];
  logsFetched: { container: string; lines: number }[];
  notesSaved: { type: string; container?: string }[];
  schedulesCreated: { name: string; cron: string }[];
  isEmpty: boolean;
};

export type WorkspaceRepo = {
  url: string;
  localPath: string;
  cloneType: string;
  durationMs?: number;
};

export type WorkspaceFileAccess = {
  path: string;
  timestamp: number;
};

export type WorkspaceFileWrite = {
  path: string;
  operation: "write" | "edit" | "create";
  timestamp: number;
};

export type WorkspaceDirectory = {
  path: string;
  treeText?: string;
};

export type WorkspaceSubagentTask = {
  task: string;
  tools: string[];
  repoPath?: string;
  status: "running" | "completed" | "failed";
  timestamp: number;
  result?: string;
};

export type WorkspaceSnapshot = {
  repos: WorkspaceRepo[];
  filesRead: WorkspaceFileAccess[];
  filesWritten: WorkspaceFileWrite[];
  directoriesExplored: WorkspaceDirectory[];
  commandsRun: string[];
  subagentTasks: WorkspaceSubagentTask[];
  isEmpty: boolean;
};

export type WorkspaceRoot = {
  path: string;
  label: string;
};

export type { WorkspaceTreeNode, WorkspaceChangedFile, WorkspaceTreeResponse } from "@/lib/workspace-tree";

export type SessionMeta = {
  toolCount: number;
  totalDuration: number;
  activeToolCount: number;
  failedCount: number;
  model: string | null;
  isLive: boolean;
  tokenUsage?: TokenUsage;
  modelCostCategory?: "free" | "low" | "medium" | "high" | "unknown";
  modelBillingType?: "trial" | "paid" | "self-hosted" | "unknown";
  budgetState?: "ok" | "warning" | "limited";
  sessionCostUsd?: number;
};

export type AgentMood = "idle" | "thinking" | "executing" | "agitated";

export type SessionCreator = {
  id: string;
  name: string;
};

export type TemperaturePreset = "low" | "medium" | "high";

export type InferencePrefs = {
  model: string;
  temperaturePreset: TemperaturePreset;
  thinking: boolean;
};
