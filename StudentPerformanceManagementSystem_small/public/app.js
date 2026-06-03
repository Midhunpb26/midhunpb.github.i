const api = {
  base: '/api',
  token: localStorage.getItem('taskflow_token'),
  async request(path, options = {}) {
    const res = await fetch(`${this.base}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token ? `Bearer ${this.token}` : '',
        ...(options.headers || {})
      },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }
};

const state = { view: 'dashboard', editingTaskId: null, theme: localStorage.getItem('taskflow_theme') || 'dark' };

function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}View`));
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
  state.view = name;
}

function showAuth(show) {
  document.getElementById('authView').classList.toggle('active', show);
  document.getElementById('dashboardView').classList.toggle('hidden', show);
  document.getElementById('tasksView').classList.toggle('hidden', show);
  document.getElementById('profileView').classList.toggle('hidden', show);
}

async function loadDashboard() {
  try {
    const data = await api.request('/tasks/dashboard');
    document.getElementById('totalTasks').textContent = data.totalTasks;
    document.getElementById('completedTasks').textContent = data.completedTasks;
    document.getElementById('pendingTasks').textContent = data.pendingTasks;
    document.getElementById('progressPercent').textContent = `${data.progress}%`;
    document.getElementById('progressBar').style.width = `${data.progress}%`;
    document.getElementById('dashboardSummary').textContent = `You have ${data.completedTasks} completed and ${data.pendingTasks} pending tasks.`;
    document.getElementById('todayStatus').textContent = `${data.progress}% of your goals are on track today.`;
  } catch (error) {
    console.error(error);
  }
}

async function loadTasks() {
  try {
    const data = await api.request(`/tasks?q=${encodeURIComponent(document.getElementById('searchInput').value)}&priority=${document.getElementById('priorityFilter').value}&status=${document.getElementById('statusFilter').value}`);
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    if (!data.tasks.length) {
      list.innerHTML = '<article class="glass-card">No tasks found. Create one to get started.</article>';
      return;
    }

    data.tasks.forEach((task) => {
      const card = document.createElement('article');
      card.className = 'task-card';
      card.innerHTML = `
        <div class="task-top">
          <strong>${task.title}</strong>
          <span class="badge">${task.priority}</span>
        </div>
        <p class="muted">${task.description || 'No description provided.'}</p>
        <div class="task-meta">Due: ${task.dueDate || 'No due date'} · ${task.completed ? 'Completed' : 'Pending'}</div>
        <div class="actions">
          <button class="ghost-btn" data-action="toggle" data-id="${task.id || task._id}">${task.completed ? 'Undo' : 'Complete'}</button>
          <button class="ghost-btn" data-action="edit" data-id="${task.id || task._id}">Edit</button>
          <button class="ghost-btn danger" data-action="delete" data-id="${task.id || task._id}">Delete</button>
        </div>`;
      list.appendChild(card);
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadProfile() {
  try {
    const data = await api.request('/auth/me');
    document.getElementById('profileInfo').innerHTML = `
      <div><strong>Name:</strong> ${data.user.name}</div>
      <div><strong>Email:</strong> ${data.user.email}</div>
      <div><strong>Theme:</strong> ${data.user.theme || 'dark'}</div>
    `;
  } catch (error) {
    console.error(error);
  }
}

async function ensureSession() {
  if (!api.token) {
    showAuth(true);
    showView('dashboard');
    return;
  }

  try {
    await api.request('/auth/me');
    showAuth(false);
    showView('dashboard');
    await loadDashboard();
    await loadTasks();
    await loadProfile();
  } catch (error) {
    localStorage.removeItem('taskflow_token');
    api.token = null;
    showAuth(true);
  }
}

async function login(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const data = await api.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('taskflow_token', data.token);
  localStorage.setItem('taskflow_theme', data.user.theme || 'dark');
  api.token = data.token;
  state.theme = data.user.theme || 'dark';
  applyTheme(state.theme);
  await ensureSession();
}

async function register(e) {
  e.preventDefault();
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const data = await api.request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  localStorage.setItem('taskflow_token', data.token);
  localStorage.setItem('taskflow_theme', data.user.theme || 'dark');
  api.token = data.token;
  state.theme = data.user.theme || 'dark';
  applyTheme(state.theme);
  await ensureSession();
}

function toggleModal(show) {
  document.getElementById('taskModal').classList.toggle('hidden', !show);
}

async function saveTask(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDescription').value,
    priority: document.getElementById('taskPriority').value,
    dueDate: document.getElementById('taskDueDate').value
  };

  try {
    if (state.editingTaskId) {
      await api.request(`/tasks/${state.editingTaskId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api.request('/tasks', { method: 'POST', body: JSON.stringify(payload) });
    }
    toggleModal(false);
    state.editingTaskId = null;
    document.getElementById('taskForm').reset();
    await loadDashboard();
    await loadTasks();
  } catch (error) {
    alert(error.message);
  }
}

async function openEditTask(id) {
  const allTasks = (await api.request('/tasks?q=&priority=All&status=All')).tasks;
  const task = allTasks.find((item) => (item.id || item._id) === id);
  if (!task) return;
  document.getElementById('modalTitle').textContent = 'Edit Task';
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskDueDate').value = task.dueDate || '';
  state.editingTaskId = id;
  toggleModal(true);
}

async function handleTaskAction(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  try {
    if (action === 'toggle') {
      const allTasks = (await api.request('/tasks?q=&priority=All&status=All')).tasks;
      const task = allTasks.find((item) => (item.id || item._id) === id);
      await api.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ completed: !task.completed }) });
    } else if (action === 'delete') {
      await api.request(`/tasks/${id}`, { method: 'DELETE' });
    } else if (action === 'edit') {
      await openEditTask(id);
    }
    await loadDashboard();
    await loadTasks();
  } catch (error) {
    alert(error.message);
  }
}

async function logout() {
  localStorage.removeItem('taskflow_token');
  api.token = null;
  await api.request('/auth/logout', { method: 'POST' }).catch(() => {});
  showAuth(true);
}

applyTheme(state.theme);

document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => {
  showView(btn.dataset.view);
  if (btn.dataset.view === 'tasks') loadTasks();
  if (btn.dataset.view === 'profile') loadProfile();
}));

document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach((item) => item.classList.toggle('active', item === btn));
  document.getElementById('loginForm').classList.toggle('hidden', btn.dataset.auth !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', btn.dataset.auth !== 'register');
}));

document.getElementById('loginForm').addEventListener('submit', login);
document.getElementById('registerForm').addEventListener('submit', register);
document.getElementById('newTaskBtn').addEventListener('click', () => { state.editingTaskId = null; document.getElementById('modalTitle').textContent = 'Create Task'; document.getElementById('taskForm').reset(); toggleModal(true); });
document.getElementById('closeModalBtn').addEventListener('click', () => toggleModal(false));
document.getElementById('taskForm').addEventListener('submit', saveTask);
document.getElementById('taskList').addEventListener('click', handleTaskAction);
document.getElementById('refreshTasksBtn').addEventListener('click', loadTasks);
document.getElementById('searchInput').addEventListener('input', loadTasks);
document.getElementById('priorityFilter').addEventListener('change', loadTasks);
document.getElementById('statusFilter').addEventListener('change', loadTasks);
document.getElementById('themeToggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('taskflow_theme', state.theme);
  applyTheme(state.theme);
});
document.getElementById('logoutBtn').addEventListener('click', logout);

ensureSession();
