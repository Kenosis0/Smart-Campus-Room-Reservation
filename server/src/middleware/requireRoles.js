const AppError = require('../utils/appError');

function requireRoles(allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.roleCode)) {
      return next(new AppError(403, 'You do not have permission for this action.'));
    }

    return next();
  };
}

module.exports = requireRoles;
