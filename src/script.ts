import { exportCryptoKeyToBase64, uint8ArrayToBase64 } from "./utils";

export class UDES_Script {

    callbacks: {
        [key: string]: any;
    }

    constructor() {
        this.callbacks = {}

        window.addEventListener("message", this.onMessage.bind(this), false);
    }

    onMessage(event: MessageEvent) {
        if (event.data.event_type == "UDES_encryptedMessage") {
            var callback = this.callbacks[event.data.nonce]
    
            if (callback) {
                callback(event.data.public_id, event.data.key, event.data.counter, event.data.error)
                delete this.callbacks[event.data.nonce]
            }
        } else if (event.data.event_type == "UDES_decryptedMessage") {
            var callback = this.callbacks[event.data.nonce]
    
            if (callback) {
                callback(event.data.content)
                delete this.callbacks[event.data.nonce]
            }
        }
    }
    
    randomNonce(length: number) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for(var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    postEncryptMessage(content: string, secret: string, nonce: string) {
        window.postMessage(JSON.parse(JSON.stringify({
            event_type: "UDES_encryptMessage",
            content: content,
            secret: secret,
            nonce: nonce
        })))
    }

    encryptMessage(content: string, secret: string, callback: (public_id: string, key: CryptoKey, counter: Uint8Array, error?: string) => void) {
        var nonce = this.randomNonce(10)
        this.callbacks[nonce] = callback
        this.postEncryptMessage(content, secret, nonce)
    }

    postDecryptMessage(content: string, secret: string, nonce: string) {
        window.postMessage(JSON.parse(JSON.stringify({
            event_type: "UDES_decryptMessage",
            content: content,
            secret: secret,
            nonce: nonce
        })))
    }

    decryptMessage(content: string, secret: string, callback: (content: string) => void) {
        var nonce = this.randomNonce(10)
        this.callbacks[nonce] = callback
        this.postDecryptMessage(content, secret, nonce)
    }

    isUDESMessage(content: string) {
        return content.startsWith("[UDES:")
    }

    async messageForm(public_id: string, key: CryptoKey, counter: Uint8Array) {
        return `[UDES:${public_id}:${await exportCryptoKeyToBase64(key)}:${uint8ArrayToBase64(counter)}]`
    }
}