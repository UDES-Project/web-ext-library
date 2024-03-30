import { v4 as uuidv4 } from 'uuid';

export class UMES_Background {

    name: string
    instance: string

    constructor(name: string) {

        this.name = name
        this.instance = uuidv4();

        // @ts-ignore
        browser.runtime.onMessage.addListener(this.onMessage.bind(this))
    }

    onMessage(request: any, sender: any, sendResponse: any) { // TODO: Type this.
        if (request.action === "UMES_makeRequest") {
            this.makeRequest(request.url, sendResponse, request.options);
        } else if (request.action === "UMES_enumExtensions") {
            if (request.instance !== this.instance) {
                // FOR TESTS
            }
            sendResponse(this.getExtensionInfos());
        } else {
            return false;
        }
        return true
    }

    getExtensions() {
        function extensionReponse(ext: any) {
            console.log(ext)
        }

        // @ts-ignore
        browser.runtime.sendMessage({ action: "UMES_enumExtensions", instance: this.instance }, extensionReponse);
    }

    getExtensionInfos() {
        return {
            name: this.name,
            instance: this.instance
        }
    }
    
    makeRequest(url: string, sendResponse: (res: any) => void, options: any = {}) {
        try {
            options = options || {}
            var xhr = new XMLHttpRequest();
            xhr.open(options.method || "GET", url, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        sendResponse({ success: true, json: JSON.parse(xhr.responseText) });
                    } else {
                        sendResponse({ success: false, error: xhr.statusText });
                    }
                }
            };
            const data = typeof options.body == "object" ? JSON.stringify(options.body) : options.body
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(data);
        } catch (e) {
            console.error("[UMES] makeRequest error: ", e)
            sendResponse({ success: false, error: e });
        }
    }
}