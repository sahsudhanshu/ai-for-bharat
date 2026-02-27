/**
 * Local Lambda test runner — no AWS deployment needed.
 *
 * Usage:  node test-local.js [functionName]
 * 
 * Examples:
 *   node test-local.js                    ← runs all tests
 *   node test-local.js getPresignedUrl    ← runs only that test
 *   node test-local.js sendChat          ← runs chat test
 *
 * Works without real AWS creds — uses DEMO MODE (auth bypass + mock responses).
 */

"use strict";

// ── Env setup (must be before any require) ───────────────────────────────────
process.env.AWS_REGION = "ap-south-1";
process.env.DYNAMODB_IMAGES_TABLE = "ai-bharat-images";
process.env.DYNAMODB_CHATS_TABLE = "ai-bharat-chats";
process.env.DYNAMODB_USERS_TABLE = "ai-bharat-users";
process.env.S3_BUCKET_NAME = "ai-bharat-fish-images";
process.env.COGNITO_USER_POOL_ID = "ap-south-1_XXXXXXXXX";
// Leave blank → auth.js falls back to DEMO MODE (sub = "demo_user_001")
process.env.COGNITO_CLIENT_ID = "";
process.env.ML_API_URL = "";    // blank → analyzeImage returns mock
process.env.ML_API_KEY = "";
process.env.CHAT_API_URL = "";    // blank → sendChat returns mock
process.env.CHAT_API_KEY = "";

// ── Colour helpers ───────────────────────────────────────────────────────────
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// ── Mock Lambda event factory ────────────────────────────────────────────────
const DEMO_TOKEN = "demo_jwt_token_fisherman_001";

function makeEvent(method, path, { body = null, query = {}, pathParams = {} } = {}) {
    return {
        httpMethod: method,
        path,
        pathParameters: pathParams,
        queryStringParameters: query,
        headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
        body: body ? JSON.stringify(body) : null,
    };
}

// ── Pretty-print result ──────────────────────────────────────────────────────
function printResult(name, res) {
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    const icon = ok ? "✓" : "✗";
    const colour = ok ? green : red;
    console.log(`\n${bold(colour(`${icon} ${name}`))}  [${res.statusCode}]`);
    try {
        const parsed = JSON.parse(res.body);
        // Truncate large objects for readability
        const str = JSON.stringify(parsed, null, 2);
        console.log(str.length > 1200 ? str.slice(0, 1200) + "\n  ... (truncated)" : str);
    } catch {
        console.log(res.body);
    }
}

// ── Test definitions ─────────────────────────────────────────────────────────
const TESTS = {

    async getPresignedUrl() {
        const { handler } = require("./src/functions/getPresignedUrl.js");
        const event = makeEvent("POST", "/images/presigned-url", {
            body: { fileName: "catch_sample.jpg", fileType: "image/jpeg", latitude: 18.52, longitude: 72.5 },
        });
        return handler(event);
    },

    async analyzeImage() {
        const { handler } = require("./src/functions/analyzeImage.js");
        // Uses a fake imageId — with blank ML_API_URL this returns a mock
        const event = makeEvent("POST", "/images/demo_img_001/analyze", {
            pathParams: { imageId: "demo_img_001" },
        });
        return handler(event);
    },

    async sendChat() {
        const { handler } = require("./src/functions/sendChat.js");
        const event = makeEvent("POST", "/chat", {
            body: { message: "What fish should I catch near Ratnagiri today?" },
        });
        return handler(event);
    },

    async getChatHistory() {
        const { handler } = require("./src/functions/getChatHistory.js");
        const event = makeEvent("GET", "/chat", { query: { limit: "10" } });
        return handler(event);
    },

    async getImages() {
        const { handler } = require("./src/functions/getImages.js");
        const event = makeEvent("GET", "/images", { query: { limit: "5" } });
        return handler(event);
    },

    async getMapData() {
        const { handler } = require("./src/functions/getMapData.js");
        const event = makeEvent("GET", "/map", {
            query: { species: "Pomfret", from: "2025-01-01", to: "2026-12-31" },
        });
        return handler(event);
    },

    async getAnalytics() {
        const { handler } = require("./src/functions/getAnalytics.js");
        const event = makeEvent("GET", "/analytics");
        return handler(event);
    },

    async corsPreflightCheck() {
        // Every route must handle OPTIONS with a 200
        const { handler } = require("./src/functions/getAnalytics.js");
        const event = { httpMethod: "OPTIONS", headers: {} };
        return handler(event);
    },

};

// ── Runner ───────────────────────────────────────────────────────────────────
async function run() {
    const targetTest = process.argv[2]; // optional: run single test
    const tests = targetTest
        ? { [targetTest]: TESTS[targetTest] }
        : TESTS;

    if (targetTest && !TESTS[targetTest]) {
        console.error(red(`Unknown test: "${targetTest}"`));
        console.log(`Available tests: ${Object.keys(TESTS).join(", ")}`);
        process.exit(1);
    }

    console.log(bold(cyan(`\n🐟  OceanAI Backend — Local Test Runner`)));
    console.log(yellow(`Running ${Object.keys(tests).length} test(s)...\n`));
    console.log("─".repeat(60));

    let passed = 0, failed = 0;

    for (const [name, fn] of Object.entries(tests)) {
        try {
            const res = await fn();
            printResult(name, res);
            if (res.statusCode >= 200 && res.statusCode < 300) passed++;
            else failed++;
        } catch (err) {
            console.log(`\n${red(`✗ ${name}`)}  [EXCEPTION]`);
            console.log(red(err.message));
            if (err.code === "CredentialsProviderError" || err.code === "ExpiredTokenException") {
                console.log(yellow("  ⚠ AWS credentials not configured. This test needs real DynamoDB."));
                console.log(yellow("  → Either (a) run `aws configure`, or (b) set DEMO_MODE=true in auth.js"));
            }
            failed++;
        }
    }

    console.log("\n" + "─".repeat(60));
    console.log(bold(`\nResults: ${green(`${passed} passed`)}  ${failed > 0 ? red(`${failed} failed`) : ""}`));

    if (failed > 0) {
        console.log(yellow(`\nNote: Failures are expected for routes that hit real DynamoDB/S3`));
        console.log(yellow(`without AWS credentials. Set up credentials with 'aws configure'`));
        console.log(yellow(`or deploy to Lambda where the IAM role provides access.\n`));
        process.exit(1);
    }
}

run().catch((err) => {
    console.error(red("\nFatal runner error:"), err);
    process.exit(1);
});
