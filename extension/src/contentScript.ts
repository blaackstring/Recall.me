console.log("Recall.me content script loaded");

function showToast(message: string) {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        backgroundColor: "rgba(9, 9, 11, 0.9)",
        color: "white",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: "999999",
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        fontWeight: "500",
        transition: "opacity 0.3s ease",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)"
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function triggerCapture() {
    showToast("Capturing memory...");

    chrome.runtime.sendMessage({ action: "hotkeyCapture" }, (response: any) => {
        if (chrome.runtime.lastError) {
            console.error("Recall.me Error:", chrome.runtime.lastError);
            showToast("Extension connection error. Try reloading the page.");
            return;
        }

        if (response?.success) {
            console.log("Screenshot initiated successfully");
        }
    });
}

chrome.runtime.onMessage.addListener((request) => {
    if (request?.action === "showPageToast" && typeof request.message === "string") {
        showToast(request.message);
    }
});

window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    const key = e.key.toLowerCase();
    const isCtrlShiftS = e.ctrlKey && e.shiftKey && key === "s";
    const isAltS = e.altKey && key === "s";
    const isMetaShiftS = e.metaKey && e.shiftKey && key === "s";
    const isMacSnip = e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5");

    if (isCtrlShiftS || isAltS || isMetaShiftS || isMacSnip) {
        e.preventDefault();
        triggerCapture();
    }
});

window.addEventListener("keyup", (e) => {
    if (e.key === "PrintScreen") {
        showToast("PrintScreen detected. Capturing...");
        triggerCapture();
    }
});

window.addEventListener("paste", (e) => {
    if (!e.clipboardData) return;

    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (!items[i].type.includes("image")) continue;

        showToast("Image pasted. Processing memory...");
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target?.result as string;
            chrome.runtime.sendMessage(
                { action: "uploadPastedImage", imageData },
                () => {
                    if (chrome.runtime.lastError) {
                        showToast("Extension connection error.");
                    } else {
                        console.log("Pasted image processed");
                    }
                }
            );
        };

        reader.readAsDataURL(file);
        break;
    }
});
