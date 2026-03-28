import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Pkcs10CertificateRequestGenerator, cryptoProvider } from '@peculiar/x509';
import { Crypto as PeculiarCrypto } from '@peculiar/webcrypto';

export interface CsrParams {
  commonName: string; // clinic name
  organizationUnit: string; // branch or solution name
  organization: string; // clinic legal name
  country: string; // 'SA'
  serialNumber: string; // "1-CareKit|2-15|3-{timestamp}"
  vatNumber: string; // TIN
  businessCategory: string; // e.g. "Healthcare"
}

const SALT = 'zatca-carekit-salt';
const KEY_LENGTH = 32;

@Injectable()
export class ZatcaCryptoService {
  /**
   * Generates an ECDSA key pair using secp256k1 (ZATCA requirement).
   */
  generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      privateKeyEncoding: { type: 'sec1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { privateKey, publicKey };
  }

  /**
   * Generates a ZATCA-compliant CSR (Certificate Signing Request).
   *
   * ZATCA requires specific subject fields and extensions.
   * Uses node-forge for proper ASN.1 encoding.
   * Falls back to a manual base64 encoding if forge is unavailable.
   */
  async generateCsr(privateKey: string, params: CsrParams): Promise<string> {
    // Build the subject DN (Distinguished Name)
    const subjectFields = this.buildSubjectDn(params);

    // ZATCA CSR subject string for reference
    const subjectString = subjectFields
      .map(([key, val]) => `${key}=${val}`)
      .join(', ');

    return this.buildCsrBase64(privateKey, subjectString, params);
  }

  /**
   * Encrypts a private key using AES-256-GCM for secure storage.
   */
  encryptPrivateKey(privateKey: string, encryptionKey: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(encryptionKey, SALT, KEY_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts a previously encrypted private key.
   */
  decryptPrivateKey(encryptedKey: string, encryptionKey: string): string {
    const parts = encryptedKey.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted key format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(encryptionKey, SALT, KEY_LENGTH);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Builds the X.509 subject DN fields required by ZATCA.
   */
  private buildSubjectDn(params: CsrParams): Array<[string, string]> {
    return [
      ['CN', params.commonName],
      ['OU', params.organizationUnit],
      ['O', params.organization],
      ['C', params.country],
      ['SERIALNUMBER', params.serialNumber],
      ['UID', params.vatNumber],
      ['title', params.businessCategory],
    ];
  }

  /**
   * Builds a proper DER-encoded X.509 CSR using @peculiar/x509.
   * ZATCA API requires a real PKCS#10 CSR — not a JSON payload.
   */
  private async buildCsrBase64(
    privateKeyPem: string,
    _subject: string,
    params: CsrParams,
  ): Promise<string> {
    // Use @peculiar/webcrypto for Node.js WebCrypto compatibility
    const webcrypto = new PeculiarCrypto();
    cryptoProvider.set(webcrypto);

    // Convert PEM private key to CryptoKey pair via JWK round-trip
    const nodePrivKey = crypto.createPrivateKey(privateKeyPem);
    const nodePubKey = crypto.createPublicKey(privateKeyPem);

    const privateJwk = nodePrivKey.export({ format: 'jwk' }) as JsonWebKey;
    const publicJwk = nodePubKey.export({ format: 'jwk' }) as JsonWebKey;

    const alg = { name: 'ECDSA', namedCurve: 'K-256' };
    const [privateKey, publicKey] = await Promise.all([
      webcrypto.subtle.importKey('jwk', privateJwk, alg, false, ['sign']),
      webcrypto.subtle.importKey('jwk', publicJwk, alg, true, ['verify']),
    ]);

    // Build the CSR with ZATCA-required subject fields
    // OIDs: SN=serialNumber, UID=userId/VAT, T=title/businessCategory
    const csr = await Pkcs10CertificateRequestGenerator.create({
      name: [
        { CN: [params.commonName] },
        { OU: [params.organizationUnit] },
        { O: [params.organization] },
        { C: [params.country] },
        { SN: [params.serialNumber] },       // 2.5.4.5 — ZATCA serial number
        { '2.5.4.45': [params.vatNumber] },  // UID OID (UniqueIdentifier/VAT)
        { T: [params.businessCategory] },    // 2.5.4.12 — title/business category
      ],
      keys: { privateKey, publicKey },
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
    });

    // Return DER bytes encoded as Base64 (ZATCA API format)
    return Buffer.from(csr.rawData).toString('base64');
  }
}
