export async function generateAESKey() {
    const key = await crypto.subtle.generateKey(
        {
            name: "AES-CTR",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
    return key;
}

export async function encryptData(key: CryptoKey, plaintext: string) {
    const encoder = new TextEncoder();
    const counter = crypto.getRandomValues(new Uint8Array(16));

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter: counter,
            length: 64
        },
        key,
        encoder.encode(plaintext)
    );

    return { ciphertext: new Uint8Array(ciphertext), counter };
}

export async function decryptData(key: CryptoKey, ciphertext: Uint8Array, counter: Uint8Array) {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-CTR",
            counter: counter,
            length: 64
        },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}
