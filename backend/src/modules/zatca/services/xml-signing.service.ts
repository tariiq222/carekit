import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ClinicIntegrationsService } from '../../clinic-integrations/clinic-integrations.service.js';
import { ZatcaCryptoService } from './zatca-crypto.service.js';

@Injectable()
export class XmlSigningService {
  private readonly logger = new Logger(XmlSigningService.name);

  constructor(
    private readonly clinicIntegrationsService: ClinicIntegrationsService,
    private readonly config: ConfigService,
    private readonly cryptoService: ZatcaCryptoService,
  ) {}

  /**
   * Signs the XML invoice with the stored ZATCA private key.
   * Adds a UBLExtensions/Signature block to the XML.
   *
   * For ZATCA Phase 2, the signature must be XAdES-BES compliant:
   * 1. Compute SHA-256 hash of the invoice body
   * 2. Sign the hash with ECDSA using the private key
   * 3. Embed the signature + certificate in the XML
   */
  async signXml(xmlContent: string): Promise<string> {
    const encryptedKey = await this.getStoredPrivateKey();
    if (!encryptedKey) {
      this.logger.warn('No ZATCA private key configured — returning unsigned XML');
      return xmlContent;
    }

    const encryptionKey = this.config.get<string>('JWT_SECRET') ?? 'default-key';
    const privateKey = this.decryptKey(encryptedKey, encryptionKey);

    const csid = await this.getStoredCsid();

    // Compute digest of the invoice XML
    const invoiceDigest = crypto
      .createHash('sha256')
      .update(xmlContent, 'utf8')
      .digest('base64');

    // Create the SignedInfo block (what we actually sign)
    const signedInfo = this.buildSignedInfoXml(invoiceDigest);

    // Sign the SignedInfo with ECDSA
    const signer = crypto.createSign('SHA256');
    signer.update(signedInfo);
    const signatureValue = signer.sign(privateKey, 'base64');

    // Build the complete signature block
    const signatureBlock = this.buildSignatureBlock(
      signedInfo,
      signatureValue,
      csid,
    );

    // Insert signature into XML (before the first element after <Invoice>)
    return this.insertSignatureIntoXml(xmlContent, signatureBlock);
  }

  private buildSignedInfoXml(invoiceDigest: string): string {
    return [
      '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
      '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>',
      '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>',
      '<ds:Reference URI="">',
      '<ds:Transforms>',
      '<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">',
      '<ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>',
      '</ds:Transform>',
      '</ds:Transforms>',
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `<ds:DigestValue>${invoiceDigest}</ds:DigestValue>`,
      '</ds:Reference>',
      '</ds:SignedInfo>',
    ].join('');
  }

  private buildSignatureBlock(
    signedInfo: string,
    signatureValue: string,
    csid: string | null,
  ): string {
    return [
      '<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent>',
      '<sig:UBLDocumentSignatures',
      ' xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"',
      ' xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"',
      ' xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">',
      '<sac:SignatureInformation>',
      '<sbc:ID>urn:oasis:names:specification:ubl:signature:1</sbc:ID>',
      '<sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>',
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
      signedInfo,
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
      '<ds:KeyInfo>',
      '<ds:X509Data>',
      csid ? `<ds:X509Certificate>${csid}</ds:X509Certificate>` : '',
      '</ds:X509Data>',
      '</ds:KeyInfo>',
      '</ds:Signature>',
      '</sac:SignatureInformation>',
      '</sig:UBLDocumentSignatures>',
      '</ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>',
    ].join('');
  }

  private insertSignatureIntoXml(xml: string, signatureBlock: string): string {
    // Insert right after <Invoice ...> opening tag
    const invoiceTagEnd = xml.indexOf('>') + 1;
    return xml.slice(0, invoiceTagEnd) + signatureBlock + xml.slice(invoiceTagEnd);
  }

  private async getStoredPrivateKey(): Promise<string | null> {
    const integrations = await this.clinicIntegrationsService.getRaw();
    return integrations.zatcaPrivateKey ?? null;
  }

  private async getStoredCsid(): Promise<string | null> {
    const integrations = await this.clinicIntegrationsService.getRaw();
    return integrations.zatcaCsid ?? null;
  }

  /**
   * Decrypts the private key using ZatcaCryptoService.
   * Falls back to returning the key as-is if it's not in encrypted format.
   */
  private decryptKey(encryptedKey: string, encryptionKey: string): string {
    const parts = encryptedKey.split(':');
    if (parts.length !== 3) {
      return encryptedKey; // not encrypted, return as-is
    }
    return this.cryptoService.decryptPrivateKey(encryptedKey, encryptionKey);
  }
}
