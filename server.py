import http.server
import socketserver
import sqlite3
import json
import urllib.parse
import hashlib
import time

PORT = 8000

def init_db():
    with sqlite3.connect('taskflow.db') as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            bio TEXT
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            project TEXT NOT NULL,
            due_date TEXT NOT NULL,
            priority TEXT NOT NULL,
            assignees TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS team (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE
        )''')
        conn.commit()
        team = [
            ('John Doe', 'john.doe@example.com'),
            ('Alice Smith', 'alice.smith@example.com'),
            ('Tom Kelly', 'tom.kelly@example.com')
        ]
        for member in team:
            conn.execute('INSERT OR IGNORE INTO team (full_name, email) VALUES (?, ?)', member)
        conn.commit()

init_db()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_token(token):
    try:
        if not token:
            return None
        user_id, timestamp = token.split(':')
        if int(timestamp) + 3600 * 24 * 30 < int(time.time()):
            return None
        return int(user_id)
    except:
        return None

class MyHandler(http.server.BaseHTTPRequestHandler):
    def send_json_response(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == '/api/user':
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute('SELECT id, full_name, email, bio FROM users WHERE id = ?', (user_id,))
                    user = cursor.fetchone()
                    if user:
                        self.send_json_response(200, {
                            'id': user[0],
                            'fullName': user[1],
                            'email': user[2],
                            'bio': user[3]
                        })
                    else:
                        self.send_json_response(404, {'error': 'User not found'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path == '/api/tasks':
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute('SELECT id, name, project, due_date, priority, assignees, status FROM tasks WHERE user_id = ?', (user_id,))
                    tasks = [{
                        'id': row[0],
                        'name': row[1],
                        'project': row[2],
                        'dueDate': row[3],
                        'priority': row[4],
                        'assignees': json.loads(row[5]),
                        'status': row[6]
                    } for row in cursor]
                    self.send_json_response(200, tasks)
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path == '/api/team':
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute('SELECT id, full_name, email FROM team')
                    team = [{'id': row[0], 'fullName': row[1], 'email': row[2]} for row in cursor]
                    self.send_json_response(200, team)
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path in ['/', '/index.html', '/signup.html', '/dashboard.html', '/add_task.html', '/task.html', '/calendar.html', '/team.html', '/profile.html']:
            try:
                with open(self.path.lstrip('/') or 'index.html', 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_error(404, 'File Not Found')

        elif self.path == '/styles.css':
            try:
                with open('styles.css', 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/css')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_error(404, 'File Not Found')

        elif self.path == '/script.js':
            try:
                with open('script.js', 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/javascript')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_error(404, 'File Not Found')

        else:
            self.send_error(404, 'Not Found')

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode()
        try:
            data = json.loads(post_data)
        except json.JSONDecodeError:
            self.send_json_response(400, {'error': 'Invalid JSON'})
            return

        if self.path == '/api/signin':
            email = data.get('email')
            password = data.get('password')
            if not email or not password:
                self.send_json_response(400, {'error': 'Email and password are required'})
                return
            password_hash = hash_password(password)
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute('SELECT id, full_name, email FROM users WHERE email = ? AND password_hash = ?', (email, password_hash))
                    user = cursor.fetchone()
                    if user:
                        token = f"{user[0]}:{int(time.time())}"
                        self.send_json_response(200, {
                            'token': token,
                            'user': {'id': user[0], 'fullName': user[1], 'email': user[2]}
                        })
                    else:
                        self.send_json_response(401, {'error': 'Invalid credentials'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path == '/api/signup':
            full_name = data.get('fullName')
            email = data.get('email')
            password = data.get('password')
            if not full_name or not email or not password:
                self.send_json_response(400, {'error': 'Full name, email, and password are required'})
                return
            password_hash = hash_password(password)
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    conn.execute('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)', (full_name, email, password_hash))
                    conn.commit()
                    self.send_json_response(201, {'message': 'User created'})
            except sqlite3.IntegrityError:
                self.send_json_response(400, {'error': 'Email already exists'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path == '/api/tasks':
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            name = data.get('name')
            project = data.get('project')
            due_date = data.get('dueDate')
            priority = data.get('priority')
            assignees = json.dumps(data.get('assignees', []))
            status = data.get('status', 'In Progress')
            if not name or not project or not due_date or not priority:
                self.send_json_response(400, {'error': 'Name, project, due date, and priority are required'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute(
                        'INSERT INTO tasks (user_id, name, project, due_date, priority, assignees, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        (user_id, name, project, due_date, priority, assignees, status)
                    )
                    conn.commit()
                    self.send_json_response(201, {'id': cursor.lastrowid, 'message': 'Task created'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path == '/api/team':
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            full_name = data.get('fullName')
            email = data.get('email')
            if not full_name or not email:
                self.send_json_response(400, {'error': 'Full name and email are required'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute(
                        'INSERT INTO team (full_name, email) VALUES (?, ?)',
                        (full_name, email)
                    )
                    conn.commit()
                    self.send_json_response(201, {'id': cursor.lastrowid, 'message': 'Team member added'})
            except sqlite3.IntegrityError:
                self.send_json_response(400, {'error': 'Email already exists'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        else:
            self.send_error(404, 'Not Found')

    def do_PUT(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode()
        try:
            data = json.loads(post_data)
        except json.JSONDecodeError:
            self.send_json_response(400, {'error': 'Invalid JSON'})
            return

        if self.path == '/api/user':
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            full_name = data.get('fullName')
            email = data.get('email')
            bio = data.get('bio', '')
            if not full_name or not email:
                self.send_json_response(400, {'error': 'Full name and email are required'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute(
                        'UPDATE users SET full_name = ?, email = ?, bio = ? WHERE id = ?',
                        (full_name, email, bio, user_id)
                    )
                    conn.commit()
                    if cursor.rowcount == 0:
                        self.send_json_response(404, {'error': 'User not found'})
                    else:
                        self.send_json_response(200, {
                            'id': user_id,
                            'fullName': full_name,
                            'email': email,
                            'bio': bio
                        })
            except sqlite3.IntegrityError:
                self.send_json_response(400, {'error': 'Email already exists'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        elif self.path.startswith('/api/tasks/'):
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            task_id = self.path.split('/')[-1]
            name = data.get('name')
            project = data.get('project')
            due_date = data.get('dueDate')
            priority = data.get('priority')
            assignees = json.dumps(data.get('assignees', []))
            status = data.get('status')
            if not name or not project or not due_date or not priority or not status:
                self.send_json_response(400, {'error': 'All task fields are required'})
                return
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute(
                        'UPDATE tasks SET name = ?, project = ?, due_date = ?, priority = ?, assignees = ?, status = ? WHERE id = ? AND user_id = ?',
                        (name, project, due_date, priority, assignees, status, task_id, user_id)
                    )
                    conn.commit()
                    if cursor.rowcount == 0:
                        self.send_json_response(404, {'error': 'Task not found or unauthorized'})
                    else:
                        self.send_json_response(200, {'message': 'Task updated'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})

        else:
            self.send_error(404, 'Not Found')

    def do_DELETE(self):
        if self.path.startswith('/api/tasks/'):
            token = self.headers.get('Authorization')
            user_id = verify_token(token)
            if not user_id:
                self.send_json_response(401, {'error': 'Unauthorized'})
                return
            task_id = self.path.split('/')[-1]
            try:
                with sqlite3.connect('taskflow.db') as conn:
                    cursor = conn.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
                    conn.commit()
                    if cursor.rowcount == 0:
                        self.send_json_response(404, {'error': 'Task not found or unauthorized'})
                    else:
                        self.send_json_response(200, {'message': 'Task deleted'})
            except sqlite3.Error as e:
                self.send_json_response(500, {'error': f'Database error: {str(e)}'})
        else:
            self.send_error(404, 'Not Found')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

Handler = MyHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()