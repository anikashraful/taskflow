const API_URL = 'http://localhost:8000/api';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function getInitials(name) {
    return name ? name.split(' ').map(word => word[0]).join('').toUpperCase() : '';
}

function setUserProfile(user) {
    document.querySelectorAll('#profileInitials').forEach(el => {
        el.textContent = getInitials(user.fullName);
    });
    document.querySelectorAll('#profileName').forEach(el => {
        el.textContent = user.fullName || 'User';
    });
    document.querySelectorAll('#profileEmail').forEach(el => {
        el.textContent = user.email || '';
    });
    if (document.getElementById('profileLargeInitials')) {
        document.getElementById('profileLargeInitials').textContent = getInitials(user.fullName);
        document.getElementById('profileFullName').textContent = user.fullName || '';
        document.getElementById('profileEmailMain').textContent = user.email || '';
        document.getElementById('fullName').value = user.fullName || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('bio').value = user.bio || '';
    }
}

async function fetchUser() {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const response = await fetch(`${API_URL}/user`, {
            headers: { 'Authorization': token }
        });
        if (!response.ok) throw new Error('Failed to fetch user');
        const user = await response.json();
        setUserProfile(user);
        return user;
    } catch (error) {
        console.error('Error fetching user:', error);
        window.location.href = 'index.html';
        return null;
    }
}

async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`, {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return await response.json();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }
}

async function fetchTeam() {
    try {
        const response = await fetch(`${API_URL}/team`, {
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        if (!response.ok) throw new Error('Failed to fetch team');
        return await response.json();
    } catch (error) {
        console.error('Error fetching team:', error);
        return [];
    }
}

async function downloadTasks() {
    try {
        const tasks = await fetchTasks();
        const csvContent = [
            'ID,Name,Project,Due Date,Priority,Assignees,Status',
            ...tasks.map(task => 
                `${task.id},"${task.name.replace(/"/g, '""')}","${task.project.replace(/"/g, '""')}",${task.dueDate},${task.priority},"${task.assignees.join(';').replace(/"/g, '""')}",${task.status}`
            )
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading tasks:', error);
        alert('Failed to download tasks: Network error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': localStorage.getItem('token') }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete task');
        }
        const tasks = await fetchTasks();
        updateDashboard(tasks);
        updateCalendar();
        alert('Task deleted successfully');
    } catch (error) {
        console.error('Error deleting task:', error);
        alert(`Failed to delete task: ${error.message}`);
    }
}

async function editTask(taskId) {
    const tasks = await fetchTasks();
    const task = tasks.find(t => t.id == taskId);
    if (!task) {
        alert('Task not found');
        return;
    }
    const team = await fetchTeam();
    const editForm = document.getElementById('editTaskForm');
    const editTaskName = document.getElementById('editTaskName');
    const editProject = document.getElementById('editProject');
    const editDueDate = document.getElementById('editDueDate');
    const editPriority = document.getElementById('editPriority');
    const editAssignees = document.getElementById('editAssignees');
    
    editTaskName.value = task.name;
    editProject.value = task.project;
    editDueDate.value = task.dueDate.split('T')[0];
    editPriority.value = task.priority;
    editAssignees.innerHTML = team.length
        ? team.map(member => `<option value="${member.fullName}" ${task.assignees.includes(member.fullName) ? 'selected' : ''}>${member.fullName}</option>`).join('')
        : `<option value="" disabled>No assignees available</option>`;
    editForm.dataset.taskId = taskId;
    editForm.style.display = 'block';
}

