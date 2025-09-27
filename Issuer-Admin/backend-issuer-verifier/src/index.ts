import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import didRoutes from './routes/dids.js';
import schemaRoutes from './routes/schemas.js';
import credentialRoutes from './routes/credentials.js';
import oid4vciRoutes from './routes/oid4vci.js';
import issued from './routes/issued.js'



dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/dids', didRoutes);
app.use('/api/schemas', schemaRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api', oid4vciRoutes);
app.use('/api/issued', issued);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
