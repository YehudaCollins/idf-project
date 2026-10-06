const { Router } = require('express');
const { requireApiKey, getApiKeyHint } = require('../../middleware/apiKeyAuth');
const usersRouter = require('./users');
const sourceSystemsRouter = require('./sourceSystems');
const directoryRouter = require('./directory');
const router = Router();
router.use(requireApiKey);
router.get('/', (_req, res) => {
    res.json({
        ok: true,
        data: {
            version: '1',
            name: 'Unitree External API',
            auth: getApiKeyHint(),
            endpoints: {
                'POST /api/v1/users': 'Submit user login or raw SharePoint profile — parse path, match tree, save user',
                'GET /api/v1/users': 'Search users (?q=, ?limit=, ?sourceSystem=, ?sourceMatch=any|latest|registered|seen)',
                'GET /api/v1/users/:personalNumber': 'Get user profile (?history=false, ?decisions=false)',
                'GET /api/v1/source-systems': 'List source systems with user/event counts',
                'GET /api/v1/source-systems/:sourceSystem/users': 'List users by source system (?match=any|latest|registered|seen)',
                'GET /api/v1/source-systems/:sourceSystem/ingest-events': 'Audit ingest events by source system (?personalNumber=, ?from=, ?to=)',
                'GET /api/v1/directory/status': 'Check Active Directory integration configuration',
                'GET /api/v1/directory/users/:personalNumber': 'Lookup a personal number in Active Directory without ingest',
                'POST /api/v1/directory/users/:personalNumber/ingest': 'Lookup a personal number in Active Directory and ingest the mapped profile',
            },
            headers: {
                'X-API-Key': 'your-api-key',
                'X-Source-System': 'required for POST /api/v1/users (alternative to body.sourceSystem)',
                Authorization: 'Bearer your-api-key (alternative)',
            },
        },
    });
});
router.use('/users', usersRouter);
router.use('/source-systems', sourceSystemsRouter);
router.use('/directory', directoryRouter);

module.exports = router;
