/**
 * OAuth2 core implementation.
 *
 * Provides OAuth2 Authorization Code flow with PKCE support,
 * token management, and refresh handling per the MCP June 2025 spec.
 */

/**
 * Supported OAuth2 flows.
 */
export enum OAuth2Flow {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
  DEVICE_CODE = 'device_code',
}

/**
 * OAuth2 access token with optional refresh token.
 *
 * Handles token storage, expiration checking, and serialization.
 */
export interface OAuth2Token {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
  issuedAt: number;
}

/**
 * Create an OAuth2 token.
 */
export function createOAuth2Token(
  accessToken: string,
  options: Partial<Omit<OAuth2Token, 'accessToken'>> = {}
): OAuth2Token {
  return {
    accessToken,
    tokenType: options.tokenType ?? 'Bearer',
    expiresIn: options.expiresIn,
    refreshToken: options.refreshToken,
    scope: options.scope,
    issuedAt: options.issuedAt ?? Date.now() / 1000,
  };
}

/**
 * Check if a token has expired.
 *
 * @param token - OAuth2 token
 * @returns True if token has expired (with 60s buffer), False otherwise
 */
export function isTokenExpired(token: OAuth2Token): boolean {
  if (token.expiresIn === undefined) {
    return false;
  }
  const expiryTime = token.issuedAt + token.expiresIn - 60; // 60s buffer
  return Date.now() / 1000 > expiryTime;
}

/**
 * Get the Authorization header value.
 *
 * @param token - OAuth2 token
 * @returns Header value like "Bearer <token>"
 */
export function getAuthorizationHeader(token: OAuth2Token): string {
  return `${token.tokenType} ${token.accessToken}`;
}

/**
 * Serialize token to dictionary.
 */
export function tokenToDict(token: OAuth2Token): Record<string, unknown> {
  return {
    access_token: token.accessToken,
    token_type: token.tokenType,
    expires_in: token.expiresIn,
    refresh_token: token.refreshToken,
    scope: token.scope,
    issued_at: token.issuedAt,
  };
}

/**
 * Deserialize token from dictionary.
 */
export function tokenFromDict(data: Record<string, unknown>): OAuth2Token {
  return {
    accessToken: data.access_token as string,
    tokenType: (data.token_type as string) ?? 'Bearer',
    expiresIn: data.expires_in as number | undefined,
    refreshToken: data.refresh_token as string | undefined,
    scope: data.scope as string | undefined,
    issuedAt: (data.issued_at as number) ?? Date.now() / 1000,
  };
}

/**
 * Serialize token to JSON string.
 */
export function tokenToJson(token: OAuth2Token): string {
  return JSON.stringify(tokenToDict(token));
}

/**
 * Deserialize token from JSON string.
 */
export function tokenFromJson(jsonStr: string): OAuth2Token {
  return tokenFromDict(JSON.parse(jsonStr));
}

/**
 * OAuth2 configuration for a provider.
 *
 * Contains all settings needed for OAuth2 authentication including
 * endpoints, client credentials, and PKCE settings.
 */
export interface OAuth2Config {
  // Provider identification
  providerName: string;

  // OAuth2 endpoints
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  userinfoUrl?: string;

  // Client credentials
  clientId: string;
  clientSecret?: string; // undefined for public clients using PKCE

  // OAuth2 settings
  scopes: string[];
  redirectUri: string;

  // PKCE settings (required for public clients per MCP spec)
  usePkce: boolean;
  pkceMethod: string;

  // Resource Indicators (RFC 8707)
  resource?: string;

  // Additional settings
  extraAuthParams: Record<string, string>;
  extraTokenParams: Record<string, string>;
}

/**
 * Create an OAuth2 configuration.
 */
export function createOAuth2Config(
  providerName: string,
  authorizationUrl: string,
  tokenUrl: string,
  options: Partial<Omit<OAuth2Config, 'providerName' | 'authorizationUrl' | 'tokenUrl'>> = {}
): OAuth2Config {
  return {
    providerName,
    authorizationUrl,
    tokenUrl,
    revokeUrl: options.revokeUrl,
    userinfoUrl: options.userinfoUrl,
    clientId: options.clientId ?? '',
    clientSecret: options.clientSecret,
    scopes: options.scopes ?? [],
    redirectUri: options.redirectUri ?? 'http://localhost:8080/callback',
    usePkce: options.usePkce ?? true,
    pkceMethod: options.pkceMethod ?? 'S256',
    resource: options.resource,
    extraAuthParams: options.extraAuthParams ?? {},
    extraTokenParams: options.extraTokenParams ?? {},
  };
}

/**
 * Build the authorization URL.
 *
 * @param config - OAuth2 configuration
 * @param state - Random state for CSRF protection
 * @param codeChallenge - PKCE code challenge (if using PKCE)
 * @param codeChallengeMethod - PKCE method ("S256" or "plain")
 * @returns Full authorization URL with query parameters
 */
export function getAuthorizationUrl(
  config: OAuth2Config,
  state: string,
  codeChallenge?: string,
  codeChallengeMethod?: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  });

  if (config.scopes.length > 0) {
    params.set('scope', config.scopes.join(' '));
  }

  if (config.usePkce && codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', codeChallengeMethod ?? config.pkceMethod);
  }

  if (config.resource) {
    params.set('resource', config.resource);
  }

  // Add extra auth params
  for (const [key, value] of Object.entries(config.extraAuthParams)) {
    params.set(key, value);
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Build token request data.
 *
 * @param config - OAuth2 configuration
 * @param code - Authorization code from callback
 * @param codeVerifier - PKCE code verifier (if using PKCE)
 * @returns Dict of form data for token request
 */
export function getTokenRequestData(
  config: OAuth2Config,
  code: string,
  codeVerifier?: string
): Record<string, string> {
  const data: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code,
  };

  if (config.clientSecret) {
    data.client_secret = config.clientSecret;
  }

  if (config.usePkce && codeVerifier) {
    data.code_verifier = codeVerifier;
  }

  if (config.resource) {
    data.resource = config.resource;
  }

  // Add extra token params
  for (const [key, value] of Object.entries(config.extraTokenParams)) {
    data[key] = value;
  }

  return data;
}

/**
 * Build refresh token request data.
 *
 * @param config - OAuth2 configuration
 * @param refreshToken - The refresh token
 * @returns Dict of form data for refresh request
 */
export function getRefreshTokenData(
  config: OAuth2Config,
  refreshToken: string
): Record<string, string> {
  const data: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  };

  if (config.clientSecret) {
    data.client_secret = config.clientSecret;
  }

  if (config.resource) {
    data.resource = config.resource;
  }

  return data;
}
