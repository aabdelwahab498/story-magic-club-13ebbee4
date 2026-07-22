import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  const validKey = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'MASTER_ENCRYPTION_KEY') return validKey;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should successfully encrypt and decrypt a plaintext string', () => {
      const plaintext = 'Hello Najmah!';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(24);
      expect(encrypted.tag).toHaveLength(32);
      expect(encrypted.version).toBe('v1');

      const decrypted = service.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        encrypted.version,
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should use different nonces (IVs) for subsequent encryptions of same text', () => {
      const plaintext = 'Secret Data';
      const enc1 = service.encrypt(plaintext);
      const enc2 = service.encrypt(plaintext);

      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });

    it('should throw an error during decryption if tag is tampered with', () => {
      const plaintext = 'Confidential';
      const encrypted = service.encrypt(plaintext);
      const tamperedTag = '0'.repeat(32);

      expect(() => {
        service.decrypt(
          encrypted.ciphertext,
          encrypted.iv,
          tamperedTag,
          encrypted.version,
        );
      }).toThrow();
    });

    it('should throw an error if MASTER_ENCRYPTION_KEY is missing', () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce(undefined);
      expect(() => service.encrypt('test')).toThrow('MASTER_ENCRYPTION_KEY environment variable is not defined');
    });

    it('should throw an error if MASTER_ENCRYPTION_KEY is not 32 bytes (64 hex characters)', () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce('too-short');
      expect(() => service.encrypt('test')).toThrow('MASTER_ENCRYPTION_KEY must be exactly 32 bytes');
    });
  });
});
