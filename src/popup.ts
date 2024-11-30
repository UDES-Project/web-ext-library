export class UDES_Popup {

    static getExtensions(extensionCallback: (ext: any) => void) {
        
        // @ts-ignore
        browser.management.getAll(function (extInfos) {
            extInfos.forEach(function (extInfo: any) {
                // @ts-ignore
                browser.runtime.sendMessage(extInfo.id, { action: "UDES_enumExtensions" }, function (response) {
                    if (!response || !response.name) {
                        return;
                    }
                    extensionCallback(response);
                });
            });
        });
    }
}