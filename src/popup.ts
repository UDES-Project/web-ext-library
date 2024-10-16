export class UDES_Popup {

    static getExtensions(extensionCallback: (ext: any) => void) {
        // @ts-ignore
        browser.runtime.sendMessage({ action: "UDES_enumExtensions" }, extensionCallback);
    }
}