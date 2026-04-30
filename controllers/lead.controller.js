const leadSvc = require('../services/lead.service');
const R       = require('../utils/responseFormatter');

exports.getLeads = async (req, res, next) => {
  try {
    const leads = await leadSvc.getLeads(req.user.uid, req.query);
    return R.success(res, leads);
  } catch (err) { next(err); }
};

exports.getLead = async (req, res, next) => {
  try {
    const lead = await leadSvc.getLead(req.params.id);
    if (!lead) return R.notFound(res, 'Lead not found.');
    if (lead.ownerId !== req.user.uid) return R.forbidden(res);
    return R.success(res, lead);
  } catch (err) { next(err); }
};

exports.updateLead = async (req, res, next) => {
  try {
    const updates = await leadSvc.updateLead(req.params.id, req.user.uid, req.body);
    return R.success(res, updates, 'Lead updated.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.deleteLead = async (req, res, next) => {
  try {
    await leadSvc.deleteLead(req.params.id, req.user.uid);
    return R.success(res, {}, 'Lead deleted.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.exportLeads = async (req, res, next) => {
  try {
    const csv = await leadSvc.exportLeadsCSV(req.user.uid);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
};
