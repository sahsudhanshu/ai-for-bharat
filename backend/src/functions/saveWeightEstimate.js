/**
 * Lambda: POST /weight-estimates
 *
 * Persists a fish weight estimate (from the on-device XGBoost model) for the
 * authenticated user. Stored in the ai-bharat-weight-estimates DynamoDB table.
 *
 * Body:
 *   imageUri   {string}  — local URI used as a correlation key
 *   fishIndex  {number}  — zero-based index of the fish within the analysis
 *   species    {string}  — identified species name
 *   weightG    {number}  — estimated weight in grams
 *   timestamp  {string}  — ISO-8601 timestamp from the mobile device
 */
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const TABLE = process.env.DYNAMODB_WEIGHT_ESTIMATES_TABLE || "ai-bharat-weight-estimates";

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return badRequest("Invalid JSON body");
    }

    const { imageUri, fishIndex, species, weightG, timestamp } = body;

    if (!imageUri || fishIndex === undefined || !species || weightG === undefined) {
        return badRequest("Missing required fields: imageUri, fishIndex, species, weightG");
    }

    if (typeof weightG !== "number" || weightG <= 0) {
        return badRequest("weightG must be a positive number");
    }

    const userId = decoded.sub;
    const id = `${userId}::${Date.now()}`;

    try {
        await ddb.send(new PutCommand({
            TableName: TABLE,
            Item: {
                id,
                userId,
                imageUri,
                fishIndex: Number(fishIndex),
                species,
                weightG,
                timestamp: timestamp || new Date().toISOString(),
                syncedAt: new Date().toISOString(),
            },
        }));

        return ok({ id });
    } catch (err) {
        console.error("[saveWeightEstimate] DynamoDB error:", err);
        return serverError("Failed to save weight estimate");
    }
};
