/**
 * Auth module for MCP Tool Factory.
 *
 * Provides OAuth2 and PKCE support for generated MCP servers.
 */

// OAuth2 core
export {
  OAuth2Flow,
  type OAuth2Token,
  type OAuth2Config,
  createOAuth2Token,
  createOAuth2Config,
  isTokenExpired,
  getAuthorizationHeader,
  getAuthorizationUrl,
  getTokenRequestData,
  getRefreshTokenData,
  tokenToDict,
  tokenFromDict,
  tokenToJson,
  tokenFromJson,
} from './oauth2.js';

// PKCE
export {
  type PKCECodeVerifier,
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCE,
  pkceToAuthParams,
  pkceToTokenParams,
} from './pkce.js';

// Providers
export {
  type OAuth2Provider,
  type OAuth2ProviderOptions,
  type CustomOAuth2ProviderOptions,
  GitHubOAuth2Provider,
  GoogleOAuth2Provider,
  AzureADOAuth2Provider,
  createAzureADOAuth2Provider,
  createCustomOAuth2Provider,
  OAUTH2_PROVIDERS,
  getOAuth2Provider,
} from './providers.js';
