// Business layer: admin authentication (JWT).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepo = require('../repositories/userRepository');
const activityRepo = require('../repositories/activityLogRepository');
const { AppError } = require('../utils/errors');

module.exports = {
  login(username, password) {
    const user = userRepo.findByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new AppError('Invalid username or password.', 401);
    }
    const token = jwt.sign({ sub: user.id, username: user.username, role: user.role },
      env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    activityRepo.log({ userId: user.id, action: 'login', entityType: 'auth' });
    return { token, user: { id: user.id, username: user.username, phone: user.phone, role: user.role } };
  },
  changePassword(userId, currentPassword, newPassword) {
    const user = userRepo.findByUsername(userRepo.findById(userId).username);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) throw new AppError('Current password is incorrect.', 401);
    if (!newPassword || newPassword.length < 8) throw new AppError('New password must be at least 8 characters.');
    userRepo.updatePassword(userId, bcrypt.hashSync(newPassword, 10));
    activityRepo.log({ userId, action: 'update', entityType: 'user', entityId: userId, details: { field: 'password' } });
  },
};
