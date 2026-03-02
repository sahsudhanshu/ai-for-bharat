const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, badRequest, serverError } = require("../utils/response");

// Uses the same AWS region as the rest of the app
const polly = new PollyClient({ region: process.env.AWS_REGION || "ap-south-1" });

const VOICE_MAP = {
    "en-IN": { VoiceId: "Kajal", Engine: "neural", LanguageCode: "en-IN" },
    "hi-IN": { VoiceId: "Kajal", Engine: "neural", LanguageCode: "hi-IN" },
    "ta-IN": { VoiceId: "Kani", Engine: "standard", LanguageCode: "ta-IN" },
    "te-IN": { VoiceId: "Shruti", Engine: "standard", LanguageCode: "te-IN" },
    // Fallbacks for languages Polly doesn't fully support yet
    "bn-IN": { VoiceId: "Aditi", Engine: "standard", LanguageCode: "hi-IN" },
    "mr-IN": { VoiceId: "Aditi", Engine: "standard", LanguageCode: "hi-IN" },
};

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        // Return unauthorized, but we might want to allow this for testing if needed
        return unauthorized();
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return badRequest("Invalid JSON body");
    }

    const { text, languageCode = "en-IN" } = body;
    if (!text?.trim()) return badRequest("text is required");

    const voiceConfig = VOICE_MAP[languageCode] || VOICE_MAP["en-IN"];

    const input = {
        Text: text.substring(0, 1500),
        OutputFormat: "mp3",
        VoiceId: voiceConfig.VoiceId,
        LanguageCode: voiceConfig.LanguageCode,
        Engine: voiceConfig.Engine,
    };

    try {
        const command = new SynthesizeSpeechCommand(input);
        const response = await polly.send(command);

        // Convert stream to buffer
        const chunks = [];
        for await (let chunk of response.AudioStream) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);
        const audioBase64 = audioBuffer.toString("base64");

        return ok({ audioBase64 });
    } catch (err) {
        console.error("synthesizeSpeech error:", err);
        return serverError("Failed to synthesize speech");
    }
};
