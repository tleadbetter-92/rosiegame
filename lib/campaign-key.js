async function readCampaignState() {
    const { readState } = require("../api/campaign");
    return readState();
}

async function currentCampaignId() {
    const state = await readCampaignState();
    return String(state.restartedAt || state.startedAt || 0);
}

async function currentPlayMs() {
    const state = await readCampaignState();
    return Number.isFinite(state.playMs) ? state.playMs : 0;
}

module.exports = { currentCampaignId, currentPlayMs, readCampaignState };
