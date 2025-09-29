import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import didRoutes from './routes/dids.js';
import schemaRoutes from './routes/schemas.js';
import credentialRoutes from './routes/credentials.js';
import oid4vciRoutes from './routes/oid4vci.js';
import oid4vpRoutes from './routes/oid4vp.js';
import issued from './routes/issued.js'



dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

console.log('📍 Registering routes...');
app.use('/api/dids', didRoutes);
console.log('✅ DIDs routes registered');
app.use('/api/schemas', schemaRoutes);
console.log('✅ Schemas routes registered');
app.use('/api/credentials', credentialRoutes);
console.log('✅ Credentials routes registered');
app.use('/api', oid4vciRoutes);
console.log('✅ OID4VCI routes registered');

try {
  app.use('/api/oid4vp', oid4vpRoutes);
  console.log('✅ OID4VP routes registered successfully');
} catch (error) {
  console.error('❌ Error registering OID4VP routes:', error);
}

app.use('/api/issued', issued);
console.log('✅ Issued routes registered');

// Debug endpoint to list all routes
app.get('/api/debug/routes', (req, res) => {
  const routes: any[] = [];

  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Direct route
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      const routerPath = middleware.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '');
      middleware.handle.stack?.forEach((handler: any) => {
        if (handler.route) {
          routes.push({
            path: routerPath + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  res.json({
    success: true,
    routes: routes,
    total: routes.length
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
