// src/routes/issued.ts
import { Router } from 'express';
import { agent } from '../agent.js';
const router = Router();
/**
 * GET /api/issued
 * Query params:
 *   - subjectDid: filter by holder DID
 *   - issuer:     filter by issuer DID/URL
 *   - type:       filter by VC type (e.g., "UniversityDegreeCredential")
 *   - take:       page size (default 25)
 *   - skip:       offset (default 0)
 */
router.get('/', async (req, res) => {
    try {
        const subjectDid = req.query.subjectDid || undefined;
        const issuer = req.query.issuer || undefined;
        const type = req.query.type || undefined;
        const take = Number(req.query.take ?? 25);
        const skip = Number(req.query.skip ?? 0);
        const where = [];
        if (subjectDid)
            where.push({ column: 'subject', value: subjectDid });
        if (issuer)
            where.push({ column: 'issuer', value: issuer });
        if (type)
            where.push({ column: 'type', value: type });
        // Sort newest first if supported by your Veramo store
        const order = [{ column: 'issuanceDate', direction: 'DESC' }];
        const rows = await agent.dataStoreORMGetVerifiableCredentials({
            where: where.length ? where : undefined,
            order,
            take,
            skip,
        });
        // Normalize to a compact summary for the admin table
        const items = rows.map((r) => {
            const vc = r.verifiableCredential || r.vc || r; // be defensive across versions
            const types = Array.isArray(vc?.type) ? vc.type : (vc?.type ? [vc.type] : []);
            return {
                hash: r.hash, // use this to fetch the full object (see /:hash below)
                type: types,
                primaryType: types[1] || types[0] || null,
                issuer: vc?.issuer?.id || vc?.issuer || null,
                subject: vc?.credentialSubject?.id || null,
                issuanceDate: vc?.issuanceDate || null,
                expirationDate: vc?.expirationDate || null,
                proofFormat: r.proofFormat || 'jwt',
            };
        });
        res.json({ take, skip, count: items.length, items });
    }
    catch (e) {
        console.error('[issued] list error:', e);
        res.status(500).json({ error: 'internal_error', detail: String(e?.message || e) });
    }
});
/**
 * GET /api/issued/:hash
 * Returns the full verifiable credential for a given hash.
 */
router.get('/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const vc = await agent.dataStoreGetVerifiableCredential({ hash });
        res.json(vc);
    }
    catch (e) {
        res.status(404).json({ error: 'not_found', detail: String(e?.message || e) });
    }
});
export default router;
