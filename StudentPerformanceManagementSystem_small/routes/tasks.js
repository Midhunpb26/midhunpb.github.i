const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const storage = require('../storage');
const auth = require('../middleware/auth');

const router = express.Router();

function useMemory() {
  return !storage.connectedToMongo || mongoose.connection.readyState !== 1;
}

router.get('/', auth, async (req, res) => {
  try {
    const { q = '', priority = 'All', status = 'All' } = req.query;

    if (useMemory()) {
      let tasks = storage.tasks.filter((task) => task.owner === req.user.id);
      if (q) tasks = tasks.filter((task) => task.title.toLowerCase().includes(q.toLowerCase()));
      if (priority !== 'All') tasks = tasks.filter((task) => task.priority === priority);
      if (status === 'Completed') tasks = tasks.filter((task) => task.completed);
      if (status === 'Pending') tasks = tasks.filter((task) => !task.completed);
      return res.json({ tasks });
    }

    let query = Task.find({ owner: req.user._id });
    if (q) query = query.where('title').regex(new RegExp(q, 'i'));
    if (priority !== 'All') query = query.where('priority', priority);
    if (status === 'Completed') query = query.where('completed', true);
    if (status === 'Pending') query = query.where('completed', false);

    const tasks = await query.sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks.', error: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });

    if (useMemory()) {
      const task = {
        id: String(Date.now()),
        title,
        description: description || '',
        priority: priority || 'Medium',
        completed: false,
        dueDate: dueDate || '',
        owner: req.user.id,
        createdAt: new Date().toISOString()
      };
      storage.tasks.push(task);
      return res.status(201).json({ task });
    }

    const task = await Task.create({ title, description, priority, dueDate, owner: req.user._id });
    res.status(201).json({ task });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task.', error: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (useMemory()) {
      const task = storage.tasks.find((entry) => entry.id === req.params.id && entry.owner === req.user.id);
      if (!task) return res.status(404).json({ message: 'Task not found.' });
      Object.assign(task, req.body, { id: task.id, owner: task.owner });
      return res.json({ task });
    }

    const task = await Task.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, req.body, { new: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    res.json({ task });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task.', error: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (useMemory()) {
      const index = storage.tasks.findIndex((entry) => entry.id === req.params.id && entry.owner === req.user.id);
      if (index === -1) return res.status(404).json({ message: 'Task not found.' });
      storage.tasks.splice(index, 1);
      return res.json({ message: 'Task deleted.' });
    }

    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    res.json({ message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task.', error: error.message });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    if (useMemory()) {
      const tasks = storage.tasks.filter((task) => task.owner === req.user.id);
      const completed = tasks.filter((task) => task.completed).length;
      const pending = tasks.length - completed;
      return res.json({ totalTasks: tasks.length, completedTasks: completed, pendingTasks: pending, progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 });
    }

    const tasks = await Task.find({ owner: req.user._id });
    const completed = tasks.filter((task) => task.completed).length;
    const pending = tasks.length - completed;
    res.json({ totalTasks: tasks.length, completedTasks: completed, pendingTasks: pending, progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard.', error: error.message });
  }
});

module.exports = router;
