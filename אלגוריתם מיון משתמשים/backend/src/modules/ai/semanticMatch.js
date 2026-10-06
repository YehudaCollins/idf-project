const { OrgUnit } = require('../../models/index');
const { getAiConfig } = require('./config');
const { semanticRerankAlpha } = require('./providers/alpha.provider');
const { semanticRerank } = require('./providers/openai.provider');
async function trySemanticMatch(rawSegment, parentId, candidates) {
    let parentPathText = 'שורש';
    if (parentId) {
        const parent = await OrgUnit.findById(parentId).lean();
        if (parent)
            parentPathText = parent.pathText;
    }
    const input = {
        rawSegment,
        parentPathText,
        candidates: candidates.slice(0, 5),
    };
    const cfg = getAiConfig();
    if (cfg.provider === 'alpha') {
        return semanticRerankAlpha(input);
    }
    return semanticRerank(input);
}

module.exports = { trySemanticMatch };
