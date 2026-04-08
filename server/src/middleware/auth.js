const { pool } = require('../db/pool');
const AppError = require('../utils/appError');

async function attachRequestUser(req, _res, next) {
  const headerValue = req.header('x-user-id');

  if (!headerValue) {
    req.user = null;
    return next();
  }

  const userId = Number(headerValue);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError(401, 'Invalid x-user-id header.'));
  }

  const [rows] = await pool.execute(
    `SELECT
      u.id,
      u.full_name,
      u.email,
      u.department_id,
      r.code AS role_code,
      r.name AS role_name
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    return next(new AppError(401, 'User from x-user-id header does not exist.'));
  }

  req.user = {
    id: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    departmentId: rows[0].department_id,
    roleCode: rows[0].role_code,
    roleName: rows[0].role_name
  };

  return next();
}

function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required. Provide x-user-id header.'));
  }

  return next();
}

module.exports = {
  attachRequestUser,
  requireAuth
};
