/**
 * Lambda: GET /images
 *
 * Returns all images uploaded by the authenticated user.
 * Queries DynamoDB userId-GSI.
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
        const result = await ddb.send(
            new QueryCommand({
                TableName: IMAGES_TABLE,
                IndexName: "userId-createdAt-index",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false, // newest first
                Limit: 50,
            })
        );

        return ok({ images: result.Items || [] });
    } catch (err) {
        console.error("getImages error:", err);
        return serverError("Failed to fetch images");
    }
};
