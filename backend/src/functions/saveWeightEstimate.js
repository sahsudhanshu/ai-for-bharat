/**
 * Lambda: POST /weight-estimates
 *
 * Persists a user-entered fish weight estimate into the ai-bharat-groups
 * record so that the updated weight is visible on the web dashboard.
 *
 * If `groupId` is absent (offline-only session not yet synced) the call
 * succeeds silently — the weight is already persisted locally on device and
 * will be included when the offline analysis itself syncs.
 *
 * Body:
 *   groupId    {string?} — cloud group ID (present for online / synced records)
 *   imageUri   {string}  — local URI used as a correlation key
 *   fishIndex  {number}  — zero-based index of the fish within the analysis
 *   species    {string}  — identified species name
 *   weightG    {number}  — estimated weight in grams
 *   timestamp  {string}  — ISO-8601 timestamp from the mobile device
 */
const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const GROUPS_TABLE = process.env.GROUPS_TABLE || "ai-bharat-groups";

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

    const { groupId, imageUri, fishIndex, species, weightG, timestamp } = body;

    if (!imageUri || fishIndex === undefined || !species || weightG === undefined) {
        return badRequest("Missing required fields: imageUri, fishIndex, species, weightG");
    }

    if (typeof weightG !== "number" || weightG <= 0) {
        return badRequest("weightG must be a positive number");
    }

    // No groupId means the record is offline-only and not yet synced to cloud.
    // Return success so the mobile queue item is cleared and not retried.
    if (!groupId) {
        return ok({ stored: false, reason: "no_group_id" });
    }

    const userId = decoded.sub;

    try {
        // Fetch the group to verify ownership and read the current weightEstimates map.
        const { Item: group } = await ddb.send(new GetCommand({
            TableName: GROUPS_TABLE,
            Key: { groupId },
        }));

        if (!group) {
            return badRequest("Group not found");
        }
        if (group.userId !== userId) {
            return unauthorized();
        }

        const weightKg = weightG / 1000;
        const fishKey = `fish_${Number(fishIndex)}`;

        // Merge the new weight into the existing per-fish estimates map and
        // recompute the aggregate total.
        const existing = group.weightEstimates || {};
        const updatedMap = { ...existing, [fishKey]: weightKg };
        const totalWeightKg = Object.values(updatedMap).reduce((s, v) => s + (v || 0), 0);

        // Build the update — also patch aggregateStats if they exist on the record.
        const hasAggregateStats = group.analysisResult?.aggregateStats !== undefined;
        const updateExpr = hasAggregateStats
            ? "SET weightEstimates = :wm, analysisResult.aggregateStats.totalEstimatedWeight = :tw, updatedAt = :ua"
            : "SET weightEstimates = :wm, updatedAt = :ua";

        await ddb.send(new UpdateCommand({
            TableName: GROUPS_TABLE,
            Key: { groupId },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: {
                ":wm": updatedMap,
                ...(hasAggregateStats && { ":tw": totalWeightKg }),
                ":ua": new Date().toISOString(),
            },
        }));

        console.log(`[saveWeightEstimate] group=${groupId} ${fishKey}=${weightKg} kg (total=${totalWeightKg} kg)`);
        return ok({ stored: true, groupId, fishKey, weightKg, totalWeightKg });

    } catch (err) {
        console.error("[saveWeightEstimate] DynamoDB error:", err);
        return serverError("Failed to save weight estimate");
    }
};
