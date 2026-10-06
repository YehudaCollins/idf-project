const OpenAI = require('openai');
const { getAiConfig } = require('../config');
let client = null;
function getOpenAiClient() {
    const cfg = getAiConfig();
    if (!cfg.ready || cfg.provider === 'mock')
        return null;
    if (!client) {
        if (cfg.provider === 'azure-openai') {
            const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
            const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || cfg.model;
            client = new OpenAI({
                apiKey: process.env.AZURE_OPENAI_API_KEY,
                baseURL: `${endpoint}/openai/deployments/${deployment}`,
                defaultQuery: { 'api-version': '2024-08-01-preview' },
                defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
            });
        }
        else {
            client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
    }
    return client;
}
async function pingOpenAi() {
    const openai = getOpenAiClient();
    const cfg = getAiConfig();
    if (!openai || cfg.provider === 'mock')
        return false;
    try {
        const model = cfg.provider === 'azure-openai'
            ? process.env.AZURE_OPENAI_DEPLOYMENT || cfg.model
            : cfg.model;
        await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: 'reply ok' }],
            max_tokens: 3,
        });
        return true;
    }
    catch (err) {
        console.error('[OpenAI ping]', err);
        return false;
    }
}

module.exports = { getOpenAiClient, pingOpenAi };
