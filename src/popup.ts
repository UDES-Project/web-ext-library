export class UMES_Popup {

    static getExtensions(extensionCallback: (ext: any) => void) {
        // @ts-ignore
        browser.runtime.sendMessage({ action: "UMES_enumExtensions" }, extensionCallback);
    }
}