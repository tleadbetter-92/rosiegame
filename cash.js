const cashSound = new Audio("/chink.wav");
cashSound.preload = "auto";
cashSound.muted = true;

function playCash() {
    cashSound.muted = false;
    cashSound.volume = 1;
    cashSound.currentTime = 0;
    cashSound.play().catch(() => {});
}

document.addEventListener("pointerdown", () => {
    const muted = cashSound.muted;
    cashSound.muted = true;
    cashSound.play().then(() => {
        cashSound.pause();
        cashSound.currentTime = 0;
        cashSound.muted = muted;
    }).catch(() => {
        cashSound.muted = muted;
    });
}, { once: true });

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.cash) playCash();
    });
}
