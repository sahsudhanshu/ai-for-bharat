require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = 3005;

app.use(cors());
app.use(express.json());

// Helper to convert Express req/res to Lambda Event format
const runLambda = async (req, res, lambdaHandler) => {
    const hasBody = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
    const event = {
        httpMethod: req.method,
        path: req.path,
        headers: req.headers,
        queryStringParameters: req.query,
        pathParameters: req.params,
        body: hasBody ? JSON.stringify(req.body) : null
    };

    try {
        const result = await lambdaHandler(event);
        res.status(result.statusCode).set(result.headers || {}).send(result.body);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Route Definitions mapping to Lambda functions
app.post('/images/presigned-url', (req, res) => runLambda(req, res, require('./src/functions/getPresignedUrl.js').handler));
app.post('/images/:imageId/analyze', (req, res) => runLambda(req, res, require('./src/functions/analyzeImage.js').handler));
app.get('/images', (req, res) => runLambda(req, res, require('./src/functions/getImages.js').handler));
app.get('/map', (req, res) => runLambda(req, res, require('./src/functions/getMapData.js').handler));
app.post('/chat', (req, res) => runLambda(req, res, require('./src/functions/sendChat.js').handler));
app.get('/chat', (req, res) => runLambda(req, res, require('./src/functions/getChatHistory.js').handler));
app.get('/analytics', (req, res) => runLambda(req, res, require('./src/functions/getAnalytics.js').handler));

// Group-based multi-image analysis routes
app.post('/groups/presigned-urls', (req, res) => runLambda(req, res, require('./src/functions/createGroupPresignedUrls.js').handler));
app.post('/groups/:groupId/analyze', (req, res) => runLambda(req, res, require('./src/functions/analyzeGroup.js').handler));
app.get('/groups', (req, res) => runLambda(req, res, require('./src/functions/getGroups.js').handler));
app.get('/groups/:groupId', (req, res) => runLambda(req, res, require('./src/functions/getGroupDetails.js').handler));
app.delete('/groups/:groupId', (req, res) => runLambda(req, res, require('./src/functions/deleteGroup.js').handler));

let server = app.listen(port, () => {
    console.log(`\n🐟  OceanAI Backend Local Server running at http://localhost:${port}`);
    console.log(`Ready to accept requests from the frontend!`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  POST /images/presigned-url`);
    console.log(`  POST /images/:imageId/analyze`);
    console.log(`  GET  /images`);
    console.log(`  GET  /map`);
    console.log(`  POST /chat`);
    console.log(`  GET  /chat`);
    console.log(`  GET  /analytics`);
    console.log(`  POST /groups/presigned-urls`);
    console.log(`  POST /groups/:groupId/analyze`);
    console.log(`  GET  /groups`);
    console.log(`  GET  /groups/:groupId`);
    console.log(`  DELETE /groups/:groupId`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});

server.on('close', () => console.log('Server closed'));
server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

