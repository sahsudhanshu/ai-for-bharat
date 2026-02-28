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

let server = app.listen(port, () => {
    console.log(`\n🐟  OceanAI Backend Local Server running at http://localhost:${port}`);
    console.log(`Ready to accept requests from the frontend!`);
});
server.on('close', () => console.log('Server closed'));
console.log('End of script execution');
