export function base64ToUint8Array(b64: string) {
    return new Uint8Array(atob(b64).split("").map(function (c) { return c.charCodeAt(0) }))
}

export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    return btoa(uint8Array.reduce(function (data, byte) {
        return data + String.fromCharCode(byte);
    }, ''));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function importCryptoKeyFromBase64(base64Key: string): Promise<CryptoKey> {
    const rawKey = base64ToArrayBuffer(base64Key);

    const key = await crypto.subtle.importKey(
        "raw",                      
        rawKey,                     
        { name: "AES-CTR" },        
        true,                       
        ["encrypt", "decrypt"]      
    );

    return key;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    uint8Array.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

export async function exportCryptoKeyToBase64(key: CryptoKey): Promise<string> {
    const rawKey = await crypto.subtle.exportKey("raw", key);
    return arrayBufferToBase64(rawKey);
}