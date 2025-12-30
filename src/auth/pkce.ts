/**
 * PKCE (Proof Key for Code Exchange) implementation.
 *
 * PKCE is an extension to the OAuth 2.0 Authorization Code flow that
 * prevents authorization code interception attacks. It's required for
 * public clients (like CLI tools) per the MCP June 2025 spec.
 *
 * See: RFC 7636 - Proof Key for Code Exchange
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically random code verifier.
 *
 * The code verifier is a high-entropy cryptographic random string
 * using unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 *
 * @param length - Length of the verifier (43-128 characters per RFC 7636)
 * @returns Base64url-encoded random string
 * @throws Error if length is not between 43 and 128
 */
export function generateCodeVerifier(length: number = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128 characters');
  }

  // Generate random bytes and encode as base64url
  const randomBuffer = randomBytes(length);
  let verifier = randomBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Trim to exact length
  verifier = verifier.slice(0, length);

  return verifier;
}

/**
 * Generate a code challenge from the code verifier.
 *
 * @param verifier - The code verifier string
 * @param method - Challenge method - "S256" (recommended) or "plain"
 * @returns The code challenge string
 * @throws Error if method is not supported
 */
export function generateCodeChallenge(verifier: string, method: string = 'S256'): string {
  if (method === 'plain') {
    return verifier;
  } else if (method === 'S256') {
    // SHA-256 hash of the verifier
    const hash = createHash('sha256').update(verifier, 'ascii').digest();
    // Base64url encode without padding
    const challenge = hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return challenge;
  } else {
    throw new Error(`Unsupported code challenge method: ${method}`);
  }
}

/**
 * PKCE code verifier and challenge pair.
 *
 * This interface holds both the verifier (kept secret) and the challenge
 * (sent to the authorization server).
 */
export interface PKCECodeVerifier {
  verifier: string;
  challenge: string;
  method: string;
}

/**
 * Generate a new PKCE code verifier and challenge pair.
 *
 * @param length - Length of the code verifier
 * @param method - Challenge method ("S256" or "plain")
 * @returns New PKCECodeVerifier instance
 */
export function generatePKCE(length: number = 64, method: string = 'S256'): PKCECodeVerifier {
  const verifier = generateCodeVerifier(length);
  const challenge = generateCodeChallenge(verifier, method);
  return { verifier, challenge, method };
}

/**
 * Get authorization request parameters from PKCE.
 *
 * @param pkce - PKCE code verifier object
 * @returns Object with code_challenge and code_challenge_method
 */
export function pkceToAuthParams(pkce: PKCECodeVerifier): Record<string, string> {
  return {
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
  };
}

/**
 * Get token request parameters from PKCE.
 *
 * @param pkce - PKCE code verifier object
 * @returns Object with code_verifier
 */
export function pkceToTokenParams(pkce: PKCECodeVerifier): Record<string, string> {
  return {
    code_verifier: pkce.verifier,
  };
}
