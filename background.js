browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "UMES_makeRequest") {
        makeRequest(request.url, sendResponse, request.options);
        return true;
    }
});

function makeRequest(url, sendResponse, options) {
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
