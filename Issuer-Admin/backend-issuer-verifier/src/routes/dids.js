import express from 'express';
import { agent } from '../agent.js';
const router = express.Router();
router.post('/create', async (req, res) => {
    try {
        const { method } = req.body; // Options: "did:key", "did:ethr", "did:cheqd"
        const did = await agent.didManagerCreate({ provider: method });
        res.json({ success: true, did });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/resolve/:did', async (req, res) => {
    try {
        const did = req.params.did;
        const resolvedDID = await agent.resolveDid({ didUrl: did });
        res.json({ success: true, resolvedDID });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/list', async (req, res) => {
    try {
        const dids = await agent.didManagerFind();
        res.json({ success: true, dids });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;
