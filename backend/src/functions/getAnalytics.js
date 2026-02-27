/**
 * Lambda: GET /analytics
 *
 * Returns aggregate analytics for the authenticated user.
 * Computes stats from DynamoDB images + chat records.
 */
const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, serverError } = require("../utils/response");

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;

    try {
        // Fetch all completed images for the user (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const result = await ddb.send(
            new QueryCommand({
                TableName: IMAGES_TABLE,
                IndexName: "userId-createdAt-index",
                KeyConditionExpression: "userId = :uid AND createdAt >= :since",
                FilterExpression: "#s = :completed",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                    ":uid": userId,
                    ":since": sixMonthsAgo.toISOString(),
                    ":completed": "completed",
                },
                ScanIndexForward: true,
            })
        );

        const items = result.Items || [];

        // ── Compute stats ─────────────────────────────────────────────────────────
        let totalEarnings = 0;
        let totalWeight = 0;
        const speciesCounts = {};
        const qualityCounts = {};
        const weeklyMap = {};

        for (const item of items) {
            const ar = item.analysisResult || {};
            const value = ar.marketEstimate?.estimated_value || 0;
            const weight = ar.measurements?.weight_g || 0;
            const species = ar.species || "Unknown";
            const grade = ar.qualityGrade || "Unknown";

            totalEarnings += value;
            totalWeight += weight;
            speciesCounts[species] = (speciesCounts[species] || 0) + 1;
            qualityCounts[grade] = (qualityCounts[grade] || 0) + 1;

            // Aggregate by ISO week
            const d = new Date(item.createdAt);
            const weekNum = Math.ceil(d.getDate() / 7);
            const weekKey = `${d.getFullYear()}-W${d.getMonth() + 1}-${weekNum}`;
            if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { earnings: 0, catches: 0 };
            weeklyMap[weekKey].earnings += value;
            weeklyMap[weekKey].catches += 1;
        }

        const totalCatches = items.length;
        const avgWeight = totalCatches > 0 ? totalWeight / totalCatches : 0;

        const topSpecies = Object.entries(speciesCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

        const speciesBreakdown = Object.entries(speciesCounts).map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / totalCatches) * 100) || 0,
        }));

        const qualityDistribution = Object.entries(qualityCounts).map(([grade, count]) => ({
            grade,
            count,
        }));

        const weeklyTrend = Object.entries(weeklyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-8)
            .map(([date, data]) => ({ date, ...data }));

        return ok({
            totalImages: items.length,
            totalCatches,
            totalEarnings: Math.round(totalEarnings),
            avgWeight: Math.round(avgWeight),
            topSpecies,
            weeklyTrend,
            speciesBreakdown,
            qualityDistribution,
        });
    } catch (err) {
        console.error("getAnalytics error:", err);
        return serverError("Failed to compute analytics");
    }
};
