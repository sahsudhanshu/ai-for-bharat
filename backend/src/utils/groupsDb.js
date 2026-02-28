/**
 * DynamoDB operations for Groups_Table (ai-bharat-groups)
 * 
 * Provides functions to:
 * - Insert new group records with status "pending"
 * - Update group with analysisResult
 * - Update group status
 * - Query groups by userId using GSI
 * - Get group by groupId
 * 
 * Validates: Requirements 5.3, 5.5, 5.7, 5.8, 6.2
 */

const { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("./dynamodb");

const GROUPS_TABLE = process.env.GROUPS_TABLE || "ai-bharat-groups";
const USER_ID_INDEX = "userId-createdAt-index";

/**
 * Insert a new group record with status "pending"
 * 
 * @param {Object} groupData - Group data to insert
 * @param {string} groupData.groupId - Unique group identifier (UUID)
 * @param {string} groupData.userId - User ID from Cognito
 * @param {number} groupData.imageCount - Number of images in the group
 * @param {string[]} groupData.s3Keys - Array of S3 keys for all images
 * @param {number} [groupData.latitude] - Optional latitude coordinate
 * @param {number} [groupData.longitude] - Optional longitude coordinate
 * @param {boolean} [groupData.locationMapped] - Optional location mapping status
 * @param {string} [groupData.locationMapReason] - Optional location mapping reason
 * @returns {Promise<Object>} The created group record
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 2.4, 5.3, 5.4
 */
async function createGroup(groupData) {
    const now = new Date().toISOString();
    
    const item = {
        groupId: groupData.groupId,
        userId: groupData.userId,
        imageCount: groupData.imageCount,
        s3Keys: groupData.s3Keys,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        ...(groupData.latitude !== undefined && { latitude: groupData.latitude }),
        ...(groupData.longitude !== undefined && { longitude: groupData.longitude }),
        ...(groupData.locationMapped !== undefined && { locationMapped: groupData.locationMapped }),
        ...(groupData.locationMapReason && { locationMapReason: groupData.locationMapReason }),
    };

    try {
        await ddb.send(
            new PutCommand({
                TableName: GROUPS_TABLE,
                Item: item,
            })
        );
        return item;
    } catch (error) {
        console.error("Error creating group:", error);
        throw new Error(`Failed to create group: ${error.message}`);
    }
}

/**
 * Get a group record by groupId
 * 
 * @param {string} groupId - The group identifier
 * @returns {Promise<Object|null>} The group record or null if not found
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.7
 */
async function getGroup(groupId) {
    try {
        const result = await ddb.send(
            new GetCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
            })
        );
        return result.Item || null;
    } catch (error) {
        console.error("Error getting group:", error);
        throw new Error(`Failed to get group: ${error.message}`);
    }
}

/**
 * Query groups by userId using GSI, sorted by createdAt descending
 * 
 * @param {string} userId - The user identifier
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=20] - Maximum number of items to return
 * @param {Object} [options.lastKey] - Pagination token from previous query
 * @returns {Promise<Object>} Object with items array and optional lastKey
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 6.2, 6.3, 6.4
 */
async function queryGroupsByUserId(userId, options = {}) {
    const { limit = 20, lastKey } = options;

    try {
        const params = {
            TableName: GROUPS_TABLE,
            IndexName: USER_ID_INDEX,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId,
            },
            ScanIndexForward: false, // Sort by createdAt descending (newest first)
            Limit: limit,
        };

        if (lastKey) {
            params.ExclusiveStartKey = lastKey;
        }

        const result = await ddb.send(new QueryCommand(params));

        return {
            items: result.Items || [],
            lastKey: result.LastEvaluatedKey,
        };
    } catch (error) {
        console.error("Error querying groups by userId:", error);
        throw new Error(`Failed to query groups: ${error.message}`);
    }
}

/**
 * Update group status
 * 
 * @param {string} groupId - The group identifier
 * @param {string} status - New status ("pending" | "processing" | "completed" | "partial" | "failed")
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.7, 5.8
 */
async function updateGroupStatus(groupId, status) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":status": status,
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error updating group status:", error);
        throw new Error(`Failed to update group status: ${error.message}`);
    }
}

/**
 * Update group with analysis result
 * 
 * @param {string} groupId - The group identifier
 * @param {Object} analysisResult - The complete group analysis result
 * @param {Array} analysisResult.images - Array of image analysis results
 * @param {Object} analysisResult.aggregateStats - Aggregate statistics
 * @param {string} analysisResult.processedAt - ISO 8601 timestamp
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.5, 5.6
 */
async function updateGroupAnalysis(groupId, analysisResult) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET analysisResult = :analysisResult, updatedAt = :updatedAt",
                ExpressionAttributeValues: {
                    ":analysisResult": analysisResult,
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error updating group analysis:", error);
        throw new Error(`Failed to update group analysis: ${error.message}`);
    }
}

/**
 * Update group with both analysis result and status
 * Convenience function to update both fields atomically
 * 
 * @param {string} groupId - The group identifier
 * @param {Object} analysisResult - The complete group analysis result
 * @param {string} status - New status ("completed" | "partial" | "failed")
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 * 
 * Validates: Requirements 5.5, 5.7, 5.8
 */
async function updateGroupAnalysisAndStatus(groupId, analysisResult, status) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET analysisResult = :analysisResult, #status = :status, updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":analysisResult": analysisResult,
                    ":status": status,
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error updating group analysis and status:", error);
        throw new Error(`Failed to update group analysis and status: ${error.message}`);
    }
}

/**
 * Add error information for a failed image
 * 
 * @param {string} groupId - The group identifier
 * @param {Object} errorInfo - Error information
 * @param {number} errorInfo.imageIndex - Index of the failed image
 * @param {string} errorInfo.error - Error message
 * @param {string} errorInfo.timestamp - ISO 8601 timestamp
 * @returns {Promise<Object>} The updated attributes
 * @throws {Error} If DynamoDB operation fails
 */
async function addGroupError(groupId, errorInfo) {
    const now = new Date().toISOString();

    try {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
                UpdateExpression: "SET errors = list_append(if_not_exists(errors, :emptyList), :errorInfo), updatedAt = :updatedAt",
                ExpressionAttributeValues: {
                    ":errorInfo": [errorInfo],
                    ":emptyList": [],
                    ":updatedAt": now,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    } catch (error) {
        console.error("Error adding group error:", error);
        throw new Error(`Failed to add group error: ${error.message}`);
    }
}

/**
 * Delete a group record by groupId
 * 
 * @param {string} groupId - The group identifier
 * @returns {Promise<void>}
 * @throws {Error} If DynamoDB operation fails
 */
async function deleteGroup(groupId) {
    try {
        await ddb.send(
            new DeleteCommand({
                TableName: GROUPS_TABLE,
                Key: { groupId },
            })
        );
    } catch (error) {
        console.error("Error deleting group:", error);
        throw new Error(`Failed to delete group: ${error.message}`);
    }
}

module.exports = {
    createGroup,
    getGroup,
    queryGroupsByUserId,
    updateGroupStatus,
    updateGroupAnalysis,
    updateGroupAnalysisAndStatus,
    addGroupError,
    deleteGroup,
};
