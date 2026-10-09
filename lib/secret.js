const crypto = require("crypto");

const MARK = "enc1:";
const BYTE_MARK = Buffer.from("RG1");

function keyBytes() {
    const raw = process.env.MESSAGE_KEY || "";
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
        const error = new Error("MESSAGE_KEY is not set");
        error.status = 500;
        throw error;
    }
    return key;
}

function seal(buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
    const body = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([BYTE_MARK, iv, tag, body]);
}

function openSealed(buffer) {
    const iv = buffer.subarray(3, 15);
    const tag = buffer.subarray(15, 31);
    const body = buffer.subarray(31);
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
}

function isSealed(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length >= 31 && buffer.subarray(0, 3).equals(BYTE_MARK);
}

function encryptBytes(value) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
    if (!buffer.length || isSealed(buffer)) return buffer;
    return seal(buffer);
}

function decryptBytes(value) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
    if (!isSealed(buffer)) return buffer;
    return openSealed(buffer);
}

function encryptText(value) {
    const text = String(value || "");
    if (!text || text.startsWith(MARK)) return text;
    return MARK + seal(Buffer.from(text, "utf8")).toString("base64");
}

function decryptText(value) {
    const text = String(value || "");
    if (!text.startsWith(MARK)) return text;
    return openSealed(Buffer.from(text.slice(MARK.length), "base64")).toString("utf8");
}

function encryptQuote(quote) {
    if (!quote || !quote.text) return quote || null;
    return {
        id: quote.id,
        username: quote.username,
        text: encryptText(quote.text)
    };
}

function decryptQuote(quote) {
    if (!quote || !quote.text) return null;
    return {
        id: quote.id,
        username: quote.username,
        text: decryptText(quote.text)
    };
}

module.exports = {
    encryptText,
    decryptText,
    encryptBytes,
    decryptBytes,
    encryptQuote,
    decryptQuote
};
