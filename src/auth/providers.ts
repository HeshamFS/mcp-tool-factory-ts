/**
 * OAuth2 provider implementations.
 *
 * Pre-configured OAuth2 providers for common services.
 */

import { type OAuth2Config, createOAuth2Config } from './oauth2.js';

/**
 * Base interface for OAuth2 providers.
 */
export interface OAuth2Provider {
  /** Provider name */
  name: string;

  /**
   * Get OAuth2 configuration for this provider.
   *
   * @param clientId - OAuth2 client ID
   * @param options - Additional provider-specific options
   * @returns OAuth2Config instance
   */
  getConfig(clientId: string, options?: OAuth2ProviderOptions): OAuth2Config;
}

/**
 * Common options for OAuth2 providers.
 */
export interface OAuth2ProviderOptions {
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;
  [key: string]: unknown;
}

/**
 * GitHub OAuth2 provider.
 *
 * GitHub OAuth supports PKCE for public clients.
 * See: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */
export const GitHubOAuth2Provider: OAuth2Provider = {
  name: 'github',

  getConfig(clientId: string, options: OAuth2ProviderOptions = {}): OAuth2Config {
    return createOAuth2Config(
      'github',
      'https://github.com/login/oauth/authorize',
      'https://github.com/login/oauth/access_token',
      {
        userinfoUrl: 'https://api.github.com/user',
        clientId,
        clientSecret: options.clientSecret,
        scopes: options.scopes ?? ['read:user'],
        redirectUri: options.redirectUri ?? 'http://localhost:8080/callback',
        usePkce: options.clientSecret === undefined, // Use PKCE if no secret
        extraTokenParams: { Accept: 'application/json' },
      }
    );
  },
};

/**
 * Google OAuth2 provider.
 *
 * Google OAuth with PKCE support.
 * See: https://developers.google.com/identity/protocols/oauth2
 */
export const GoogleOAuth2Provider: OAuth2Provider = {
  name: 'google',

  getConfig(clientId: string, options: OAuth2ProviderOptions = {}): OAuth2Config {
    return createOAuth2Config(
      'google',
      'https://accounts.google.com/o/oauth2/v2/auth',
      'https://oauth2.googleapis.com/token',
      {
        revokeUrl: 'https://oauth2.googleapis.com/revoke',
        userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        clientId,
        clientSecret: options.clientSecret,
        scopes: options.scopes ?? ['openid', 'profile', 'email'],
        redirectUri: options.redirectUri ?? 'http://localhost:8080/callback',
        usePkce: true, // Google always supports PKCE
        extraAuthParams: { access_type: 'offline', prompt: 'consent' },
      }
    );
  },
};

/**
 * Azure AD / Microsoft Entra ID OAuth2 provider.
 *
 * Azure AD OAuth with PKCE support.
 * See: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */
export function createAzureADOAuth2Provider(
  tenantId: string = 'common'
): OAuth2Provider {
  const baseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;

  return {
    name: 'azure',

    getConfig(clientId: string, options: OAuth2ProviderOptions = {}): OAuth2Config {
      return createOAuth2Config('azure', `${baseUrl}/authorize`, `${baseUrl}/token`, {
        userinfoUrl: 'https://graph.microsoft.com/v1.0/me',
        clientId,
        clientSecret: options.clientSecret,
        scopes: options.scopes ?? ['openid', 'profile', 'email', 'offline_access'],
        redirectUri: options.redirectUri ?? 'http://localhost:8080/callback',
        usePkce: true, // Azure always supports PKCE
      });
    },
  };
}

/**
 * Default Azure AD provider using "common" tenant.
 */
export const AzureADOAuth2Provider = createAzureADOAuth2Provider('common');

/**
 * Custom OAuth2 provider options.
 */
export interface CustomOAuth2ProviderOptions {
  providerName: string;
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  userinfoUrl?: string;
}

/**
 * Create a custom OAuth2 provider for any OAuth2-compliant server.
 *
 * Use this for self-hosted or custom OAuth2 servers.
 */
export function createCustomOAuth2Provider(config: CustomOAuth2ProviderOptions): OAuth2Provider {
  return {
    name: config.providerName,

    getConfig(clientId: string, options: OAuth2ProviderOptions = {}): OAuth2Config {
      return createOAuth2Config(
        config.providerName,
        config.authorizationUrl,
        config.tokenUrl,
        {
          revokeUrl: config.revokeUrl,
          userinfoUrl: config.userinfoUrl,
          clientId,
          clientSecret: options.clientSecret,
          scopes: options.scopes ?? [],
          redirectUri: options.redirectUri ?? 'http://localhost:8080/callback',
          usePkce: (options.usePkce as boolean) ?? true,
        }
      );
    },
  };
}

/**
 * Provider registry for easy lookup.
 */
export const OAUTH2_PROVIDERS: Record<string, OAuth2Provider> = {
  github: GitHubOAuth2Provider,
  google: GoogleOAuth2Provider,
  azure: AzureADOAuth2Provider,
};

/**
 * Get an OAuth2 provider by name.
 *
 * @param name - Provider name (github, google, azure)
 * @returns OAuth2Provider instance
 * @throws Error if provider is not found
 */
export function getOAuth2Provider(name: string): OAuth2Provider {
  const provider = OAUTH2_PROVIDERS[name.toLowerCase()];
  if (!provider) {
    const available = Object.keys(OAUTH2_PROVIDERS).join(', ');
    throw new Error(`Unknown OAuth2 provider: ${name}. Available: ${available}`);
  }
  return provider;
}
