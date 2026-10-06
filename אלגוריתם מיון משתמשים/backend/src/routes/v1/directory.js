const { Router } = require('express');
const { activeDirectoryStatus, lookupDirectoryUserByPersonalNumber, } = require('../../modules/directory/activeDirectory');
const { ingestLogin } = require('../../modules/ingest/ingestLogin');
const { formatIngestResponse } = require('../../services/userApiResponse');
const { safeProfileImageUrl } = require('../../modules/ingest/profileImage');
const router = Router();
function optionalText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function mappedPreview(result) {
    const mapped = result.mapped;
    if (!mapped)
        return undefined;
    return {
        personalNumber: mapped.personalNumber,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        rawOrgPath: mapped.rawOrgPath,
        source: mapped.source,
        rank: mapped.rank,
        role: mapped.role,
        email: mapped.email,
        phone: mapped.phone,
        profileImageUrl: mapped.profileImageUrl,
        sourceSystem: mapped.sourceSystem,
        missing: mapped.missing,
    };
}
function sanitizeRawUser(rawUser) {
    if (!rawUser)
        return undefined;
    const sanitized = {};
    for (const [key, value] of Object.entries(rawUser)) {
        if (Buffer.isBuffer(value)) {
            sanitized[key] = `[binary ${value.length} bytes]`;
        }
        else if (Array.isArray(value)) {
            sanitized[key] = value.map((item) => Buffer.isBuffer(item) ? `[binary ${item.length} bytes]` : item);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
function lookupResponse(result, includeRaw = false) {
    return {
        found: result.found,
        personalNumber: result.personalNumber,
        sourceSystem: result.sourceSystem,
        strategy: result.strategy,
        sharePointProfile: result.sharePointProfile,
        mapped: mappedPreview(result),
        rawUser: includeRaw ? sanitizeRawUser(result.rawUser) : undefined,
    };
}
/** GET /api/v1/directory/status — סטטוס חיבור Active Directory */
router.get('/status', (_req, res) => {
    const status = activeDirectoryStatus();
    res.status(status.configured ? 200 : 503).json({
        ok: status.configured,
        data: status,
    });
});
/** GET /api/v1/directory/users/:personalNumber — בדיקת מספר אישי מול AD בלי ingest */
router.get('/users/:personalNumber', async (req, res) => {
    try {
        const result = await lookupDirectoryUserByPersonalNumber(req.params.personalNumber);
        if (!result.found) {
            res.status(404).json({ ok: false, error: 'Directory user not found', data: lookupResponse(result) });
            return;
        }
        res.json({
            ok: true,
            data: lookupResponse(result, req.query.raw === 'true'),
        });
    }
    catch (e) {
        const status = activeDirectoryStatus();
        res.status(status.configured ? 500 : 503).json({ ok: false, error: String(e), status });
    }
});
/** POST /api/v1/directory/users/:personalNumber/ingest — משיכה מ-AD והכנסה לעץ */
router.post('/users/:personalNumber/ingest', async (req, res) => {
    try {
        const result = await lookupDirectoryUserByPersonalNumber(req.params.personalNumber);
        if (!result.found || !result.mapped) {
            res.status(404).json({ ok: false, error: 'Directory user not found', data: lookupResponse(result) });
            return;
        }
        const mapped = result.mapped;
        const personalNumber = optionalText(mapped.personalNumber);
        const firstName = optionalText(mapped.firstName);
        const lastName = optionalText(mapped.lastName);
        const rawOrgPath = optionalText(req.body?.rawOrgPath) ?? optionalText(mapped.rawOrgPath);
        const sourceSystem = optionalText(req.body?.sourceSystem) ?? optionalText(mapped.sourceSystem);
        const source = optionalText(req.body?.source) ?? optionalText(mapped.source) ?? 'active-directory';
        const missing = [
            !personalNumber ? 'personalNumber' : '',
            !firstName ? 'firstName' : '',
            !lastName ? 'lastName' : '',
            !rawOrgPath ? 'rawOrgPath' : '',
            !sourceSystem ? 'sourceSystem' : '',
        ].filter(Boolean);
        if (missing.length) {
            res.status(422).json({
                ok: false,
                error: 'Directory user found but required ingest fields are missing',
                missing,
                data: lookupResponse(result),
            });
            return;
        }
        const personalNumberValue = personalNumber;
        const firstNameValue = firstName;
        const lastNameValue = lastName;
        const rawOrgPathValue = rawOrgPath;
        const sourceSystemValue = sourceSystem;
        const ingest = await ingestLogin({
            personalNumber: personalNumberValue,
            firstName: firstNameValue,
            lastName: lastNameValue,
            rawOrgPath: rawOrgPathValue,
            source,
            rank: optionalText(mapped.rank),
            role: optionalText(mapped.role),
            email: optionalText(mapped.email),
            phone: optionalText(mapped.phone),
            profileImageUrl: safeProfileImageUrl(mapped.profileImageUrl),
            sourceSystem: sourceSystemValue,
            attributes: mapped.attributes,
        });
        res.status(ingest.user.created ? 201 : 200).json({
            ok: true,
            data: {
                directory: lookupResponse(result),
                ingest: formatIngestResponse(ingest),
            },
        });
    }
    catch (e) {
        const status = activeDirectoryStatus();
        res.status(status.configured ? 500 : 503).json({ ok: false, error: String(e), status });
    }
});

module.exports = router;
