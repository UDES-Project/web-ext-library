export class UMES_ContentScript {

    base_url: string
    verbose: boolean
    currentMessagesContainer: Element

    constructor(base_url = "http://localhost:5000/api", verbose = true) {
        this.base_url = base_url
        this.verbose = verbose
        this.currentMessagesContainer = document.body

        window.addEventListener('message', this.onMessage.bind(this));
    }

    onMessage(event: MessageEvent) {
        this.log("[UMES] onMessage:", event.data)
        if (event.data.event_type == "UMES_encryptMessage") {
            this.encryptMessage(event.data.content, (public_id: string, key: string) => {
                event.source?.postMessage(
                    {
                        event_type: "UMES_updateMessage",
                        public_id: public_id,
                        key: key,
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

    decryptString(content: string, key: string) {
        let binaryString = atob(content);
        let result = "";
        for (let i = 0; i < binaryString.length; i++) {
            var keyData = key[i % key.length]?.charCodeAt(0);
            if (!keyData) keyData = 0; // Should never happend
            result += String.fromCharCode(binaryString.charCodeAt(i) ^ keyData);
        }
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

    makeRequest(url: string, callback: (res: any) => void, options: any = {}) {
        this.log("[UMES] Request to", url)
        // @ts-ignore
        browser.runtime.sendMessage({ action: "UMES_makeRequest", url: url, options: options }, callback);
    }

    encryptMessage(content: string, callback: (public_id: string, key: string) => void) {
        const key = this.randomKey(128)

        var encrypted = this.encryptString(content, key)

        this.makeRequest(`${this.base_url}/message`, (res: any) => {
            if (!res.success) {
                this.error("[UMES] encryptMessage error:", res.error)
                return
            }

            callback(res.json.public_id, key)
        }, {
            "method": "POST",
            "body": {
                "content": encrypted
            }
        })
    }

    decryptMessage(content: string, callback: (content: string) => void) {
        var content = content.replace("[UMES]", "")
        var public_id = content.split(":")[0]
        var key = content.split(":")[1]

        this.makeRequest(`${this.base_url}/message?public_id=${public_id}`, (res) => {
            if (!res.success) {
                this.error("[UMES] Get message error:", res.error)
                return
            }

            if (key)
                callback(this.decryptString(res.json.content, key))
        })
    }

    isUMESMessage(content: string) {
        return content.startsWith("[UMES]") && content.split(":").length == 2
    }

    async injectScript(file: string, tag: string, inline_script: boolean = true) {
        // @ts-ignore
        var file_path = browser.extension.getURL(file)

        if (document.getElementById("[UMES]script")) {
            location.reload()
        }

        var node = document.getElementsByTagName(tag)[0];
        if (!node) 
            return

        var script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        
        if (inline_script) {
            script.setAttribute('src', file_path);
        } else {
            script.innerHTML = await (await fetch(file_path)).text()
        }

        script.setAttribute('id', '[UMES]script')
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
                this.log("[UMES] Found message container: ", parentDiv);

                this.currentMessagesContainer = parentDiv

                this.getAllMessages(messageQuery, onMessageCallback)

                var observer = new MutationObserver((e) => this.handleMutation(e, messageQuery, onMessageCallback));

                var observerConfig = { childList: true };

                observer.observe(parentDiv, observerConfig);
            }
        }, 1000);
    }
}