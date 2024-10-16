import { decryptData, encryptData, generateAESKey } from "./aes"
import { base64ToUint8Array, importCryptoKeyFromBase64, uint8ArrayToBase64 } from "./utils"

export class UDES_ContentScript {

    base_url: string
    verbose: boolean
    currentMessagesContainer: Element

    constructor(base_url = "http://localhost:5000/api", verbose = true) {
        this.base_url = base_url
        this.verbose = verbose
        this.currentMessagesContainer = document.body

        window.addEventListener('message', this.onMessage.bind(this));
    }

    async onMessage(event: MessageEvent) {
        this.log("[UDES] Content onMessage:", event.data)
        if (event.data.event_type == "UDES_encryptMessage") {
            await this.encryptMessage(event.data.content, event.data.secret, (public_id: string, key: CryptoKey, counter: Uint8Array, error?: string) => {
                event.source?.postMessage(
                    {
                        event_type: "UDES_encryptedMessage",
                        public_id: public_id,
                        key: key,
                        counter: counter,
                        error: error,
                        nonce: event.data.nonce
                    },
                    // @ts-ignore  -  postMessage has no origin property but it works (see https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
                    event.origin,
                );
            })
        } else if (event.data.event_type == "UDES_decryptMessage") {
            this.decryptMessage(event.data.content, event.data.secret, (content: string) => {
                event.source?.postMessage(
                    {
                        event_type: "UDES_decryptedMessage",
                        content: content,
                        nonce: event.data.nonce
                    },
                    // @ts-ignore  -  postMessage has no origin property but it works (see https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
                    event.origin,
                );
            })
        }
    };

    log(...args: any[]) {
        if (this.verbose)
            console.log(...args)
    }

    error(...args: any[]) {
        console.error(...args)
    }

    encryptString(content: string, key: string) {
        let result = [];
        for (let i = 0; i < content.length; i++) {
            var keyData = key[i % key.length]?.charCodeAt(0);
            if (!keyData) keyData = 0; // Should never happend
            result.push(content.charCodeAt(i) ^ keyData);
        }
        // let encryptedData = new Uint8Array(result); <- Needed for vanilla JS
        return btoa(String.fromCharCode.apply(null, result));
    }

    async decryptString(content: string, b64key: string, b64counter: string) {
        let contentBuffer = base64ToUint8Array(content);
        let key = await importCryptoKeyFromBase64(b64key)
        let counter = base64ToUint8Array(b64counter);

        let result = await decryptData(key, contentBuffer, counter)
        return result;
    }

    randomKey(length: number) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    makeRequest(url: string, callback: (res: any) => Promise<void>, options: any = {}) {
        this.log("[UDES] Request to", url)
        // @ts-ignore
        browser.runtime.sendMessage({ action: "UDES_makeRequest", url: url, options: options }, callback);
    }

    async encryptMessage(content: string, secret: string | null, callback: (public_id: string, key: CryptoKey, counter: Uint8Array, error?: string) => void) {
        const key = await generateAESKey()

        var { ciphertext, counter } = await encryptData(key, content)

        console.log(1, ciphertext)
        console.log(2, uint8ArrayToBase64(ciphertext))
        console.log(3, base64ToUint8Array(uint8ArrayToBase64(ciphertext)))

        this.makeRequest(`${this.base_url}/message`, async (res: any) => {
            if (!res.success) {
                this.error("[UDES] encryptMessage error:", res.error)
                return
            }

            callback(res.json.public_id, key, counter, res.json.error)
        }, {
            "method": "POST",
            "body": {
                "content": uint8ArrayToBase64(ciphertext),
                "secret": secret,
                "action": "create"
            }
        })
    }

    async decryptMessage(content: string, secret = null, callback: (content: string) => void) {
        var content = content.replace("[UDES:", "").replace("]", "")
        var public_id = content.split(":")[0]
        var key = content.split(":")[1]
        var counter = content.split(":")[2]

        this.makeRequest(`${this.base_url}/message`, async (res) => {
            if (!res.success) {
                this.error("[UDES] Get message error:", res.error)
                return
            }
            
            if (res.json.error) {
                return callback(`[UDES - ERROR] ${res.json.error}`)
            }

            if (key && counter)
                callback(await this.decryptString(res.json.content, key, counter))
        }, {
            "method": "POST",
            "body": {
                "public_id": public_id,
                "secret": secret,
                "action": "read"
            }
        })
    }

    isUDESMessage(content: string) {
        return content.startsWith("[UDES:")
    }

    async injectScript(file: string, tag: string) {
        // @ts-ignore
        var file_path = browser.extension.getURL(file)

        if (document.getElementById("[UDES]script")) {
            location.reload()
        }

        var node = document.getElementsByTagName(tag)[0];
        if (!node) 
            return

        var script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', file_path);
        script.setAttribute('id', '[UDES]script')
        node.appendChild(script);
    }

    getAllMessages(messageQuery: string, onMessageCallback: (message: any) => void) {
        Array.from(this.currentMessagesContainer.children).forEach((message) => {
            onMessageCallback(message.querySelector(messageQuery))
        })
    }

    handleMutation(mutationsList: MutationRecord[], messageQuery: string, onMessageCallback: (message: any) => void) {
        mutationsList.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function (node) {
                    if ((node as Element).outerHTML) {
                        onMessageCallback((node as Element).querySelector(messageQuery))
                    }
                });
            }
        });
    }

    setMessageContainer(containerQuery: string, messageQuery: string, onMessageCallback: (message: any) => void) {
        return setInterval(() => {
            var parentDiv = document.querySelector(containerQuery);

            if (parentDiv && parentDiv != this.currentMessagesContainer) {
                this.log("[UDES] Found message container: ", parentDiv);

                this.currentMessagesContainer = parentDiv

                this.getAllMessages(messageQuery, onMessageCallback)

                var observer = new MutationObserver((e) => this.handleMutation(e, messageQuery, onMessageCallback));

                var observerConfig = { childList: true };

                observer.observe(parentDiv, observerConfig);
            }
        }, 1000);
    }
}