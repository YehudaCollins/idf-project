const { Router } = require('express');
const { ingestLogin } = require('../modules/ingest/ingestLogin');
const { sourceSystemFromRequest } = require('../modules/ingest/sourceSystem');
const { mapSharePointProfileToIngest, sharePointProfileFromPayload } = require('../modules/ingest/sharePointProfile');
const { safeProfileImageUrl } = require('../modules/ingest/profileImage');
const router = Router();
router.post('/ingest-login', async (req, res) => {
    try {
        const sourceSystem = sourceSystemFromRequest(req);
        const sharePointProfile = sharePointProfileFromPayload(req.body);
        const mappedSharePoint = sharePointProfile
            ? mapSharePointProfileToIngest(sharePointProfile, {
                sourceSystem,
                source: optionalText(req.body?.source) || 'api',
            })
            : null;
        const { personalNumber, firstName, lastName, rawOrgPath, source, rank, role, email, phone, profileImageUrl, attributes, } = req.body;
        const bodyAttributes = attributes && typeof attributes === 'object' && !Array.isArray(attributes)
            ? attributes
            : undefined;
        const mergedAttributes = mappedSharePoint
            ? { ...(mappedSharePoint.attributes ?? {}), ...(bodyAttributes ?? {}) }
            : bodyAttributes;
        const personalNumberText = optionalText(mappedSharePoint?.personalNumber ?? personalNumber);
        const firstNameText = optionalText(mappedSharePoint?.firstName ?? firstName);
        const lastNameText = optionalText(mappedSharePoint?.lastName ?? lastName);
        const rawOrgPathText = optionalText(mappedSharePoint?.rawOrgPath ?? rawOrgPath);
        if (!personalNumberText || !firstNameText || !lastNameText || !rawOrgPathText) {
            res.status(400).json({ error: 'Missing required fields', missing: mappedSharePoint?.missing });
            return;
        }
        const result = await ingestLogin({
            personalNumber: personalNumberText,
            firstName: firstNameText,
            lastName: lastNameText,
            rawOrgPath: rawOrgPathText,
            source: optionalText(mappedSharePoint?.source ?? source) || 'api',
            rank: optionalText(mappedSharePoint?.rank ?? rank),
            role: optionalText(mappedSharePoint?.role ?? role),
            email: optionalText(mappedSharePoint?.email ?? email),
            phone: optionalText(mappedSharePoint?.phone ?? phone),
            profileImageUrl: safeProfileImageUrl(mappedSharePoint?.profileImageUrl ?? profileImageUrl),
            sourceSystem: mappedSharePoint?.sourceSystem ?? sourceSystem,
            attributes: mergedAttributes,
        });
        res.json(result);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: String(e) });
    }
});

function optionalText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

module.exports = router;
