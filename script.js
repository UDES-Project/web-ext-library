class UMES_Script {
    constructor() {
        this.callbacks = {}

        window.addEventListener("message", this.onMessage, false);
    }

    onMessage(event) {
        if (event.data.event_type == "UMES_updateMessage") {
            var callback = callbacks[event.data.nonce]
    
            if (callback) {
                callback(event.data.public_id, event.data.key)

                delete callbacks[event.data.nonce]
            }
        }
    }
    
    randomNonce(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for(var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    postEncryptMessage(content, nonce) {
        window.postMessage(JSON.parse(JSON.stringify({
            event_type: "UMES_encryptMessage",
            content: content,
            nonce: nonce
        })))
    }

    encryptMessage(content, callback) {
        nonce = randomNonce(10)

        callbacks[nonce] = callback

        this.postEncryptMessage(content, nonce)
    }
}