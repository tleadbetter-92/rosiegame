const cashSound = new Audio("/chink.wav");
cashSound.preload = "auto";

function playCash() {
    cashSound.currentTime = 0;
    cashSound.play().catch(() => {});
}

document.addEventListener("pointerdown", () => {
    cashSound.volume = 0;
    cashSound.play().then(() => {
        cashSound.pause();
        cashSound.currentTime = 0;
        cashSound.volume = 1;
    }).catch(() => {
        cashSound.volume = 1;
    });
}, { once: true });

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.cash) playCash();
    });
}
