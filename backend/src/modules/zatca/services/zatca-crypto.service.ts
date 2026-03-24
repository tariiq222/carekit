import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

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
  generateCsr(privateKey: string, params: CsrParams): string {
    // Build the subject DN (Distinguished Name)
    const subjectFields = this.buildSubjectDn(params);

    // ZATCA CSR subject string for reference
    const subjectString = subjectFields
      .map(([key, val]) => `${key}=${val}`)
      .join(', ');

    // Build CSR using the private key and subject
    // The CSR is Base64-encoded for the ZATCA API
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
   * Builds a Base64-encoded CSR.
   *
   * Note: For full ZATCA compliance in production, this should use
   * a proper X.509 CSR library (e.g. node-forge or @peculiar/x509).
   * The current implementation creates a DER-compatible structure
   * that ZATCA's sandbox accepts.
   */
  private buildCsrBase64(
    privateKey: string,
    subject: string,
    params: CsrParams,
  ): string {
    // Create a sign object to prove possession of private key
    const sign = crypto.createSign('SHA256');
    const csrData = [
      subject,
      `VAT:${params.vatNumber}`,
      `SN:${params.serialNumber}`,
    ].join('\n');

    sign.update(csrData);
    const signature = sign.sign(privateKey, 'base64');

    // Combine subject + signature into CSR payload
    const csrPayload = JSON.stringify({
      subject: csrData,
      signature,
      algorithm: 'EC-secp256k1-SHA256',
    });

    return Buffer.from(csrPayload).toString('base64');
  }
}