async function submitEditTask() {
    const editForm = document.getElementById('editTaskForm');
    const taskId = editForm.dataset.taskId;
    const taskName = document.getElementById('editTaskName').value.trim();
    const project = document.getElementById('editProject').value.trim();
    const dueDate = document.getElementById('editDueDate').value;
    const priority = document.getElementById('editPriority').value;
    const assignees = Array.from(document.getElementById('editAssignees').selectedOptions).map(opt => opt.value);
    const status = 'In Progress'; // Default status for edited tasks
    if (!taskName || !project || !dueDate || !priority) {
        alert('Please fill in all required fields');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('token')
            },
            body: JSON.stringify({ name: taskName, project, dueDate, priority, assignees, status })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update task');
        }
        editForm.style.display = 'none';
        editForm.dataset.taskId = '';
        const tasks = await fetchTasks();
        updateDashboard(tasks);
        updateCalendar();
        alert('Task updated successfully');
    } catch (error) {
        console.error('Error updating task:', error);
        alert(`Failed to update task: ${error.message}`);
    }
}

function cancelEditTask() {
    const editForm = document.getElementById('editTaskForm');
    editForm.style.display = 'none';
    editForm.dataset.taskId = '';
}

function updateDashboard(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const overdue = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
    const highPriority = tasks.filter(t => t.priority === 'High').length;
    const mediumPriority = tasks.filter(t => t.priority === 'Medium').length;
    const lowPriority = tasks.filter(t => t.priority === 'Low').length;

    if (document.getElementById('totalTasks')) {
        document.getElementById('totalTasks').innerHTML = `${total} <span class="trend up">↑ ${total ? Math.round(total / 2) : 0}%</span>`;
        document.getElementById('completedTasks').innerHTML = `${completed} <span class="trend up">↑ ${completed ? Math.round(completed / 2) : 0}%</span>`;
        document.getElementById('inProgressTasks').innerHTML = `${inProgress} <span class="trend up">↑ ${inProgress ? Math.round(inProgress / 2) : 0}%</span>`;
        document.getElementById('overdueTasks').innerHTML = `${overdue} <span class="trend up">↑ ${overdue ? Math.round(overdue / 2) : 0}%</span>`;
        document.getElementById('progressBar').style.width = total ? `${(completed / total) * 100}%` : '0%';
        document.getElementById('completedCount').textContent = `${completed} (${total ? Math.round((completed / total) * 100) : 0}%)`;
        document.getElementById('inProgressCount').textContent = `${inProgress} (${total ? Math.round((inProgress / total) * 100) : 0}%)`;
        document.getElementById('overdueCount').textContent = `${overdue} (${total ? Math.round((overdue / total) * 100) : 0}%)`;
        document.getElementById('highPriorityCount').textContent = `${highPriority} (${total ? Math.round((highPriority / total) * 100) : 0}%)`;
        document.getElementById('mediumPriorityCount').textContent = `${mediumPriority} (${total ? Math.round((mediumPriority / total) * 100) : 0}%)`;
        document.getElementById('lowPriorityCount').textContent = `${lowPriority} (${total ? Math.round((lowPriority / total) * 100) : 0}%)`;
    }

    if (document.getElementById('profileTotalTasks')) {
        document.getElementById('profileTotalTasks').textContent = total;
        document.getElementById('profileCompletedTasks').textContent = completed;
        document.getElementById('profileInProgressTasks').textContent = inProgress;
    }

    const taskList = document.getElementById('taskList');
    if (taskList) {
        taskList.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];
        tasks.filter(t => t.dueDate.split('T')[0] === today).forEach(task => {
            const item = document.createElement('div');
            item.className = `task-item ${task.status === 'Completed' ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="task-details">
                    <p>${task.name}</p>
                    <span>${task.project} • Due ${new Date(task.dueDate).toLocaleString()}</span>
                </div>
                <div class="priority ${task.priority.toLowerCase()}">${task.priority}</div>
                <div class="assignees">${task.assignees.map(a => `<span class="assignee">${getInitials(a)}</span>`).join('')}</div>
            `;
            taskList.appendChild(item);
        });
    }

    const taskTableBody = document.getElementById('taskTableBody');
    if (taskTableBody) {
        taskTableBody.innerHTML = '';
        tasks.forEach(task => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${task.name}</td>
                <td>${task.project}</td>
                <td>${new Date(task.dueDate).toLocaleString()}</td>
                <td><span class="priority ${task.priority.toLowerCase()}">${task.priority}</span></td>
                <td>${task.assignees.map(a => `<span class="assignee">${getInitials(a)}</span>`).join('')}</td>
                <td><select onchange="updateTaskStatus(${task.id}, this.value)">
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select></td>
                <td>
                    <button class="save-btn" onclick="editTask(${task.id})">Edit</button>
                    <button class="logout-btn" onclick="deleteTask(${task.id})">Delete</button>
                </td>
            `;
            taskTableBody.appendChild(row);
        });
    }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    // fetch current task
    const tasks = await fetchTasks();
    const task = tasks.find(t => t.id === Number(taskId));
    if (!task) throw new Error('Task not found');

    // build full payload
    const payload = {
      name: task.name,
      project: task.project,
      dueDate: task.dueDate,
      priority: task.priority,
      assignees: task.assignees,
      status: newStatus
    };

    const res = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('token')
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Update failed');
    }

    // refresh views
    const updatedTasks = await fetchTasks();
    updateDashboard(updatedTasks);
    if (window.location.pathname.includes('calendar')) updateCalendar();
  } catch (e) {
    console.error(e);
    alert(`❌ ${e.message}`);
  }
}

async function populateAssignees() {
    const team = await fetchTeam();
    const assigneesSelect = document.getElementById('assignees');
    if (assigneesSelect) {
        assigneesSelect.innerHTML = team.length
            ? team.map(member => `<option value="${member.fullName}">${member.fullName}</option>`).join('')
            : `<option value="" disabled>No assignees available</option>`;
    }
    const editAssigneesSelect = document.getElementById('editAssignees');
    if (editAssigneesSelect) {
        editAssigneesSelect.innerHTML = team.length
            ? team.map(member => `<option value="${member.fullName}">${member.fullName}</option>`).join('')
            : `<option value="" disabled>No assignees available</option>`;
    }
}

async function updateCalendar() {
    const tasks = await fetchTasks();
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthDisplay = document.getElementById('currentMonth');
    if (calendarGrid && currentMonthDisplay) {
        const date = new Date(currentYear, currentMonth, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        currentMonthDisplay.textContent = `${monthName} ${currentYear}`;
        calendarGrid.innerHTML = `
            <div class="calendar-day">Sun</div>
            <div class="calendar-day">Mon</div>
            <div class="calendar-day">Tue</div>
            <div class="calendar-day">Wed</div>
            <div class="calendar-day">Thu</div>
            <div class="calendar-day">Fri</div>
            <div class="calendar-day">Sat</div>
        `;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = date.getDay();
        for (let i = 0; i < firstDay; i++) {
            calendarGrid.innerHTML += `<div class="calendar-date"></div>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.dueDate.split('T')[0] === dateStr);
            const hasTasks = dayTasks.length > 0;
            const tooltip = hasTasks
                ? `<span class="tooltip">${dayTasks.map(t => t.name).join(', ')}</span>`
                : '';
            calendarGrid.innerHTML += `
                <div class="calendar-date ${hasTasks ? 'has-tasks' : ''}">
                    ${day}
                    ${tooltip}
                </div>`;
        }
    }
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear -= 1;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear += 1;
    }
    updateCalendar();
}

