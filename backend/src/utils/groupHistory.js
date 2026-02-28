/**
 * Group history service for querying and merging group and legacy image records
 * 
 * Provides functions to:
 * - Query user's groups from Groups_Table
 * - Transform legacy single-image records to group format
 * - Merge and sort both sources by createdAt
 * 
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("./dynamodb");
const { queryGroupsByUserId } = require("./groupsDb");

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";
const USER_ID_INDEX = "userId-createdAt-index";

/**
 * Query legacy images table by userId
 * 
 * @param {string} userId - The user identifier
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=20] - Maximum number of items to return
 * @returns {Promise<Array>} Array of legacy image records
 * @throws {Error} If DynamoDB operation fails
 */
async function queryLegacyImages(userId, options = {}) {
    const { limit = 20 } = options;

    try {
        const result = await ddb.send(
            new QueryCommand({
                TableName: IMAGES_TABLE,
                IndexName: USER_ID_INDEX,
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: {
                    ":userId": userId,
                },
                ScanIndexForward: false, // Sort by createdAt descending
                Limit: limit,
            })
        );

        return result.Items || [];
    } catch (error) {
        console.error("Error querying legacy images:", error);
        throw new Error(`Failed to query legacy images: ${error.message}`);
    }
}

/**
 * Transform a legacy single-image record to group format
 * 
 * @param {Object} legacyRecord - Legacy image record from ai-bharat-images table
 * @returns {Object} Transformed group history item
 * 
 * Validates: Requirements 6.6, 6.7
 */
function transformLegacyToGroup(legacyRecord) {
    // Extract species and fish count from analysisResult if available
    let primarySpecies = null;
    let totalFishCount = 0;
    
    if (legacyRecord.analysisResult) {
        // Legacy records store single fish analysis
        primarySpecies = legacyRecord.analysisResult.species;
        totalFishCount = 1; // Legacy records are single fish
    }

    return {
        groupId: legacyRecord.imageId, // Use imageId as groupId
        userId: legacyRecord.userId,
        imageCount: 1, // Legacy records always have 1 image
        status: legacyRecord.status || "completed",
        createdAt: legacyRecord.createdAt,
        updatedAt: legacyRecord.updatedAt || legacyRecord.createdAt,
        primarySpecies,
        totalFishCount,
        // Include analysisResult for compatibility
        analysisResult: legacyRecord.analysisResult,
        // Mark as legacy for frontend differentiation
        isLegacy: true,
    };
}

/**
 * Query and merge group history from both Groups_Table and legacy images table
 * 
 * @param {string} userId - The user identifier
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=20] - Maximum number of items to return
 * @returns {Promise<Object>} Object with items array and optional lastKey
 * 
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5
 */
async function getMergedHistory(userId, options = {}) {
    const { limit = 20 } = options;

    try {
        // Query both tables concurrently
        const [groupsResult, legacyImages] = await Promise.all([
            queryGroupsByUserId(userId, { limit }),
            queryLegacyImages(userId, { limit }),
        ]);

        // Transform legacy records to group format
        const transformedLegacy = legacyImages.map(transformLegacyToGroup);

        // Merge both sources
        const merged = [...groupsResult.items, ...transformedLegacy];

        // Sort by createdAt descending (newest first)
        merged.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        });

        // Apply limit to merged results
        const items = merged.slice(0, limit);

        return {
            items,
            // Note: Pagination with lastKey is complex with merged sources
            // For MVP, we return up to limit items without pagination token
            lastKey: groupsResult.lastKey,
        };
    } catch (error) {
        console.error("Error getting merged history:", error);
        throw new Error(`Failed to get merged history: ${error.message}`);
    }
}

module.exports = {
    queryLegacyImages,
    transformLegacyToGroup,
    getMergedHistory,
};
