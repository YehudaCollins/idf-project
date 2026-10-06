const { OrgChangeRequest } = require('../../models/index');
async function createReview(input) {
    return OrgChangeRequest.create({
        ...input,
        status: 'needs_review',
        createdAt: new Date(),
    });
}

module.exports = { createReview };
