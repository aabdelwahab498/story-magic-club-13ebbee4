import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Env } from '../../config/env.config';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyVersion = 'v1';

  constructor(private readonly configService: ConfigService<Env, true>) {}

  private getMasterKey(): Buffer {
    const keyHex = this.configService.get<string>('MASTER_ENCRYPTION_KEY');
    if (!keyHex) {
      throw new Error('MASTER_ENCRYPTION_KEY environment variable is not defined');
    }
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('MASTER_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
    }
    return key;
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string; version: string } {
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag,
      version: this.keyVersion,
    };
  }

  decrypt(ciphertext: string, ivHex: string, tagHex: string, version: string): string {
    if (version !== this.keyVersion) {
      this.logger.warn(`Decryption requested for key version "${version}". Current version is "${this.keyVersion}"`);
    }

    const key = this.getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}
