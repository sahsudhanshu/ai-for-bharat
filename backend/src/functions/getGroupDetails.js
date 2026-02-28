/**
 * Lambda: GET /groups/:groupId
 *
 * Returns complete group details including all images and analysis results.
 * Generates presigned GET URLs for viewing original images.
 * 
 * Validates: Requirements 12.5, 12.7, 12.8
 */
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { verifyToken } = require("../utils/auth");
const { ok, unauthorized, notFound, serverError, badRequest } = require("../utils/response");
const { getGroup } = require("../utils/groupsDb");
const { s3 } = require("../utils/s3");

const BUCKET = process.env.S3_BUCKET_NAME;
const URL_EXPIRY_SECONDS = 3600; // 1 hour for viewing

/**
 * Generate presigned GET URLs for viewing images
 * 
 * @param {string[]} s3Keys - Array of S3 keys
 * @returns {Promise<string[]>} Array of presigned GET URLs
 */
async function generatePresignedViewUrls(s3Keys) {
    return Promise.all(
        s3Keys.map(async (s3Key) => {
            const command = new GetObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
            });
            return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });
        })
    );
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});

    // Verify authentication
    let decoded;
    try {
        decoded = await verifyToken(event);
    } catch {
        return unauthorized();
    }

    const userId = decoded.sub;
    const groupId = event.pathParameters?.groupId;

    if (!groupId) {
        return badRequest("groupId path parameter is required");
    }

    try {
        // Get group record from DynamoDB
        const group = await getGroup(groupId);

        if (!group) {
            return notFound("Group not found");
        }

        // Verify user owns the group
        if (group.userId !== userId) {
            return unauthorized("Access denied");
        }

        // Generate presigned GET URLs for viewing original images
        const presignedViewUrls = await generatePresignedViewUrls(group.s3Keys || []);

        // Return complete group details
        return ok({
            groupId: group.groupId,
            userId: group.userId,
            imageCount: group.imageCount,
            status: group.status,
            s3Keys: group.s3Keys,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            analysisResult: group.analysisResult,
            presignedViewUrls,
            // Include location data if available
            ...(group.latitude !== undefined && { latitude: group.latitude }),
            ...(group.longitude !== undefined && { longitude: group.longitude }),
            ...(group.locationMapped !== undefined && { locationMapped: group.locationMapped }),
            ...(group.locationMapReason && { locationMapReason: group.locationMapReason }),
        });
    } catch (err) {
        console.error("getGroupDetails error:", err);
        return serverError("Failed to fetch group details");
    }
};
