import { describe, expect, test } from 'bun:test';
import {
    hexToBytes,
    bytesToHex,
    generateEncKey,
    encryptStr,
    decryptStr,
} from '../src/crypto';

describe('hexToBytes', () => {
    test('converts known hex to bytes', () => {
        const bytes = hexToBytes('ff00');
        expect(bytes).toEqual(new Uint8Array([255, 0]));
    });

    test('handles empty string', () => {
        const bytes = hexToBytes('');
        expect(bytes).toEqual(new Uint8Array([]));
    });

    test('converts multi-byte hex', () => {
        const bytes = hexToBytes('0a1b2c');
        expect(bytes).toEqual(new Uint8Array([10, 27, 44]));
    });
});

describe('bytesToHex', () => {
    test('converts known bytes to hex', () => {
        const hex = bytesToHex(new Uint8Array([255, 0]));
        expect(hex).toBe('ff00');
    });

    test('pads single-digit hex values', () => {
        const hex = bytesToHex(new Uint8Array([1, 2, 3]));
        expect(hex).toBe('010203');
    });

    test('handles empty array', () => {
        const hex = bytesToHex(new Uint8Array([]));
        expect(hex).toBe('');
    });
});

describe('hex round-trip', () => {
    test('bytesToHex(hexToBytes(hex)) returns original', () => {
        const original = 'deadbeef01234567';
        expect(bytesToHex(hexToBytes(original))).toBe(original);
    });
});

describe('generateEncKey', () => {
    test('produces a 64-character hex string (256 bits)', async () => {
        const key = await generateEncKey();
        expect(key).toHaveLength(64);
        expect(key).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('encrypt/decrypt round-trip', () => {
    test('recovers original text', async () => {
        const key = await generateEncKey();
        const plaintext = 'sk-ant-my-secret-api-key-12345';
        const { ct, iv } = await encryptStr(plaintext, key);
        const decrypted = await decryptStr(ct, iv, key);
        expect(decrypted).toBe(plaintext);
    });

    test('decryption with wrong key throws', async () => {
        const key1 = await generateEncKey();
        const key2 = await generateEncKey();
        const { ct, iv } = await encryptStr('secret', key1);
        expect(decryptStr(ct, iv, key2)).rejects.toThrow();
    });
});
