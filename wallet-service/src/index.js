import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WalletService } from './wallet-service.js';
import fs from 'fs';
import path from 'path';
dotenv.config();
const app = express();
const walletService = new WalletService();
// Middleware
app.use(cors());
app.use(express.json());
// Ensure database directory exists
const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
// Initialize wallet service
walletService
    .initialize()
    .then(() => {
    console.log('🎉 Wallet Service ready to handle requests!');
})
    .catch((error) => {
    console.error('❌ Failed to initialize wallet service:', error);
    process.exit(1);
});
// ========== HEALTH & STATUS ==========
app.get('/health', async (req, res) => {
    try {
        const health = await walletService.healthCheck();
        res.json(health);
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
        });
    }
});
app.get('/status', async (req, res) => {
    try {
        const status = await walletService.getWalletStatus();
        res.json({
            success: true,
            wallet: status,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
// ========== OID4VCI ENDPOINTS ==========
app.post('/receive-credential', async (req, res) => {
    try {
        const { offer_uri, user_pin, issuer_base_url } = req.body;
        if (!offer_uri) {
            return res.status(400).json({
                success: false,
                error: 'Missing offer_uri parameter',
            });
        }
        const result = await walletService.receiveCredential(offer_uri, user_pin, issuer_base_url || 'http://localhost:8000');
        res.json({
            success: true,
            result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
app.get('/credentials', async (req, res) => {
    try {
        const { type } = req.query;
        const credentials = await walletService.getStoredCredentials(type);
        res.json({
            success: true,
            credentials,
            count: credentials.length,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
// ========== OID4VP ENDPOINTS ==========
app.post('/preview-presentation', async (req, res) => {
    try {
        const { request_uri } = req.body;
        if (!request_uri) {
            return res.status(400).json({
                success: false,
                error: 'Missing request_uri parameter',
            });
        }
        const preview = await walletService.previewPresentationRequest(request_uri);
        res.json({
            success: true,
            preview,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
app.post('/present-credentials', async (req, res) => {
    try {
        const { request_uri, auto_select = true, selected_credential_hashes } = req.body;
        if (!request_uri) {
            return res.status(400).json({
                success: false,
                error: 'Missing request_uri parameter',
            });
        }
        const result = await walletService.respondToPresentationRequest(request_uri, auto_select, selected_credential_hashes);
        res.json({
            success: result.success,
            result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
// ========== COMPLETE SSI FLOW ==========
app.post('/complete-ssi-flow', async (req, res) => {
    try {
        const { credential_offer_uri, presentation_request_uri, user_pin, issuer_base_url } = req.body;
        if (!credential_offer_uri || !presentation_request_uri) {
            return res.status(400).json({
                success: false,
                error: 'Missing credential_offer_uri or presentation_request_uri',
            });
        }
        const result = await walletService.demonstrateCompleteSSIFlow(credential_offer_uri, presentation_request_uri, user_pin, issuer_base_url || 'http://localhost:8000');
        res.json({
            success: true,
            flow_result: result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
// ========== UTILITY ENDPOINTS ==========
app.get('/wallet-did', async (req, res) => {
    try {
        const walletDid = walletService.walletDid;
        if (!walletDid) {
            return res.status(500).json({
                success: false,
                error: 'Wallet DID not available',
            });
        }
        res.json({
            success: true,
            wallet_did: walletDid,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
            'GET /health',
            'GET /status',
            'GET /wallet-did',
            'GET /credentials',
            'POST /receive-credential',
            'POST /preview-presentation',
            'POST /present-credentials',
            'POST /complete-ssi-flow',
        ],
    });
});
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
    console.log(`🎯 SSI Wallet Service running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`💳 Wallet endpoints available for OID4VCI and OID4VP flows`);
});
//# sourceMappingURL=index.js.map