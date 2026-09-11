/**
 * Rehanza-Hub Meesho Marketplace Connector - Phase 1 Types
 * Strict typing for marketplace connections, sessions, encryption payloads, and client DTOs.
 */

export type MarketplaceConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'pending'
  | 'expired'
  | 'error';

export type MarketplaceType = 'meesho';

export interface MeeshoSessionMetadata {
  supplierId?: string;
  supplierName?: string;
  email?: string;
  phone?: string;
  lastValidatedAt?: string;
  userAgent?: string;
  sessionSource?: 'browser_worker' | 'official_login' | 'manual';
  loginTicket?: string | null;
  ticketConsumedAt?: string | null;
  loginInitiatedAt?: string | null;
  [key: string]: any;
}

/**
 * Sensitive session payload.
 * Encrypted using AES-256-GCM before storage in DB.
 * NEVER returned to client or logged.
 */
export interface MeeshoSessionPayload {
  cookies?: Record<string, string> | string;
  token?: string;
  refreshToken?: string;
  csrfToken?: string;
  expiresAt?: string;
  headers?: Record<string, string>;
  rawSession?: string;
}

/**
 * Raw Database Row representation from Neon Postgres marketplace_connections
 */
export interface MarketplaceConnectionRow {
  id: number;
  account_id: string;
  created_by_user_id: string | null;
  marketplace: string;
  connection_status: MarketplaceConnectionStatus;
  connected_at: string | Date | null;
  disconnected_at: string | Date | null;
  last_successful_sync: string | Date | null;
  last_error: string | null;
  session_expires_at: string | Date | null;
  session_metadata: MeeshoSessionMetadata | null;
  encrypted_session_data: string | null;
  auto_sync_enabled?: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Client-Safe DTO representation.
 * GUARANTEE: Does NOT contain `encrypted_session_data` or any raw cookies/tokens/passwords.
 */
export interface MarketplaceConnectionDTO {
  id: number | null;
  accountId: string;
  marketplace: MarketplaceType;
  status: MarketplaceConnectionStatus;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSuccessfulSync: string | null;
  lastError: string | null;
  sessionExpiresAt: string | null;
  sessionMetadata: MeeshoSessionMetadata;
  autoSyncEnabled?: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  loginUrl?: string | null;
  ticket?: string | null;
}

/**
 * Result returned when user requests to initiate a Meesho browser login session.
 */
export interface InitiateLoginResponse {
  status: 'pending';
  loginUrl: string;
  ticket: string;
  expiresAt: string;
}

/**
 * Payload sent by the automation/browser worker upon detecting an authenticated Supplier Panel session.
 */
export interface WorkerSessionCallbackPayload {
  accountId: string;
  ticket?: string;
  sessionPayload: MeeshoSessionPayload;
  metadata?: MeeshoSessionMetadata;
  sessionExpiresAt?: string | Date;
}

export interface MeeshoApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Normalized order status values
 */
export type MeeshoOrderStatus =
  | 'pending'
  | 'ready_to_ship'
  | 'shipped'
  | 'cancelled'
  | 'delivered'
  | 'unknown';

/**
 * Normalized order object ready for database upsert
 */
export interface NormalizedMeeshoOrder {
  orderId: string;
  subOrderId: string;
  fulfillmentId?: string | null;
  status: MeeshoOrderStatus;
  meeshoStatusCode: number;
  orderDate: Date | null;
  expectedDispatchDate: Date | null;
  sku: string;
  productName?: string | null;
  variation?: string | null;
  quantity: number;
  carrierId?: number | null;
  carrierName?: string | null;
  awb?: string | null;
  packetId?: string | null;
  cancellationReason?: string | null;
  orderSource?: string | null;
  rawData: Record<string, any>;
}

/**
 * Database record shape in meesho_orders table
 */
export interface MeeshoOrderRecord {
  id: number;
  account_id: string;
  marketplace: string;
  order_id: string;
  sub_order_id: string;
  fulfillment_id: string | null;
  status: MeeshoOrderStatus;
  meesho_status_code: number;
  order_date: string | Date | null;
  expected_dispatch_date: string | Date | null;
  sku: string;
  product_name: string | null;
  variation: string | null;
  quantity: number;
  carrier_id: number | null;
  carrier_name: string | null;
  awb: string | null;
  packet_id: string | null;
  cancellation_reason: string | null;
  order_source: string | null;
  raw_data: Record<string, any>;
  synced_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Options for triggering order extraction/sync
 */
export interface OrderSyncOptions {
  limit?: number;
  maxOrdersPerTab?: number;
  tabs?: Array<'pending' | 'ready-to-ship' | 'shipped' | 'cancelled'>;
  cutoffIso?: string;
  syncType?: 'auto' | 'manual' | 'test';
}

/**
 * Result returned after order sync completion
 */
export interface OrderSyncResult {
  success: boolean;
  totalExtracted: number;
  inserted: number;
  updated: number;
  newPendingCount?: number;
  durationMs: number;
  ordersSample?: Array<{
    subOrderId: string;
    sku: string;
    status: string;
    quantity: number;
  }>;
  syncId?: string;
  error?: string;
}

/**
 * Client-facing status DTO for order sync summary
 */
export interface OrderSyncStatusDTO {
  totalOrders: number;
  lastSync: string | null;
  statusBreakdown: {
    pending: number;
    ready_to_ship: number;
    shipped: number;
    cancelled: number;
    other: number;
  };
}

/**
 * Sync History Record stored in meesho_sync_history
 */
export interface MeeshoSyncHistoryRecord {
  id: string;
  accountId: string;
  marketplace: string;
  syncType: 'auto' | 'manual' | 'test';
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

/**
 * DTO for Connected Account returned to worker for scheduler registration
 */
export interface ConnectedAccountDTO {
  accountId: string;
  supplierId: string | null;
  supplierName: string | null;
  lastSuccessfulSync: string | null;
  autoSyncEnabled: boolean;
}

/**
 * Auto-Sync Status DTO for Settings UI
 */
export interface AutoSyncStatusDTO {
  enabled: boolean;
  intervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'running' | 'idle';
  lastSyncInserted: number;
  lastSyncUpdated: number;
  history: MeeshoSyncHistoryRecord[];
}

/**
 * Payload sent by worker when ingesting extracted orders
 */
export interface IngestOrdersPayload {
  accountId: string;
  orders: Array<{
    raw: Record<string, any>;
    tabType: 'pending' | 'ready-to-ship' | 'shipped' | 'cancelled';
    statusCode: number;
  }>;
  syncType?: 'auto' | 'manual' | 'test';
  durationMs?: number;
}

/**
 * Database record shape in meesho_order_notifications table
 * Phase 2D: Meesho Live Order Notifications + Live Orders Dashboard
 */
export interface MeeshoOrderNotificationRecord {
  id: number;
  accountId: string;
  marketplace: string;
  subOrderId: string;
  orderId: string;
  statusAtEvent: string;
  notificationType: string;
  isRead: boolean;
  deliveredAt: string | null;
  createdAt: string;
}

/**
 * DTO for notification preferences
 */
export interface OrderNotificationSettingsDTO {
  enabled: boolean;
  soundEnabled?: boolean;
}

/**
 * Real-time metric counts for the Live Orders Dashboard Card
 */
export interface LiveOrdersMetricDTO {
  pending: number;
  readyToShip: number;
  lastUpdated?: string;
}
