Plain English Studio — Chrome extension 0.1.0

1. Extract this entire folder; do not select the ZIP file in Chrome.
2. Open chrome://extensions in Chrome.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this folder, the one containing manifest.json.
6. Click Plain English Studio from Chrome's Extensions menu.
7. Select an example and click Run program.

The downloaded release includes built files and needs no Node installation
for browser use. A fresh source checkout needs npm run build first.

Core English programs run offline. Save .eng downloads source files.
HTTP servers, npm imports and network calls use the separate Node CLI.
Models are in memory and are cleared when the program run ends.

This is a development release, not a Chrome Web Store publication.
Graphical Chrome installation was not verified in the build environment.
The worker modules and manifest/resources were checked automatically.