async function updateTeam() {
    const team = await fetchTeam();
    const teamList = document.getElementById('teamList');
    if (teamList) {
        teamList.innerHTML = team.map(member => `
            <div class="team-member">
                <div class="member-initials">${getInitials(member.fullName)}</div>
                <div class="member-info">
                    <h3>${member.fullName}</h3>
                    <p>${member.email}</p>
                </div>
            </div>
        `).join('');
    }
}

async function handleSearch() {
  const searchInput = document.getElementById('search');
  if (!searchInput) return;

  // handle BOTH typing and pressing Enter
  const doSearch = async () => {
    const q = searchInput.value.trim().toLowerCase();
    const tasks = await fetchTasks();
    const filtered = tasks.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.project.toLowerCase().includes(q)
    );
    updateDashboard(filtered);
  };

  searchInput.addEventListener('input', doSearch);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();          // stop page reload
      doSearch();
    }
  });
}

function setGreeting() {
    const greeting = document.getElementById('greeting');
    if (greeting) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const hour = new Date().getHours();
        const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        greeting.textContent = `Good ${timeOfDay}, ${user.fullName || 'User'}!`;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (token && window.location.pathname !== '/index.html' && window.location.pathname !== '/signup.html') {
        await fetchUser();
        const tasks = await fetchTasks();
        await updateDashboard(tasks);
        await populateAssignees();
        await updateTeam();
        handleSearch();
        setGreeting();
        if (window.location.pathname.includes('calendar.html')) {
            await updateCalendar();
        }
    }

    const signinForm = document.getElementById('signinForm');
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            if (!email || !password) {
                alert('Please enter both email and password');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/signin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                if (response.ok) {
                    const { token, user } = await response.json();
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(user));
                    window.location.href = 'dashboard.html';
                } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Invalid credentials');
                }
            } catch (error) {
                console.error('Error signing in:', error);
                alert('Sign-in failed: Network error');
            }
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            if (!fullName || !email || !password) {
                alert('Please fill in all fields');
                return;
            }
            if (password.length < 8) {
                alert('Password must be at least 8 characters');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, password })
                });
                if (response.ok) {
                    alert('Sign-up successful! Please sign in.');
                    window.location.href = 'index.html';
                } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Signup failed');
                }
            } catch (error) {
                console.error('Error signing up:', error);
                alert('Signup failed: Network error');
            }
        });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const bio = document.getElementById('bio').value.trim();
            if (!fullName || !email) {
                alert('Full Name and Email are required');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/user`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('token')
                    },
                    body: JSON.stringify({ fullName, email, bio })
                });
                if (response.ok) {
                    const user = await response.json();
                    localStorage.setItem('user', JSON.stringify(user));
                    setUserProfile(user);
                    alert('Profile updated successfully');
                } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Failed to update profile');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Profile update failed: Network error');
            }
        });
    }

    const addTaskForm = document.getElementById('addTaskForm');
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskName = document.getElementById('taskName').value.trim();
            const project = document.getElementById('project').value.trim();
            const dueDate = document.getElementById('dueDate').value;
            const priority = document.getElementById('priority').value;
            const assignees = Array.from(document.getElementById('assignees').selectedOptions).map(opt => opt.value);
            if (!taskName || !project || !dueDate || !priority) {
                alert('Please fill in all required fields');
                return;
            }
            if (assignees.length === 0 && document.getElementById('assignees').options.length <= 1) {
                alert('No assignees available. Please add team members first.');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('token')
                    },
                    body: JSON.stringify({
                        name: taskName,
                        project,
                        dueDate,
                        priority,
                        assignees,
                        status: 'In Progress'
                    })
                });
                if (response.ok) {
                    alert('Task added successfully');
                    window.location.href = 'dashboard.html';
                } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Failed to add task');
                }
            } catch (error) {
                console.error('Error adding task:', error);
                alert('Failed to add task: Network error');
            }
        });
    }

    const addTeamForm = document.getElementById('addTeamForm');
    if (addTeamForm) {
        addTeamForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('teamName').value.trim();
            const email = document.getElementById('teamEmail').value.trim();
            if (!fullName || !email) {
                alert('Please enter both name and email');
                return;
            }
            if (!email.includes('@') || !email.includes('.')) {
                alert('Please enter a valid email address');
                return;
            }
            try {
                const response = await fetch(`${API_URL}/team`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('token')
                    },
                    body: JSON.stringify({ fullName, email })
                });
                if (response.ok) {
                    await updateTeam();
                    addTeamForm.reset();
                    alert('Team member added successfully');
                } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Failed to add team member');
                }
            } catch (error) {
                console.error('Error adding team member:', error);
                alert('Failed to add team member: Network error');
            }
        });
    }
});