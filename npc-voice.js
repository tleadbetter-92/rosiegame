(function (global) {
    const STORAGE_KEY = "village-npc-voice";
    const SPEECH_MAX = 3200;

    let autoRead = true;
    let serverTts = false;
    let speaking = false;
    let audioEl = null;
    let objectUrl = null;
    let utterance = null;
    let audioCtx = null;

    function loadPref() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw === "0" || raw === "off") autoRead = false;
            else if (raw === "1" || raw === "on") autoRead = true;
        } catch (err) {
            autoRead = true;
        }
    }

    function savePref() {
        try {
            localStorage.setItem(STORAGE_KEY, autoRead ? "on" : "off");
        } catch (err) { /* private mode */ }
    }

    function cleanForSpeech(text) {
        return String(text || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, SPEECH_MAX);
    }

    function ensureAudioContext() {
        if (audioCtx) return audioCtx;
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
        return audioCtx;
    }

    function playLineCue() {
        const ctx = ensureAudioContext();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 520;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime;
        gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.13);
    }

    function revokeObjectUrl() {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
    }

    function stop() {
        speaking = false;
        if (utterance && global.speechSynthesis) {
            global.speechSynthesis.cancel();
        }
        utterance = null;
        if (audioEl) {
            audioEl.pause();
            audioEl.removeAttribute("src");
            audioEl.load();
        }
        revokeObjectUrl();
    }

    function pickBrowserVoice() {
        if (!global.speechSynthesis) return null;
        const voices = global.speechSynthesis.getVoices() || [];
        return (
            voices.find((v) => /^en(-|_)/i.test(v.lang) && /google|natural|online/i.test(v.name))
            || voices.find((v) => /^en(-|_)/i.test(v.lang))
            || voices[0]
            || null
        );
    }

    function speakBrowser(text) {
        if (!global.speechSynthesis) return Promise.resolve(false);
        return new Promise((resolve) => {
            utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.98;
            utterance.pitch = 1;
            const voice = pickBrowserVoice();
            if (voice) utterance.voice = voice;
            utterance.onend = () => {
                speaking = false;
                resolve(true);
            };
            utterance.onerror = () => {
                speaking = false;
                resolve(false);
            };
            speaking = true;
            global.speechSynthesis.speak(utterance);
        });
    }

    function speakServer(text) {
        return fetch("/api/npc-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ text })
        }).then(async (res) => {
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "TTS failed");
            }
            const blob = await res.blob();
            revokeObjectUrl();
            objectUrl = URL.createObjectURL(blob);
            if (!audioEl) audioEl = new Audio();
            audioEl.src = objectUrl;
            speaking = true;
            return new Promise((resolve, reject) => {
                audioEl.onended = () => {
                    speaking = false;
                    resolve(true);
                };
                audioEl.onerror = () => {
                    speaking = false;
                    reject(new Error("Playback failed"));
                };
                audioEl.play().catch(reject);
            });
        });
    }

    async function speak(text, opts) {
        const force = !!(opts && opts.force);
        if (!force && !autoRead) return false;
        const line = cleanForSpeech(text);
        if (!line || line === "…") return false;
        stop();
        playLineCue();
        if (serverTts) {
            try {
                await speakServer(line);
                return true;
            } catch (err) {
                /* fall back to browser voice */
            }
        }
        await speakBrowser(line);
        return true;
    }

    function setAutoRead(on) {
        autoRead = !!on;
        savePref();
        if (!autoRead) stop();
        return autoRead;
    }

    function isAutoRead() {
        return autoRead;
    }

    function isSpeaking() {
        return speaking;
    }

    function configure(opts) {
        if (opts && typeof opts.serverTts === "boolean") serverTts = opts.serverTts;
    }

    loadPref();

    fetch("/api/npc-tts", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
            if (data && data.configured) serverTts = true;
        })
        .catch(() => {});

    if (global.speechSynthesis) {
        global.speechSynthesis.onvoiceschanged = () => pickBrowserVoice();
    }

    global.NpcVoice = {
        speak,
        stop,
        replay(text) {
            return speak(text, { force: true });
        },
        setAutoRead,
        isAutoRead,
        isSpeaking,
        configure
    };
})(typeof window !== "undefined" ? window : globalThis);
