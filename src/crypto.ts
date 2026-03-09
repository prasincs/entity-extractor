export function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function generateEncKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
    const raw = await crypto.subtle.exportKey('raw', key);
    return bytesToHex(new Uint8Array(raw));
}

export async function importEncKey(hex: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        hexToBytes(hex).buffer as ArrayBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
    );
}

export async function encryptStr(
    text: string,
    keyHex: string,
): Promise<{ ct: string; iv: string }> {
    const key = await importEncKey(keyHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(text),
    );
    return { ct: bytesToHex(new Uint8Array(ct)), iv: bytesToHex(iv) };
}

export async function decryptStr(
    ctHex: string,
    ivHex: string,
    keyHex: string,
): Promise<string> {
    const key = await importEncKey(keyHex);
    const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBytes(ivHex).buffer as ArrayBuffer },
        key,
        hexToBytes(ctHex).buffer as ArrayBuffer,
    );
    return new TextDecoder().decode(pt);
}
