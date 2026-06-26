/*
 * One-off: generate an RSA keypair, publish the public half as a JWKS, and
 * mint a long-lived INSERT-ONLY JWT for the anonymous analytics role.
 *
 *   node scripts/mint-analytics-token.mjs
 *
 * Outputs:
 *   .well-known/jwks.json          (public — committed & served by the site)
 *   secrets/analytics-private-key.pem  (private — gitignored, kept for rotation)
 *   prints the JWT to stdout
 */
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const kid = 'analytics-' + randomUUID().slice(0, 8);

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

// Public JWK
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = kid;
jwk.use = 'sig';
jwk.alg = 'RS256';

mkdirSync('.well-known', { recursive: true });
mkdirSync('secrets', { recursive: true });
writeFileSync('.well-known/jwks.json', JSON.stringify({ keys: [jwk] }, null, 2) + '\n');
writeFileSync('secrets/analytics-private-key.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }));

// JWT — long lived, no PII, just selects the DB role that may only INSERT.
const now = Math.floor(Date.UTC(2026, 5, 26) / 1000); // fixed iat (deterministic)
const exp = Math.floor(Date.UTC(2036, 0, 1) / 1000);  // ~10 years
const header = { alg: 'RS256', typ: 'JWT', kid };
const payload = { role: 'anonymous', sub: 'web-anon', iat: now, exp };

const signingInput = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
const signer = createSign('RSA-SHA256');
signer.update(signingInput);
const signature = b64url(signer.sign(privateKey));
const jwt = signingInput + '.' + signature;

console.log(jwt);
