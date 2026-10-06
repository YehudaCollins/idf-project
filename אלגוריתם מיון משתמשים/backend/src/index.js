const path = require('path');
const fs = require('fs');
const hostingPort = process.env.PORT;
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath, override: true });
}
else {
    require('dotenv').config({ override: true });
}
// IISNode supplies a named-pipe value through PORT. Never replace it with .env.
if (hostingPort) {
    process.env.PORT = hostingPort;
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { connectDb } = require('./config/db');
const { getAiConfig } = require('./modules/ai/config');
const demoRoutes = require('./routes/demo');
const ingestRoutes = require('./routes/ingest');
const usersRoutes = require('./routes/users');
const orgRoutes = require('./routes/org');
const aiRoutes = require('./routes/ai');
const aiDecisionsRoutes = require('./routes/aiDecisions');
const reviewsRoutes = require('./routes/reviews');
const dashboardRoutes = require('./routes/dashboard');
const v1Routes = require('./routes/v1/index');
const authRoutes = require('./routes/auth');
const PORT = process.env.PORT || 3002;
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => {
    const ai = getAiConfig();
    res.json({
        ok: true,
        mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        ai: { provider: ai.provider, ready: ai.ready, model: ai.model },
        version: '1.0.0',
    });
});
app.use('/api/v1', v1Routes);
app.use('/api/auth', authRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api', ingestRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-decisions', aiDecisionsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/dashboard', dashboardRoutes);
async function main() {
    await connectDb();
    app.listen(PORT, () => console.log(`Unitree API http://localhost:${PORT}`));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
