const mongoose = require('mongoose');
const { OrgChangeRequest, OrgUnit, User } = require('../../models/index');
const { createReview } = require('../reviews/createReview');
const { detectUnitCommander } = require('./commanderDetection');
function toObjectId(value) {
    return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}
function snapshotFromCommander(candidate) {
    return {
        personalNumber: candidate.personalNumber,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        fullName: candidate.fullName,
        rank: candidate.rank,
        role: candidate.role,
        profileImageUrl: candidate.profileImageUrl,
        confidence: candidate.confidence,
        reason: candidate.reason,
    };
}
function snapshotFromUser(user) {
    return {
        personalNumber: user.personalNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        rank: user.rank,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
    };
}
async function directUsersForUnit(unitId) {
    return User.find({ currentOrgUnitId: toObjectId(unitId) })
        .select('personalNumber firstName lastName fullName rank role profileImageUrl currentOrgUnitId')
        .lean();
}
async function commanderStateForUnit(unitId) {
    const users = await directUsersForUnit(unitId);
    return {
        commander: detectUnitCommander(users),
        directUserCount: users.length,
    };
}
async function detectCommanderForUnit(unitId) {
    const state = await commanderStateForUnit(unitId);
    return state.commander;
}
async function maybeCreateCommanderChangeReview(unitId, proposedBy, previousDynamicCommander, previousDirectUserCount = 0) {
    const unit = await OrgUnit.findById(unitId);
    if (!unit)
        return { created: false, autoApproved: false };
    const proposedCommander = await detectCommanderForUnit(unit._id);
    if (!proposedCommander)
        return { created: false, autoApproved: false };
    const approvedCommanderNumber = unit.commanderPersonalNumber;
    const previousCommanderNumber = approvedCommanderNumber || previousDynamicCommander?.personalNumber;
    if (!previousCommanderNumber && previousDirectUserCount === 0) {
        unit.commanderPersonalNumber = proposedCommander.personalNumber;
        unit.commanderStatus = 'auto';
        unit.pendingCommanderPersonalNumber = undefined;
        await unit.save();
        return { created: false, autoApproved: true };
    }
    if (previousCommanderNumber === proposedCommander.personalNumber) {
        if (!unit.commanderPersonalNumber) {
            unit.commanderPersonalNumber = proposedCommander.personalNumber;
            unit.commanderStatus = 'auto';
        }
        if (unit.pendingCommanderPersonalNumber === proposedCommander.personalNumber) {
            unit.pendingCommanderPersonalNumber = undefined;
        }
        await unit.save();
        return { created: false, autoApproved: true };
    }
    const previousCommanderUser = approvedCommanderNumber
        ? await User.findOne({ personalNumber: approvedCommanderNumber })
            .select('personalNumber firstName lastName fullName rank role profileImageUrl')
            .lean()
        : null;
    const previousCommander = previousCommanderUser
        ? snapshotFromUser(previousCommanderUser)
        : previousDynamicCommander
            ? snapshotFromCommander(previousDynamicCommander)
            : undefined;
    const proposedSnapshot = snapshotFromCommander(proposedCommander);
    const openReview = await OrgChangeRequest.findOne({
        changeType: 'commander_change',
        targetUnitId: unit._id,
        status: 'needs_review',
    });
    const reason = previousCommander
        ? `זוהה מפקד חדש ל"${unit.canonicalName}": ${previousCommander.fullName} → ${proposedCommander.fullName}`
        : `זוהה מפקד חדש ל"${unit.canonicalName}": ${proposedCommander.fullName}`;
    if (openReview) {
        openReview.rawValue = proposedCommander.personalNumber;
        openReview.proposedBy = proposedBy;
        openReview.reason = reason;
        openReview.confidence = proposedCommander.confidence;
        openReview.commanderChange = {
            unitId: String(unit._id),
            unitName: unit.canonicalName,
            previousCommander,
            proposedCommander: proposedSnapshot,
        };
        await openReview.save();
        unit.pendingCommanderPersonalNumber = proposedCommander.personalNumber;
        unit.commanderStatus = 'pending_review';
        await unit.save();
        return { reviewId: String(openReview._id), created: false, autoApproved: false };
    }
    const review = await createReview({
        changeType: 'commander_change',
        targetUnitId: unit._id,
        targetCanonicalName: unit.canonicalName,
        proposedBy,
        rawValue: proposedCommander.personalNumber,
        reason,
        confidence: proposedCommander.confidence,
        commanderChange: {
            unitId: String(unit._id),
            unitName: unit.canonicalName,
            previousCommander,
            proposedCommander: proposedSnapshot,
        },
    });
    unit.pendingCommanderPersonalNumber = proposedCommander.personalNumber;
    unit.commanderStatus = 'pending_review';
    await unit.save();
    return { reviewId: String(review._id), created: true, autoApproved: false };
}
async function approveCommanderChange(unitId, commanderPersonalNumber) {
    const unit = await OrgUnit.findById(unitId);
    if (!unit)
        throw new Error('יחידת היעד לא נמצאה');
    unit.commanderPersonalNumber = commanderPersonalNumber;
    unit.pendingCommanderPersonalNumber = undefined;
    unit.commanderStatus = 'approved';
    unit.commanderReviewedAt = new Date();
    await unit.save();
    return unit;
}
async function rejectCommanderChange(unitId, commanderPersonalNumber) {
    const unit = await OrgUnit.findById(unitId);
    if (!unit)
        return null;
    if (!commanderPersonalNumber || unit.pendingCommanderPersonalNumber === commanderPersonalNumber) {
        unit.pendingCommanderPersonalNumber = undefined;
        unit.commanderStatus = unit.commanderPersonalNumber ? 'approved' : 'auto';
        await unit.save();
    }
    return unit;
}

module.exports = { commanderStateForUnit, detectCommanderForUnit, maybeCreateCommanderChangeReview, approveCommanderChange, rejectCommanderChange };
