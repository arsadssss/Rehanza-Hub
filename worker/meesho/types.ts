/**
 * Rehanza-Hub Meesho Automation Worker - Types
 * Strict types for browser lifecycle, multi-tenant session management, and communication.
 */

import { BrowserContext, Page } from 'playwright';

export type WorkerSessionState =
  | 'STARTING'
  | 'WAITING_FOR_LOGIN'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'SESSION_EXPIRED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface WorkerConfig {
  port: number;
  hubUrl: string;
  workerSecret: string;
  sessionsDir: string;
  headless: boolean;
  loginTimeoutMs: number;
  healthCheckIntervalMs: number;
}

export interface WorkerSession {
  accountId: string;
  ticket: string;
  state: WorkerSessionState;
  browserContext?: BrowserContext;
  page?: Page;
  startedAt: number;
  lastActivityAt: number;
  error?: string;
  storageStatePath: string;
  supplierId?: string;
  supplierName?: string;
}

export interface StartSessionRequest {
  accountId: string;
  ticket: string;
}

export interface WorkerSessionStatusDTO {
  accountId: string;
  state: WorkerSessionState;
  startedAt: number;
  lastActivityAt: number;
  error?: string;
  supplierId?: string;
  supplierName?: string;
}

