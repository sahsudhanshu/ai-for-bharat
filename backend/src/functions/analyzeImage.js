/**
 * Lambda: POST /images/{imageId}/analyze
 *
 * Calls the external ML API (placeholder) to analyze an uploaded fish image.
 * Stores the analysis result back to DynamoDB.
 *
 * ⚠️  PLUG IN YOUR ML API: Replace the ML_API_URL env var with your real endpoint.
 *     The expected response shape is documented below.
 */
const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../utils/dynamodb");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, notFound, serverError, badRequest } = require("../utils/response");

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";
const ML_API_URL = process.env.ML_API_URL || "https://ml-api.example.com/analyze";
const ML_API_KEY = process.env.ML_API_KEY || "";

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const imageId = event.pathParameters?.imageId;
    if (!imageId) return badRequest("imageId path parameter is required");

    // Fetch existing image record
    let image;
    try {
        const result = await ddb.send(
            new GetCommand({ TableName: IMAGES_TABLE, Key: { imageId } })
        );
        if (!result.Item) return notFound("Image not found");
        if (result.Item.userId !== decoded.sub) return unauthorized("Access denied");
        image = result.Item;
    } catch (err) {
        console.error("analyzeImage fetch error:", err);
        return serverError("Failed to fetch image record");
    }

    // Mark as processing
    await ddb.send(
        new UpdateCommand({
            TableName: IMAGES_TABLE,
            Key: { imageId },
            UpdateExpression: "SET #s = :s, updatedAt = :ua",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":s": "processing", ":ua": new Date().toISOString() },
        })
    );

    try {
        // ── CALL ML API ──────────────────────────────────────────────────────────
        // TODO: Replace with your real ML endpoint.
        // Expected request:  POST ML_API_URL  { s3Path: string }
        // Expected response: {
        //   species: string, scientificName: string, qualityGrade: string,
        //   confidence: number,
        //   measurements: { length_mm: number, weight_g: number, width_mm: number },
        //   compliance: { is_legal_size: boolean, min_legal_size_mm: number },
        //   marketEstimate: { price_per_kg: number, estimated_value: number }
        // }
        // ────────────────────────────────────────────────────────────────────────

        let analysisResult;

        if (ML_API_URL.includes("example.com")) {
            // Placeholder response — remove once real ML API is wired up
            await new Promise((r) => setTimeout(r, 500));
            analysisResult = {
                species: "Indian Pomfret",
                scientificName: "Pampus argenteus",
                qualityGrade: "Premium",
                confidence: 0.94,
                measurements: { length_mm: 185.3, weight_g: 342.7, width_mm: 78.2 },
                compliance: { is_legal_size: true, min_legal_size_mm: 150 },
                marketEstimate: { price_per_kg: 450, estimated_value: 154.2 },
            };
        } else {
            const mlResponse = await fetch(ML_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(ML_API_KEY ? { "x-api-key": ML_API_KEY } : {}),
                },
                body: JSON.stringify({ s3Path: image.s3Path }),
            });

            if (!mlResponse.ok) throw new Error(`ML API returned ${mlResponse.status}`);
            analysisResult = await mlResponse.json();
        }

        // Save result to DynamoDB
        await ddb.send(
            new UpdateCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId },
                UpdateExpression:
                    "SET #s = :s, analysisResult = :ar, updatedAt = :ua",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                    ":s": "completed",
                    ":ar": analysisResult,
                    ":ua": new Date().toISOString(),
                },
            })
        );

        return ok({ imageId, analysisResult });
    } catch (err) {
        console.error("analyzeImage ML call error:", err);
        // Mark failed
        await ddb.send(
            new UpdateCommand({
                TableName: IMAGES_TABLE,
                Key: { imageId },
                UpdateExpression: "SET #s = :s, updatedAt = :ua",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: { ":s": "failed", ":ua": new Date().toISOString() },
            })
        );
        return serverError("ML analysis failed. Please try again.");
    }
};
