const jwt = require('jsonwebtoken');
const User = require('../models/User');
const storage = require('../storage');

module.exports = async function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    if (storage.connectedToMongo) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ message: 'Invalid token.' });
      req.user = user;
    } else {
      const user = storage.users.find((entry) => entry.id === decoded.id);
      if (!user) return res.status(401).json({ message: 'Invalid token.' });
      req.user = user;
    }

    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};
