const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const storage = require('../storage');

const router = express.Router();

function createToken(user) {
  return jwt.sign({ id: user._id || user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
}

function useMemory() {
  return !storage.connectedToMongo || mongoose.connection.readyState !== 1;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }

    if (useMemory()) {
      const existing = storage.users.find((user) => user.email === email.toLowerCase());
      if (existing) return res.status(400).json({ message: 'User already exists.' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = { id: String(Date.now()), name, email: email.toLowerCase(), password: hashedPassword, theme: 'dark' };
      storage.users.push(user);
      return res.status(201).json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, theme: user.theme } });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashedPassword });
    res.status(201).json({ token: createToken(user), user: { id: user._id, name: user.name, email: user.email, theme: user.theme } });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    if (useMemory()) {
      const user = storage.users.find((entry) => entry.email === email.toLowerCase());
      if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
      return res.json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, theme: user.theme } });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
    res.json({ token: createToken(user), user: { id: user._id, name: user.name, email: user.email, theme: user.theme } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    if (useMemory()) {
      const user = storage.users.find((entry) => entry.id === decoded.id);
      return user ? res.json({ user: { id: user.id, name: user.name, email: user.email, theme: user.theme } }) : res.status(404).json({ message: 'User not found.' });
    }

    const user = await User.findById(decoded.id).select('-password');
    return user ? res.json({ user }) : res.status(404).json({ message: 'User not found.' });
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
