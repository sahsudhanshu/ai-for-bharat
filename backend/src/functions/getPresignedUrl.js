/**
 * Lambda: POST /images/presigned-url
 *
 * Generates an S3 presigned URL for direct client-side upload.
 * Saves initial image metadata to DynamoDB with "pending" status.
 *
 * Body: { fileName: string, fileType: string, latitude?: number, longitude?: number }
 * Returns: { uploadUrl, imageId, s3Path }
 */
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const { ddb } = require("../utils/dynamodb");
const { s3 } = require("../utils/s3");
const { verifyToken } = require("../utils/auth");
const { ok, badRequest, unauthorized, serverError } = require("../utils/response");

const BUCKET = process.env.S3_BUCKET_NAME;
const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";
const URL_EXPIRY_SECONDS = 300; // 5 minutes

exports.handler = async (event) => {
    // Handle CORS preflight
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

    const { fileName, fileType, latitude, longitude } = body;

    if (!fileName || !fileType) {
        return badRequest("fileName and fileType are required");
    }

    // Validate mime type
    const allowedTypes = ["image/jpeg", "image/png", "image/heic", "image/webp"];
    if (!allowedTypes.includes(fileType)) {
        return badRequest(`Unsupported file type: ${fileType}`);
    }

    const imageId = uuidv4();
    const userId = decoded.sub;
    const ext = fileName.split(".").pop() || "jpg";
    const s3Key = `uploads/${userId}/${imageId}.${ext}`;
    const createdAt = new Date().toISOString();

    try {
        // 1. Generate presigned URL
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            ContentType: fileType,
            Metadata: { userId, imageId },
        });
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });

        // 2. Save initial metadata to DynamoDB
        await ddb.send(
            new PutCommand({
                TableName: IMAGES_TABLE,
                Item: {
                    imageId,
                    userId,
                    s3Path: `s3://${BUCKET}/${s3Key}`,
                    s3Key,
                    latitude: latitude || null,
                    longitude: longitude || null,
                    status: "pending",
                    analysisResult: null,
                    createdAt,
                    updatedAt: createdAt,
                },
            })
        );

        return ok({ uploadUrl, imageId, s3Path: `s3://${BUCKET}/${s3Key}` });
    } catch (err) {
        console.error("getPresignedUrl error:", err);
        return serverError("Failed to generate upload URL");
    }
};
