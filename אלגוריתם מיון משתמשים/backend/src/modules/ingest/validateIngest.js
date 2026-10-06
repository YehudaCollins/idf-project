const { normalizeSourceSystem } = require('./sourceSystem');
const { safeProfileImageUrl } = require('./profileImage');
function validateIngestInput(input) {
    const errors = [];
    if (!input.personalNumber?.trim())
        errors.push('מספר אישי חסר');
    if (!input.firstName?.trim())
        errors.push('שם פרטי חסר');
    if (!input.lastName?.trim())
        errors.push('שם משפחה חסר');
    if (!input.rawOrgPath?.trim())
        errors.push('נתיב ארגוני חסר');
    if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
        errors.push('פורמט אימייל לא תקין');
    }
    return errors;
}
function sanitizeIngestInput(input) {
    return {
        personalNumber: input.personalNumber.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        rawOrgPath: input.rawOrgPath.trim(),
        source: input.source?.trim(),
        rank: input.rank?.trim(),
        role: input.role?.trim(),
        email: input.email?.trim(),
        phone: input.phone?.trim(),
        profileImageUrl: safeProfileImageUrl(input.profileImageUrl),
        sourceSystem: normalizeSourceSystem(input.sourceSystem),
        accessRole: input.accessRole === 'admin' ? 'admin' : input.accessRole === 'regular' ? 'regular' : undefined,
        attributes: input.attributes,
    };
}

module.exports = { validateIngestInput, sanitizeIngestInput };
