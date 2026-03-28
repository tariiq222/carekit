import { Test } from '@nestjs/testing';
import { ZatcaCryptoService, CsrParams } from '../../../src/modules/zatca/services/zatca-crypto.service.js';

const CSR_PARAMS: CsrParams = {
  commonName: 'Test Clinic',
  organizationUnit: 'CareKit',
  organization: 'Test Clinic LLC',
  country: 'SA',
  serialNumber: '1-CareKit|2-15|3-1700000000000',
  vatNumber: '300000000000003',
  businessCategory: 'Healthcare',
};

describe('ZatcaCryptoService', () => {
  let service: ZatcaCryptoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ZatcaCryptoService],
    }).compile();
    service = module.get(ZatcaCryptoService);
  });

  describe('generateKeyPair', () => {
    it('returns PEM-encoded secp256k1 key pair', () => {
      const { privateKey, publicKey } = service.generateKeyPair();
      expect(privateKey).toContain('-----BEGIN EC PRIVATE KEY-----');
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    it('generates unique pairs each call', () => {
      const kp1 = service.generateKeyPair();
      const kp2 = service.generateKeyPair();
      expect(kp1.privateKey).not.toBe(kp2.privateKey);
    });
  });

  describe('generateCsr', () => {
    it('returns a valid Base64-encoded DER CSR', async () => {
      const { privateKey } = service.generateKeyPair();
      const csr = await service.generateCsr(privateKey, CSR_PARAMS);

      // Must be non-empty base64 string
      expect(typeof csr).toBe('string');
      expect(csr.length).toBeGreaterThan(100);

      // Must decode to binary (DER) — not JSON
      const decoded = Buffer.from(csr, 'base64');
      const asString = decoded.toString('utf8');
      expect(() => JSON.parse(asString)).toThrow(); // real DER is not valid JSON

      // DER PKCS#10 CSR starts with SEQUENCE (0x30)
      expect(decoded[0]).toBe(0x30);
    });
  });

  describe('encryptPrivateKey / decryptPrivateKey', () => {
    it('round-trips correctly', () => {
      const { privateKey } = service.generateKeyPair();
      const password = 'test-encryption-key-12345';

      const encrypted = service.encryptPrivateKey(privateKey, password);
      expect(encrypted).toContain(':'); // iv:tag:ciphertext format
      expect(encrypted).not.toBe(privateKey);

      const decrypted = service.decryptPrivateKey(encrypted, password);
      expect(decrypted).toBe(privateKey);
    });

    it('throws on wrong password', () => {
      const { privateKey } = service.generateKeyPair();
      const encrypted = service.encryptPrivateKey(privateKey, 'correct-pass');
      expect(() => service.decryptPrivateKey(encrypted, 'wrong-pass')).toThrow();
    });

    it('throws on invalid format', () => {
      expect(() => service.decryptPrivateKey('bad-format', 'pass')).toThrow(
        'Invalid encrypted key format',
      );
    });
  });
});
