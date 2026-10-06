const { User } = require('../../models/index');
const { ingestLogin } = require('./ingestLogin');
/** מריץ ingest מחדש לפי הנתיב הגולמי האחרון של המשתמש */
async function reingestUser(personalNumber, rawOrgPath) {
    const user = await User.findOne({ personalNumber });
    if (!user)
        throw new Error('User not found');
    const path = rawOrgPath?.trim() || user.rawPaths[user.rawPaths.length - 1];
    if (!path)
        throw new Error('No raw path available for re-ingest');
    return ingestLogin({
        personalNumber: user.personalNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        rawOrgPath: path,
        source: 'reingest',
        rank: user.rank,
        role: user.role,
        email: user.email,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        sourceSystem: user.sourceSystem,
        attributes: user.attributes,
    });
}

module.exports = { reingestUser };
