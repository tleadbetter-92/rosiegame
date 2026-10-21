// Region 1 NPC chat — lore folder: Rosiegame_AI_World_Bible/Region 1/
// Godwin: INNKEEPER_GODWIN.md + Godwin_Conversation_Example.md + Attacks_in_the_Woods.md
// Commander: 02_CHARACTERS/Local_Garrison_Commander_Lore.md
// UI: crosshair label, E / click to talk, reply buttons; optional AI free-text via /api/npc-chat
(function (global) {
    const trees = {
        godwin: {
            title: "Godwin",
            nodes: {
                start: {
                    say: "Evening. Ale? What brings you to the inn?",
                    choices: [
                        { label: "Just posted here a few days.", next: "posted" },
                        { label: "What's new in town?", next: "newTown" },
                        { label: "What's happening in the woods?", next: "woods" },
                        { label: "What's the commander like?", next: "commanderLike" },
                        { label: "Where can I find the commander?", next: "commander" },
                        { label: "Tell me a story.", next: "storyAsk" },
                        { label: "Nothing, thanks.", next: "bye" }
                    ]
                },
                storyAsk: {
                    say: "A story? I could tell you one — ask again when the inn's quiet enough for a proper tale.",
                    choices: [{ label: "Another time.", next: "bye" }]
                },
                posted: {
                    say: "Ah, one of ours. You'll know the faces soon enough. Help yourself if you're thirsty — the garrison usually finds its way here by nightfall.",
                    choices: [
                        { label: "What's new in town?", next: "newTown" },
                        { label: "What's happening in the woods?", next: "woods" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                commanderLike: {
                    say: "Keeps his own counsel. Since the trouble in the woods picked up, he's had the garrison out more — patrols, questions at the gate. Fair enough, I suppose. He drinks here like anyone else when he's off duty. I wouldn't call him friendly, but he's not cruel to my regulars.",
                    choices: [
                        { label: "Where can I find him?", next: "commander" },
                        { label: "What's happening in the woods?", next: "woods" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                newTown: {
                    say: "Not a great deal, thankfully. Though the commander's been keeping his men busy lately. More patrols out towards the woods. Can't say what he's expecting to find out there. Perhaps he knows something I don't. Other than that, same old faces, same old troubles. Why? Getting bored already?",
                    choices: [
                        { label: "What's happening in the woods?", next: "woods" },
                        { label: "I'll leave you to it.", next: "bye" }
                    ]
                },
                woods: {
                    say: "The attacks? Been going on as long as I can remember, though they've got worse lately. The lumber folk have had a hard time of it. People used to say it was just beasts, or bandits after timber and supplies. Now, well, everyone's got a different explanation.",
                    choices: [
                        { label: "What explanations?", next: "legend" },
                        { label: "Do people ever go into those woods?", next: "intoWoods" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                legend: {
                    say: "There's an old tale about a people who lived out there, long ago. Fought on the losing side of some ancient war, or so the story goes. They were supposed to have been wiped out. A thousand years back, maybe more. Can't say I've ever put much stock in it.",
                    choices: [
                        { label: "You think they're behind the attacks?", next: "skeptic" },
                        { label: "How long have the attacks been happening?", next: "howLong" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                skeptic: {
                    say: "Me? No. They're a story, aren't they? Same as ghosts on the old roads. People like having something to blame when they don't know what's happening. Though I will say this — those attacks have been getting worse lately. And they do seem to happen around those woods. Make of that what you will.",
                    choices: [
                        { label: "What do you know about the forgotten people?", next: "legend" },
                        { label: "I'll be going.", next: "bye" }
                    ]
                },
                howLong: {
                    say: "Oh, you'd hear old folk say there was always the odd trouble — a cart gone, a dog found dead. But this last year or two? That's when the lumber crews started refusing certain paths. I don't know the full history. I know what's spilling into my taproom.",
                    choices: [
                        { label: "What's happening in the woods?", next: "woods" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                intoWoods: {
                    say: "Lumber folk, mostly, and the patrols the garrison sends. Traders stick to the road. I wouldn't wander in alone, if that's what you're asking.",
                    choices: [
                        { label: "What's happening in the woods?", next: "woods" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                commander: {
                    say: "The barracks — southwest side of the palisade, hard to miss. If he's not there, his sergeants are. They all drink here sooner or later.",
                    choices: [
                        { label: "What's new in town?", next: "newTown" },
                        { label: "Thanks.", next: "bye" }
                    ]
                },
                bye: {
                    say: "Safe roads.",
                    choices: []
                }
            }
        },
        commander: {
            title: "Commander",
            nodes: {
                start: {
                    say: "Can I help you? You're not one of my men. What is it?",
                    choices: [
                        { label: "I wanted to know who's in command here.", next: "inCharge" },
                        { label: "I hear there have been troubles in the woods.", next: "woods" },
                        { label: "Any paying work?", next: "bruteQuest" },
                        { label: "You're not from around here, are you?", next: "oldKingdom" },
                        { label: "Tell me a story.", next: "storyAsk" },
                        { label: "Nothing. Just looking around.", next: "byeYard" }
                    ]
                },
                storyAsk: {
                    say: "A story. I haven't time for fireside nonsense on the parade ground.",
                    choices: [{ label: "Fair enough.", next: "bye" }]
                },
                bruteQuest: {
                    say: "Paying work. There are heavy brutes lurking southwest of town — bigger than goblins, meaner up close. Kill three of them and I'll pay fifty gold and set you up with a padded coat from our stores. Take what they carry too; I don't care.",
                    choices: [
                        { label: "I'll handle it.", next: "bruteAccepted", action: "acceptBruteCull" },
                        { label: "Not my fight.", next: "bye" }
                    ]
                },
                bruteAccepted: {
                    say: "Good. Southwest woods, well out from the walls. Don't come back until three are down — or don't come back at all.",
                    choices: []
                },
                bruteProgress: {
                    say: "Still brutes out there. You know the deal — three dead, then we talk payment.",
                    choices: [{ label: "Understood.", next: "bye" }]
                },
                brutePaid: {
                    say: "You've done it. Fifty gold, and the padded coat from our stores — wear it before you pick another fight. Dismissed.",
                    choices: []
                },
                inCharge: {
                    say: "I am. The lord has charge of this place; I have charge of his soldiers. That's the arrangement.",
                    choices: [
                        { label: "I hear there have been troubles in the woods.", next: "woods" },
                        { label: "You're not from around here, are you?", next: "oldKingdom" },
                        { label: "That's all.", next: "bye" }
                    ]
                },
                woods: {
                    say: "You've heard correctly. More than I'd like, lately. Something keeps coming out of those woods, and the lumbermen are growing nervous. I'll deal with it.",
                    choices: [
                        { label: "Who's in command here?", next: "inCharge" },
                        { label: "You're not from around here, are you?", next: "oldKingdom" },
                        { label: "Good luck.", next: "bye" }
                    ]
                },
                oldKingdom: {
                    say: "No. The Old Kingdom. A long way from here. I've served in worse places. That's not to say I'd choose to stay here.",
                    choices: [
                        { label: "Troubles in the woods?", next: "woods" },
                        { label: "Who's in command here?", next: "inCharge" },
                        { label: "I'll leave you to it.", next: "bye" }
                    ]
                },
                byeYard: {
                    say: "Then keep clear of the training yard. I won't have someone taking a practice sword to the head and blaming my men for it.",
                    choices: []
                },
                bye: {
                    say: "Dismissed.",
                    choices: []
                }
            }
        },
        shopkeeper: {
            title: "Shopkeeper",
            nodes: {
                start: {
                    say: "Need supplies? I've got a bit of everything — or near enough. Gold talks.",
                    choices: [
                        { label: "What are you selling?", next: "wares" },
                        { label: "Surprise me with something random.", next: "bought", action: "shopMystery" },
                        { label: "Not today.", next: "bye" }
                    ]
                },
                wares: {
                    say: "Take a look. Prices are fair — for me.",
                    choices: []
                },
                bought: {
                    say: "There you are. Anything else?",
                    choices: [
                        { label: "Something else.", next: "wares" },
                        { label: "That's all.", next: "bye" }
                    ]
                },
                bye: {
                    say: "Mind the step on your way out.",
                    choices: []
                }
            }
        }
    };

    let panel = null;
    let titleEl = null;
    let textEl = null;
    let choicesEl = null;
    let leaveBtn = null;
    let askForm = null;
    let askInput = null;
    let askStatus = null;
    let askSubmit = null;
    let voiceBtn = null;
    let replayBtn = null;
    let lastSpokenLine = "";
    let treeId = null;
    let open = false;
    let aiConfigured = false;
    let aiBusy = false;
    let aiHistory = [];
    let aiMode = false;
    let campaignKey = "0";
    let questState = null;
    let shopState = null;
    let shopLastLine = "";
    const HISTORY_PREFIX = "region1-chat-";

    function setQuests(data) {
        questState = data || null;
    }

    function setShop(data) {
        shopState = data || null;
    }

    async function runQuestAction(action) {
        if (action === "acceptBruteCull") {
            const res = await fetch("/api/campaign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({ questAccept: "bruteCull" })
            });
            const data = await res.json().catch(() => ({}));
            if (data.quests) setQuests(data.quests);
            if (typeof global.applyCampaign === "function") global.applyCampaign(data);
            return res.ok;
        }
        if (action === "turnInBruteCull") {
            const res = await fetch("/api/campaign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({ questTurnIn: "bruteCull" })
            });
            const data = await res.json().catch(() => ({}));
            if (data.quests) setQuests(data.quests);
            if (typeof global.applyCampaign === "function") global.applyCampaign(data);
            return res.ok && !data.questError;
        }
        return true;
    }

    async function runShopAction(action) {
        const body = action === "shopMystery"
            ? { shopBuyMystery: 1 }
            : { shopBuy: String(action || "").replace(/^shopBuy:/, "") };
        const res = await fetch("/api/campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (typeof global.applyCampaign === "function") global.applyCampaign(data);
        if (data.shopError) {
            shopLastLine = data.shopError;
            return false;
        }
        const notes = data.notes;
        if (Array.isArray(notes) && notes.length) shopLastLine = notes[notes.length - 1];
        else shopLastLine = "You tuck it into your pack.";
        return res.ok;
    }

    function mergeShopkeeperChoices(nodeId, choices) {
        if (treeId !== "shopkeeper") return choices || [];
        const mystery = (shopState && shopState.mysteryPrice) || 12;
        if (nodeId === "start") {
            const out = (choices || []).slice();
            const pick = out.find((c) => c.action === "shopMystery");
            if (pick) pick.label = "Surprise me with something random (" + mystery + " gold).";
            return out;
        }
        if (nodeId === "wares") {
            const cat = (shopState && shopState.catalog) || [];
            const out = cat.map((row) => ({
                label: row.name + " (" + row.price + " gold)",
                next: "bought",
                action: "shopBuy:" + row.id
            }));
            out.push({
                label: "Something random (" + mystery + " gold)",
                next: "bought",
                action: "shopMystery"
            });
            out.push({ label: "That's all.", next: "bye" });
            return out;
        }
        return choices || [];
    }

    function mergeCommanderChoices(nodeId, choices) {
        if (treeId !== "commander" || nodeId !== "start") return choices || [];
        const out = (choices || []).slice();
        const q = questState && questState.bruteCull;
        if (!q) return out;
        if (q.phase === "active") {
            out.unshift({ label: "About those brutes… (" + q.kills + "/" + q.need + ")", next: "bruteProgress" });
        }
        if (q.phase === "ready" || (q.phase === "active" && q.kills >= q.need)) {
            out.unshift({ label: "I've killed the brutes you wanted.", next: "brutePaid", action: "turnInBruteCull" });
        }
        if (q.phase === "rewarded") {
            return out.filter((c) => c.next !== "bruteQuest");
        }
        return out;
    }

    function syncCampaignKey() {
        return fetch("/api/campaign?brief=1", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && data.restartedAt != null) campaignKey = String(data.restartedAt);
            })
            .catch(() => { /* keep last key */ });
    }

    function historyKey(id) {
        return HISTORY_PREFIX + campaignKey + ":" + id;
    }

    function loadStoredHistory(id) {
        try {
            const raw = JSON.parse(sessionStorage.getItem(historyKey(id)) || "[]");
            if (!Array.isArray(raw)) return [];
            return raw.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").slice(-20);
        } catch (err) {
            return [];
        }
    }

    function saveStoredHistory(id) {
        try {
            sessionStorage.setItem(historyKey(id), JSON.stringify(aiHistory.slice(-20)));
        } catch (err) { /* private mode */ }
    }

    function ensureDom() {
        if (panel) return;
        panel = document.getElementById("dialogue");
        if (!panel) return;
        titleEl = panel.querySelector("[data-dialogue-name]");
        textEl = panel.querySelector("[data-dialogue-text]");
        choicesEl = panel.querySelector("[data-dialogue-choices]");
        leaveBtn = panel.querySelector("[data-dialogue-leave]");
        askForm = panel.querySelector("[data-dialogue-ask]");
        askInput = panel.querySelector("[data-dialogue-input]");
        askStatus = panel.querySelector("[data-dialogue-status]");
        askSubmit = askForm && askForm.querySelector("button[type=submit]");
        voiceBtn = panel.querySelector("[data-dialogue-voice]");
        replayBtn = panel.querySelector("[data-dialogue-replay]");
        if (leaveBtn) leaveBtn.addEventListener("click", () => close());
        if (voiceBtn) {
            voiceBtn.addEventListener("click", () => {
                const voice = global.NpcVoice;
                if (!voice) return;
                voice.setAutoRead(!voice.isAutoRead());
                syncVoiceUi();
            });
        }
        if (replayBtn) {
            replayBtn.addEventListener("click", () => {
                const voice = global.NpcVoice;
                if (!voice || !lastSpokenLine) return;
                void voice.replay(lastSpokenLine);
            });
        }
        syncVoiceUi();
        if (askForm) {
            askForm.addEventListener("submit", (event) => {
                event.preventDefault();
                sendAiMessage();
            });
        }
    }

    function setAskStatus(text, show) {
        if (!askStatus) return;
        askStatus.hidden = !show;
        askStatus.textContent = text || "";
    }

    function syncVoiceUi() {
        const voice = global.NpcVoice;
        if (voiceBtn && voice) {
            const on = voice.isAutoRead();
            voiceBtn.setAttribute("aria-pressed", on ? "true" : "false");
            voiceBtn.textContent = on ? "Voice on" : "Voice off";
        }
        if (replayBtn) {
            replayBtn.disabled = !lastSpokenLine;
        }
    }

    function showNpcLine(text, opts) {
        const line = String(text || "");
        if (textEl) textEl.textContent = line;
        const speakable = !!(opts && opts.speak) && line && line !== "…";
        if (speakable) lastSpokenLine = line;
        syncVoiceUi();
        if (!speakable) return;
        const voice = global.NpcVoice;
        if (voice) void voice.speak(line);
    }

    function syncAskUi() {
        if (!askForm) return;
        askForm.hidden = !open || !aiMode || storyPickerOpen;
        if (choicesEl) choicesEl.hidden = !open || (!aiMode && !storyPickerOpen);
        if (askSubmit) askSubmit.disabled = aiBusy;
        if (askInput) askInput.disabled = aiBusy || storyPickerOpen;
    }

    let storyPickerOpen = false;

    function showStoryMoodPicker() {
        if (!choicesEl || !aiMode) return;
        storyPickerOpen = true;
        choicesEl.hidden = false;
        choicesEl.innerHTML = "";
        const intro = document.createElement("p");
        intro.className = "dialogue-story-hint";
        intro.textContent = "What kind of story?";
        choicesEl.appendChild(intro);
        const moods = [
            { id: "scary", label: "Scary" },
            { id: "mysterious", label: "Mysterious" },
            { id: "own", label: "Whatever you want to tell" }
        ];
        for (const mood of moods) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dialogue-choice";
            btn.textContent = mood.label;
            btn.addEventListener("click", () => {
                storyPickerOpen = false;
                void requestNpcStory(mood.id);
            });
            choicesEl.appendChild(btn);
        }
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "dialogue-choice dialogue-choice-muted";
        cancel.textContent = "Never mind";
        cancel.addEventListener("click", () => {
            storyPickerOpen = false;
            showAiActions();
        });
        choicesEl.appendChild(cancel);
        syncAskUi();
    }

    function showAiActions() {
        if (!choicesEl || !aiMode || storyPickerOpen) return;
        choicesEl.hidden = false;
        choicesEl.innerHTML = "";
        const storyBtn = document.createElement("button");
        storyBtn.type = "button";
        storyBtn.className = "dialogue-choice";
        storyBtn.textContent = "Tell me a story";
        storyBtn.addEventListener("click", () => showStoryMoodPicker());
        choicesEl.appendChild(storyBtn);
        syncAskUi();
    }

    function useScriptedDialogue(nodeId) {
        aiMode = false;
        syncAskUi();
        showNode(nodeId || "start");
    }

    function renderNode(nodeId) {
        const tree = trees[treeId];
        if (!tree) return close();
        const node = tree.nodes[nodeId];
        if (!node) return close();
        titleEl.textContent = tree.title;
        const line = nodeId === "bought" && shopLastLine ? shopLastLine : node.say;
        showNpcLine(line, { speak: true });
        choicesEl.innerHTML = "";
        choicesEl.hidden = false;
        let choices = node.choices || [];
        if (treeId === "commander") choices = mergeCommanderChoices(nodeId, choices);
        if (treeId === "shopkeeper") choices = mergeShopkeeperChoices(nodeId, choices);
        for (const choice of choices) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dialogue-choice";
            btn.textContent = choice.label;
            btn.addEventListener("click", () => {
                void (async () => {
                    if (choice.action) {
                        if (choice.action === "shopMystery" || String(choice.action).indexOf("shopBuy:") === 0) {
                            const ok = await runShopAction(choice.action);
                            if (!ok) {
                                showNpcLine(shopLastLine || "Can't buy that.", { speak: false });
                                choicesEl.innerHTML = "";
                                const back = document.createElement("button");
                                back.type = "button";
                                back.className = "dialogue-choice";
                                back.textContent = "Back";
                                back.addEventListener("click", () => showNode("start"));
                                choicesEl.appendChild(back);
                                return;
                            }
                        } else {
                            const ok = await runQuestAction(choice.action);
                            if (!ok && choice.action === "turnInBruteCull") {
                                showNpcLine("You haven't finished the job yet.", { speak: false });
                                choicesEl.innerHTML = "";
                                return;
                            }
                        }
                    }
                    showNode(choice.next);
                })();
            });
            choicesEl.appendChild(btn);
        }
        syncAskUi();
        setAskStatus("", false);
        if (!node.choices || !node.choices.length) {
            window.setTimeout(() => close(), 1200);
        }
    }

    function showNode(nodeId) {
        ensureDom();
        if (!panel) return;
        renderNode(nodeId);
    }

    async function requestNpcReply(options) {
        const opening = !!(options && options.opening);
        const message = opening ? "" : String(options && options.message || "").trim();
        if (!opening && !message) return false;
        aiBusy = true;
        syncAskUi();
        setAskStatus("Thinking…", true);
        try {
            const res = await fetch("/api/npc-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    npc: treeId,
                    message,
                    history: aiHistory,
                    opening
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setAskStatus(data.error || "AI could not reply.", true);
                return false;
            }
            if (data.campaignId != null) campaignKey = String(data.campaignId);
            if (!opening) aiHistory.push({ role: "user", content: message });
            aiHistory.push({ role: "assistant", content: data.reply });
            if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);
            saveStoredHistory(treeId);
            if (askInput && !opening) askInput.value = "";
            titleEl.textContent = data.title || (trees[treeId] && trees[treeId].title) || treeId;
            showNpcLine(data.reply, { speak: true });
            if (data.story && data.storyTitle) {
                setAskStatus("That tale is now part of this campaign’s lore.", true);
            } else {
                setAskStatus("", false);
            }
            showAiActions();
            return true;
        } catch (err) {
            setAskStatus("Could not reach the server.", true);
            return false;
        } finally {
            aiBusy = false;
            syncAskUi();
        }
    }

    async function sendAiMessage() {
        if (!aiMode || !treeId || aiBusy || !askInput) return;
        const message = askInput.value.trim();
        if (!message) return;
        if (/tell me a story/i.test(message)) {
            showStoryMoodPicker();
            askInput.value = "";
            return;
        }
        await requestNpcReply({ message });
    }

    async function requestNpcStory(mood) {
        if (!aiMode || !treeId || aiBusy) return false;
        const labels = { scary: "a scary story", mysterious: "a mysterious story", own: "whatever story you want to tell" };
        const userLine = "Tell me " + (labels[mood] || "a story") + ".";
        aiBusy = true;
        syncAskUi();
        setAskStatus("Thinking up a tale…", true);
        try {
            const res = await fetch("/api/npc-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    npc: treeId,
                    storyMood: mood,
                    history: aiHistory
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setAskStatus(data.error || "Could not tell a story.", true);
                showAiActions();
                return false;
            }
            if (data.campaignId != null) campaignKey = String(data.campaignId);
            aiHistory.push({ role: "user", content: userLine });
            aiHistory.push({ role: "assistant", content: data.reply });
            if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);
            saveStoredHistory(treeId);
            titleEl.textContent = data.title || (trees[treeId] && trees[treeId].title) || treeId;
            showNpcLine(data.reply, { speak: true });
            setAskStatus(
                data.storyTitle
                    ? "“" + data.storyTitle + "” — remembered in this campaign."
                    : "Story remembered in this campaign.",
                true
            );
            showAiActions();
            return true;
        } catch (err) {
            setAskStatus("Could not reach the server.", true);
            showAiActions();
            return false;
        } finally {
            aiBusy = false;
            storyPickerOpen = false;
            syncAskUi();
            if (askInput) askInput.focus();
        }
    }

    async function startAiTalk(id) {
        await syncCampaignKey();
        treeId = id;
        aiMode = true;
        aiHistory = loadStoredHistory(id);
        open = true;
        panel.hidden = false;
        document.body.classList.add("dialogue-open");
        choicesEl.innerHTML = "";
        titleEl.textContent = (trees[id] && trees[id].title) || id;
        syncAskUi();
        setAskStatus("", false);
        const lastLine = aiHistory.filter((item) => item.role === "assistant").pop();
        if (lastLine) {
            showNpcLine(lastLine.content, { speak: true });
            showAiActions();
            if (askInput) askInput.focus();
            return true;
        }
        showNpcLine("…", { speak: false });
        const ok = await requestNpcReply({ opening: true });
        if (!ok) {
            setAskStatus("Using fixed dialogue instead.", true);
            useScriptedDialogue("start");
        } else {
            showAiActions();
            if (askInput) askInput.focus();
        }
        return true;
    }

    function start(id, nodeId) {
        ensureDom();
        if (!panel || !trees[id]) return false;
        if (document.pointerLockElement) document.exitPointerLock();
        if (aiConfigured) return startAiTalk(id);
        treeId = id;
        aiMode = false;
        aiHistory = [];
        open = true;
        panel.hidden = false;
        document.body.classList.add("dialogue-open");
        showNode(nodeId || "start");
        return true;
    }

    function close() {
        if (!panel) return;
        if (global.NpcVoice) global.NpcVoice.stop();
        open = false;
        treeId = null;
        lastSpokenLine = "";
        aiBusy = false;
        aiMode = false;
        storyPickerOpen = false;
        if (choicesEl) choicesEl.innerHTML = "";
        panel.hidden = true;
        document.body.classList.remove("dialogue-open");
        setAskStatus("", false);
        syncAskUi();
    }

    function isOpen() {
        return open;
    }

    function aiReady() {
        return aiConfigured;
    }

    syncCampaignKey();
    fetch("/api/npc-chat", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
            aiConfigured = !!(data && data.configured);
            if (data && data.campaignId != null) campaignKey = String(data.campaignId);
            if (global.NpcVoice && data && data.tts) {
                global.NpcVoice.configure({ serverTts: true });
            }
        })
        .catch(() => {
            aiConfigured = false;
        });

    global.Dialogue = { start, close, isOpen, aiReady, setQuests, setShop };
})(typeof window !== "undefined" ? window : globalThis);
