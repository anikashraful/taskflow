# TaskFlow

A task management web application built with HTML, CSS, JavaScript, and Python (SQLite backend).

## Features
- **User Authentication**: Sign-in and signup with email and password.
- **Task Management**: Create, edit, delete, and track tasks with priorities, due dates, and assignees.
- **Team Management**: Add team members to assign tasks.
- **Calendar View**: Visualize task due dates on a monthly calendar.
- **Task Stats**: View total, completed, and in-progress tasks with CSV export.

## Setup
1. Clone the repository: `git clone https://github.com/anikashraful/taskflow.git`
2. Run the backend server: `python server.py` (starts on port 8000).
3. Open `http://localhost:8000` in a browser or access `index.html` directly.

## Technologies
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Python, SQLite

## File Structure
- `index.html`, `signup.html`: Authentication pages
- `dashboard.html`, `task.html`, `add_task.html`: Task management pages
- `calendar.html`: Calendar view
- `team.html`: Team management
- `profile.html`: User profile and stats
- `styles.css`: Styling
- `script.js`: Frontend logic
- `server.py`: Backend API with SQLite

## Notes
- Requires Python 3.x and SQLite for the backend.
- Ensure port 8000 is free before running the server.
