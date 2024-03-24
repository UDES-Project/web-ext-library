
export class UMES_Script {

    callbacks: {
        [key: string]: (public_id: string, key: string) => void
    }

    constructor() {
        this.callbacks = {}

        window.addEventListener("message", this.onMessage.bind(this), false);
    }

    onMessage(event: MessageEvent) {
        if (event.data.event_type == "UMES_updateMessage") {
            var callback = this.callbacks[event.data.nonce]
    
            if (callback) {
                callback(event.data.public_id, event.data.key)

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

    postEncryptMessage(content: string, nonce: string) {
        window.postMessage(JSON.parse(JSON.stringify({
            event_type: "UMES_encryptMessage",
            content: content,
            nonce: nonce
        })))
    }

    encryptMessage(content: string, callback: (public_id: string, key: string) => void) {
        var nonce = this.randomNonce(10)

        this.callbacks[nonce] = callback

        this.postEncryptMessage(content, nonce)
    }
}