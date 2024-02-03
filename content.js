class UMES_ContentScript {
    constructor(base_url = "http://localhost:5000/api", verbose = true) {
        this.base_url = base_url
        this.verbose = verbose

        window.addEventListener('message', this.onMessage);
    }

    onMessage(event) {
        this.log("[UMES] onMessage:", event.data)
        if (event.data.event_type == "UMES_encryptMessage") {
            encryptMessage(event.data.content, (public_id, key) => {
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

    randomKey(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for(var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    makeRequest(url, callback, options) {
        this.log("[UMES] Request to", url)
        browser.runtime.sendMessage({ action: "makeRequest", url: url, options: options }, callback);
    }

    encryptMessage(content, callback) {
        const key = randomKey(128)

        makeRequest(`${BASE_URL}/message/encrypt?content=${content}&key=${key}`, (res) => {
            if (!res.success) {
                this.error("[UMES] encryptMessage error:", res.error)
                return
            }
    
            var encrypted = res.json.result
    
            makeRequest(`${BASE_URL}/message`, (res) => {
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
        })
    }

    decryptMessage(content, callback) {
        var content = content.replace("[UMES]", "")
        var public_id = content.split(":")[0]
        var key = content.split(":")[1]

        makeRequest(`${BASE_URL}/message?public_id=${public_id}`, (res) => {
            if (!res.success) {
                this.error("[UMES] Get message error:", res.error)
                return
            }

            makeRequest(`${BASE_URL}/message/decrypt?content=${res.json.content}&key=${key}`, (res) => {
                if (!res.success) {
                    this.error("[UMES] Decrypt message error:", res.error)
                    return
                }

                callback(res.json.result)
            })
        })
    }

    isUMESMessage(content) {
        return content.startsWith("[UMES]") && content.split(":").length == 2
    }

    injectScript(file, tag) {
        file_path = browser.extension.getURL(file)

        if (document.getElementById("[UMES]script")) {
            location.reload()
        }
    
        var node = document.getElementsByTagName(tag)[0];
        var script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', file_path);
        script.setAttribute('id', '[UMES]script')
        node.appendChild(script);
    }

    getAllMessages(messageQuery, onMessageCallback) {
        Array.from(this.currentMessagesContainer.children).forEach((message) => {
            onMessageCallback(message.querySelector(messageQuery))
        })
    }

    handleMutation(mutationsList, messageQuery, onMessageCallback) {
        mutationsList.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function (node) {
                    onMessageCallback(node.querySelector("div > div > div"))
                });
            }
        });
    }

    setMessageContainer(containerQuery, messageQuery, onMessageCallback) {
        return setInterval(function () {
            var parentDiv = document.querySelector(containerQuery);
    
            if (parentDiv && parentDiv != this.currentMessagesContainer) {
                this.log("[UMES] Found message container: ", parentDiv);
    
                this.currentMessagesContainer = parentDiv
    
                getAllMessages(messageQuery, onMessageCallback)
    
                var observer = new MutationObserver((e) => handleMutation(e, messageQuery, onMessageCallback));
    
                var observerConfig = { childList: true };
    
                observer.observe(parentDiv, observerConfig);
            }
        }, 1000);
    }
}