/// <reference types="chrome" />

const API_BASE_URL = 'http://localhost:3001';
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';
const NOTIFICATION_ICON_URL = chrome.runtime.getURL("icon-128.png");

function sendToastToUi(level: "info" | "success" | "error", message: string) {
    chrome.runtime.sendMessage(
        { action: "backgroundCaptureToast", level, message },
        () => {
            // Ignore "receiving end does not exist" when popup UI is closed.
            void chrome.runtime.lastError;
        }
    );
}

function isInjectablePageUrl(url?: string) {
    if (!url) return false;
    return !(
        url.startsWith("chrome://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:") ||
        url.startsWith("chrome-extension://")
    );
}

function isCapturablePageUrl(url?: string) {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://");
}

async function getBestPageTabId(): Promise<number | null> {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    if (!windows.length) return null;

    const focusedWindow = windows.find((w) => w.focused) || windows[0];
    const activeTab =
        focusedWindow.tabs?.find((t) => t.active && typeof t.id === "number" && isInjectablePageUrl(t.url)) ||
        focusedWindow.tabs?.find((t) => typeof t.id === "number" && isInjectablePageUrl(t.url)) ||
        windows.flatMap((w) => w.tabs || []).find((t) => typeof t.id === "number" && isInjectablePageUrl(t.url));

    return typeof activeTab?.id === "number" ? activeTab.id : null;
}

function sendToastToPage(message: string) {
    getBestPageTabId()
        .then((tabId) => {
            if (tabId == null) return;
            chrome.tabs.sendMessage(tabId, { action: "showPageToast", message }, () => {
                // Ignore when content script is unavailable (e.g. restricted pages).
                void chrome.runtime.lastError;
            });
        })
        .catch(() => {
            // no-op
        });
}

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "recall-page",
        title: "Recall This Page",
        contexts: ["all"]
    });
});

// Handle Context Menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "recall-page" && tab?.id) {
        handleGlobalCapture();
    }
});

// Handle Keyboard Shortcut (from manifest.json "commands" if used)
chrome.commands.onCommand.addListener((command) => {
    if (command === "capture-memory") {
        handleGlobalCapture();
    }
});

// Helper: Convert base64 to Blob
async function base64ToBlob(base64: string): Promise<Blob> {
    const res = await fetch(base64);
    return await res.blob();
}

// Helper: Generic upload function 
async function uploadScreenshotBlob(blob: Blob) {
    try {
        const formData = new FormData();
        formData.append('screenshot', blob, 'screenshot.png');
        formData.append('userId', GUEST_USER_ID);

        const uploadRes = await fetch(`${API_BASE_URL}/process-screenshot`, {
            method: 'POST',
            body: formData
        });

        if (uploadRes.ok) {
            showNotification("Memory Captured!", "AI is indexing your discovery...");
            sendToastToUi("success", "Memory Captured! AI is indexing your discovery...");
            sendToastToPage("Memory captured successfully.");
        } else {
            const err = await uploadRes.json();
            showNotification("Upload Failed", err.error || "Server error");
            sendToastToUi("error", err.error || "Upload failed");
            sendToastToPage(err.error || "Upload failed");
        }
    } catch (err) {
        console.error(err);
        showNotification("Error", "Could not connect to Recall.me server");
        sendToastToUi("error", "Could not connect to Recall.me server");
        sendToastToPage("Could not connect to Recall.me server");
    }
}

// Main capture logic for visible tab
async function handleGlobalCapture() {
    try {
        sendToastToUi("info", "Capturing memory...");
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
        const focusedWindow = windows.find((w) => w.focused) || windows[0];
        const activeTab = focusedWindow?.tabs?.find((t) => t.active);
        const windowId = focusedWindow?.id;

        if (windowId == null || !activeTab) {
            const msg = "No active browser tab to capture";
            showNotification("Error", msg);
            sendToastToUi("error", msg);
            sendToastToPage(msg);
            return;
        }

        if (!isCapturablePageUrl(activeTab.url)) {
            const msg = "Open a normal website (http/https) and try Ctrl+Shift+S again";
            showNotification("Capture Not Allowed", msg);
            sendToastToUi("error", msg);
            sendToastToPage(msg);
            return;
        }

        // 1. Capture visual tab from the last focused browser window
        chrome.tabs.captureVisibleTab(windowId, { format: "png" }, async (dataUrl) => {
            if (chrome.runtime.lastError) {
                const rawError = chrome.runtime.lastError.message || "Failed to capture screen";
                const friendlyError = rawError.includes("Either the '<all_urls>' or 'activeTab' permission is required.")
                    ? "Capture blocked on this tab. Switch to a normal website tab and try again."
                    : rawError;

                console.error("Capture error:", rawError);
                showNotification("Error", friendlyError);
                sendToastToUi("error", friendlyError);
                sendToastToPage(friendlyError);
                return;
            }

            if (!dataUrl) {
                showNotification("Error", "Failed to capture screen");
                sendToastToUi("error", "Failed to capture screen");
                sendToastToPage("Failed to capture screen");
                return;
            }

            // 2. Convert to blob and upload
            const blob = await base64ToBlob(dataUrl);
            await uploadScreenshotBlob(blob);
        });
    } catch (error) {
        console.error(error);
        showNotification("Error", "Screenshot capture failed");
        sendToastToUi("error", "Screenshot capture failed");
        sendToastToPage("Screenshot capture failed");
    }
}

function showNotification(title: string, message: string) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: NOTIFICATION_ICON_URL,
        title: title,
        message: message,
        priority: 2,
        requireInteraction: true
    });
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // Legacy action mapping: React UI triggers capture from background
    if (request.action === "captureVisibleTab") {
        chrome.tabs.captureVisibleTab(null as any, { format: "png" }, (dataUrl: string) => {
            if (chrome.runtime.lastError) {
                sendResponse({ dataUrl: null, error: chrome.runtime.lastError.message });
                return;
            }
            sendResponse({ dataUrl });
        });
        return true;
    }

    // New hotkey action: Content script asks background to self-handle the capture flow
    if (request.action === "hotkeyCapture") {
        handleGlobalCapture();
        sendResponse({ success: true });
        return true;
    }

    // Upload pasted image from clipboard
    if (request.action === "uploadPastedImage" && request.imageData) {
        base64ToBlob(request.imageData).then(blob => {
            uploadScreenshotBlob(blob);
        }).catch(err => {
            console.error("Blob conversion error:", err);
            showNotification("Error", "Failed to process pasted image");
        });
        sendResponse({ success: true });
        return true;
    }
});
