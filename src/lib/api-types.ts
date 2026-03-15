/** Public API response types for /api/v1/ endpoints. */

export type ApiError = {
  code: string;
  message: string;
  details?: unknown[];
};

export type ApiResponse<T> = { data: T } | { error: ApiError };

export type PaginationInfo = {
  next_cursor: string | null;
  has_more: boolean;
  total_count: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationInfo;
};

export type ApiCaller = {
  username: string;
  role: string;
  source: "session" | "api_key";
  scopes?: string[];
};

export type ApiKeyRecord = {
  _id?: import("mongodb").ObjectId;
  key_hash: string;
  key_prefix: string;
  owner_email: string;
  name: string;
  role: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  active: boolean;
};

export type ApiKeyCreateResponse = {
  key: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
};
