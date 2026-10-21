// Region 1 NPC chat — lore folder: Rosiegame_AI_World_Bible/Region 1/
// Godwin: INNKEEPER_GODWIN.md + Godwin_Conversation_Example.md + Attacks_in_the_Woods.md
// UI: crosshair label, E / click to talk, reply buttons (AI later replaces lines; keep Dialogue.start).
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
                        { label: "Nothing, thanks.", next: "bye" }
                    ]
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
        }
    };

    let panel = null;
    let titleEl = null;
    let textEl = null;
    let choicesEl = null;
    let leaveBtn = null;
    let treeId = null;
    let open = false;

    function ensureDom() {
        if (panel) return;
        panel = document.getElementById("dialogue");
        if (!panel) return;
        titleEl = panel.querySelector("[data-dialogue-name]");
        textEl = panel.querySelector("[data-dialogue-text]");
        choicesEl = panel.querySelector("[data-dialogue-choices]");
        leaveBtn = panel.querySelector("[data-dialogue-leave]");
        if (leaveBtn) leaveBtn.addEventListener("click", () => close());
    }

    function renderNode(nodeId) {
        const tree = trees[treeId];
        if (!tree) return close();
        const node = tree.nodes[nodeId];
        if (!node) return close();
        titleEl.textContent = tree.title;
        textEl.textContent = node.say;
        choicesEl.innerHTML = "";
        for (const choice of node.choices || []) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dialogue-choice";
            btn.textContent = choice.label;
            btn.addEventListener("click", () => showNode(choice.next));
            choicesEl.appendChild(btn);
        }
        if (!node.choices || !node.choices.length) {
            window.setTimeout(() => close(), 1200);
        }
    }

    function showNode(nodeId) {
        ensureDom();
        if (!panel) return;
        renderNode(nodeId);
    }

    function start(id, nodeId) {
        ensureDom();
        if (!panel || !trees[id]) return false;
        treeId = id;
        open = true;
        panel.hidden = false;
        document.body.classList.add("dialogue-open");
        if (document.pointerLockElement) document.exitPointerLock();
        showNode(nodeId || "start");
        return true;
    }

    function close() {
        if (!panel) return;
        open = false;
        treeId = null;
        panel.hidden = true;
        document.body.classList.remove("dialogue-open");
    }

    function isOpen() {
        return open;
    }

    global.Dialogue = { start, close, isOpen };
})(typeof window !== "undefined" ? window : globalThis);
