import type { AgentEntry } from '../src/types.js';
import { shortModelName } from '../dist/model.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 会话事件的数据载体（从 plugin event hook 收到的实际 payload） */
export interface SessionData {
  sessionID: string;
  info: {
    id?: string;
    model?: { id: string; providerID: string; variant?: string };
    tokens?: { input: number; output: number; reasoning: number; cache: { read: number; write: number } };
    agent?: string;
    cost?: number;
    title?: string;
  };
}

export interface StepData {
  sessionID: string;
  assistantMessageID?: string;
  agent?: string;
  model?: string;
}

export interface SessionStatusData {
  sessionID: string;
  status: { type: 'idle' } | { type: 'busy' } | { type: 'retry'; attempt: number; message: string };
}

/** 当前会话状态（持续累积） */
export interface SessionState {
  modelName: string;
  modelVariant: string | null;
  contextPercent: number | null;
  agents: AgentEntry[];
  effortLevel: string | null;
}

/** 从 model ID 映射到 context window size 的简易表 */
const MODEL_CONTEXT: Record<string, number> = {
  'claude-sonnet-4-6': 200000,
  'claude-opus-4-5': 200000,
  'claude-opus-4-7': 200000,
  'claude-haiku-4-5': 200000,
  'deepseek-v4': 1000000,
  'deepseek-v4-flash': 1000000,
  'deepseek-v3': 64000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gemini-2.5-pro': 1000000,
  'gemini-2.5-flash': 1000000,
};

function guessContextWindow(modelId: string): number | null {
  const lower = modelId.toLowerCase();
  for (const [key, size] of Object.entries(MODEL_CONTEXT)) {
    if (lower.includes(key)) return size;
  }
  // 含 [数字] 后缀的推测是**变体**（如 [1m] 表示 1M context）
  const m = modelId.match(/\[(\d+)m?\]/);
  if (m) return Number(m[1]) * 1_000_000;
  return null;
}

function hasProps(event: any): event is { type: string; properties: Record<string, unknown> } {
  return event?.type && event?.properties;
}

function isSessionUpdated(event: any): event is { type: 'session.updated'; properties: SessionData } {
  return hasProps(event) && event.type === 'session.updated' && 'info' in event.properties;
}

function isSessionStatus(event: any): event is { type: 'session.status'; properties: SessionStatusData } {
  return hasProps(event) && event.type === 'session.status';
}

function isStepStarted(event: any): event is { type: 'session.next.step.started'; properties: StepData } {
  return hasProps(event) && event.type === 'session.next.step.started';
}

function isStepEnded(event: any): event is { type: 'session.next.step.ended'; properties: StepData } {
  return hasProps(event) && event.type === 'session.next.step.ended';
}

export class SessionCollector {
  private state: SessionState = {
    modelName: 'Loading…',
    modelVariant: null,
    contextPercent: null,
    agents: [],
    effortLevel: null,
  };

  private modelContextLimit: number | null = null;

  /** 最多保留的 agent 记录（含已完成的），超出则清理最旧的 */
  private readonly MAX_AGENTS = 20;

  getState(): SessionState {
    return this.state;
  }

  ingest(event: any): void {
    if (isSessionUpdated(event)) {
      this.handleSessionUpdated(event.properties);
    } else if (isSessionStatus(event)) {
      this.handleSessionStatus(event.properties);
    } else if (isStepStarted(event)) {
      this.handleStepStarted(event.properties);
    } else if (isStepEnded(event)) {
      this.handleStepEnded(event.properties);
    }
  }

  private handleSessionUpdated(data: SessionData): void {
    const info = data.info;
    if (info.model) {
      const mid = info.model.id;
      const displayName = info.model.providerID
        ? `${info.model.providerID} ${info.model.id}`
        : mid;
      const parsed = shortModelName(displayName, mid);
      this.state.modelName = parsed.name;
      this.state.modelVariant = parsed.variant;

      // 推算 context window 上限
      this.modelContextLimit = guessContextWindow(mid);
    }

    // 从 tokens 推算 contextPercent
    if (info.tokens && this.modelContextLimit) {
      const used = info.tokens.input + info.tokens.output;
      this.state.contextPercent = Math.min(100, Math.round((used / this.modelContextLimit) * 100));
    }
  }

  private handleSessionStatus(data: SessionStatusData): void {
    if (data.status.type === 'idle') {
      // idle = 无活跃 agent
    }
  }

  private handleStepStarted(data: StepData): void {
    if (!data.agent) return;
    const existing = this.state.agents.find(a => a.id === data.assistantMessageID);
    if (existing) return;
    this.state.agents = [
      ...this.state.agents,
      {
        id: data.assistantMessageID ?? `step_${Date.now()}`,
        type: data.agent,
        model: data.model,
        status: 'running',
      },
    ];
  }

  private handleStepEnded(data: StepData): void {
    if (!data.assistantMessageID) return;
    this.state.agents = this.state.agents.map(a =>
      a.id === data.assistantMessageID ? { ...a, status: 'completed' as const } : a,
    );
    // 超出上限时清理最旧的已完成 agent
    if (this.state.agents.length > this.MAX_AGENTS) {
      const running = this.state.agents.filter(a => a.status === 'running');
      const completed = this.state.agents.filter(a => a.status === 'completed');
      completed.sort((a, b) => (a.id < b.id ? -1 : 1));
      this.state.agents = [...running, ...completed.slice(-10)];
    }
  }
}
