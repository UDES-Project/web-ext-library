class UMES_ContentScript {
    constructor(base_url = "http://localhost:5000/api", verbose = true) {
        this.base_url = base_url
        this.verbose = verbose

        window.addEventListener('message', this.onMessage.bind(this));
    }

    onMessage(event) {
        if (event.data.event_type == "UMES_encryptMessage") {
            this.encryptMessage(event.data.content, (public_id, key) => {
                event.source.postMessage(
                    {
                        event_type: "UMES_updateMessage",
                        public_id: public_id,
                        key: key,
                        nonce: event.data.nonce
                    },
                    event.origin,
                );
            })
        }
    };

    log(...args) {
        if (this.verbose)
            console.log(...args)
    }

    error(...args) {
        console.error(...args)
    }

    encryptString(content, key) {
        let result = [];
        for (let i = 0; i < content.length; i++) {
            result.push(content.charCodeAt(i) ^ key[i % key.length].charCodeAt(0));
        }
        let encryptedData = new Uint8Array(result);
        return btoa(String.fromCharCode.apply(null, encryptedData));
    }

    decryptString(content, key) {
        let binaryString = atob(content);
        let result = "";
        for (let i = 0; i < binaryString.length; i++) {
            result += String.fromCharCode(binaryString.charCodeAt(i) ^ key[i % key.length].charCodeAt(0));
        }
        return result;
    }

    randomKey(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    makeRequest(url, callback, options) {
        this.log("[UMES] Request to", url)
        browser.runtime.sendMessage({ action: "UMES_makeRequest", url: url, options: options }, callback);
    }

    encryptMessage(content, callback) {
        const key = this.randomKey(128)

        var encrypted = this.encryptString(content, key)

        this.makeRequest(`${this.base_url}/message`, (res) => {
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

    decryptMessage(content, callback) {
        var content = content.replace("[UMES]", "")
        var public_id = content.split(":")[0]
        var key = content.split(":")[1]

        this.makeRequest(`${this.base_url}/message?public_id=${public_id}`, (res) => {
            if (!res.success) {
                this.error("[UMES] Get message error:", res.error)
                return
            }

            callback(this.decryptString(res.json.content, key))
        })
    }

    isUMESMessage(content) {
        return content.startsWith("[UMES]") && content.split(":").length == 2
    }

    injectScript(file, parent = "body", lib = false) {
        var file_path = browser.extension.getURL(file)

        if (!lib && document.getElementById("[UMES]script")) {
            location.reload()
        }

        var node = document.querySelector(parent);
        var script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', file_path);
        
        if (!lib) {
            script.setAttribute('id', '[UMES]script')
            this.injectScript("web-ext-library/script.js", "body", true)
        }

        node.appendChild(script);
    }

    getAllMessages(messageQuery, onMessageCallback) {
        Array.from(this.currentMessagesContainer.children).forEach((message) => {
            onMessageCallback(message.querySelector(messageQuery))
        })
    }

    handleMutation(mutationsList, messageQuery, onMessageCallback) {
        mutationsList.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function (node) {
                    onMessageCallback(node.querySelector(messageQuery))
                });
            }
        });
    }

    setMessageContainer(containerQuery, messageQuery, onMessageCallback) {
        return setInterval((() => {
            var parentDiv = document.querySelector(containerQuery);

            if (parentDiv && parentDiv != this.currentMessagesContainer) {
                this.log("[UMES] Found message container: ", parentDiv);

                this.currentMessagesContainer = parentDiv

                this.getAllMessages(messageQuery, onMessageCallback)

                var observer = new MutationObserver((e) => this.handleMutation(e, messageQuery, onMessageCallback));

                var observerConfig = { childList: true };

                observer.observe(parentDiv, observerConfig);
            }
        }).bind(this), 1000);
    }
}