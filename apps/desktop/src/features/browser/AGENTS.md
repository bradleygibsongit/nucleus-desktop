# Browser Feature

## Learnings

- Electron `<webview>` methods like `getURL()` cannot be called until the element is attached and `dom-ready` has fired; browser sidebar state sync must wait for that event and guard early calls.
- To preserve browser page state across right-sidebar tab switches, keep `BrowserSidebar` mounted and hide it when inactive instead of conditionally unmounting it.
- The persisted browser container needs `w-full` on both the shared wrapper and the browser root or the panel will size to its contents instead of filling the sidebar.
