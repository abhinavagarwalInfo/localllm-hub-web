# Authentication & User Management Setup Guide

Complete guide for the multi-user authentication system with role-based access control.

## 🎯 Features Added

✅ **User Authentication** - Username/password login
✅ **Role-Based Access Control** - Admin, Developer, Viewer roles  
✅ **User Management** - Admin can create/edit/delete users
✅ **Activity Logging** - Track all user actions
✅ **Session Management** - Secure session handling
✅ **SQLite Database** - Persistent user storage

## 📊 User Roles & Permissions

| Feature | Admin | Developer | Viewer |
|---------|-------|-----------|--------|
| **Chat** | ✅ | ✅ | ✅ |
| **Upload Documents** | ✅ | ✅ | ❌ |
| **Manage Documents** | ✅ | ✅ | ❌ |
| **View Settings** | ✅ | ✅ | ✅ |
| **Manage Users** | ✅ | ❌ | ❌ |
| **View Activity Log** | ✅ | ❌ | ❌ |
| **Change Model** | ✅ | ✅ | ✅ |

## 🚀 Quick Setup

### 1. Install New Dependencies

```bash
npm install bcryptjs better-sqlite3 express-session cookie-parser express-rate-limit helmet react-router-dom
```

### 2. Add New Files

Create these files from the artifacts:

**Backend:**
- `server/database.js` - Database setup and queries
- `server/middleware/auth.js` - Authentication middleware

**Frontend:**
- `src/components/Login.jsx` - Login page
- `src/components/Login.css` - Login styles
- `src/components/UserManagement.jsx` - User management interface
- `src/components/UserManagement.css` - User management styles

**Replace:**
- `server/index.js` - Updated with authentication routes
- `package.json` - Updated with new dependencies
- `src/App.jsx` - Updated with authentication handling
- `src/App.css` - Updated with user interface styles

### 3. Create Data Directory

```bash
mkdir data
```

The SQLite database will be created automatically at `data/localllm.db`

### 4. Start the Application

```bash
npm run dev
```

## 🔐 Default Login

On first run, a default admin account is created:

```
Username: admin
Password: admin123
```

**⚠️ CHANGE THIS PASSWORD IMMEDIATELY!**

## 👤 User Management

### Creating Users (Admin Only)

1. Login as admin
2. Click **Users** tab
3. Click **Add User** button
4. Fill in details:
   - Username (required, unique)
   - Password (required, min 6 chars)
   - Full Name (optional)
   - Email (optional)
   - Role (required)
   - Active status

5. Click **Create User**

### Editing Users

1. Go to **Users** tab
2. Click edit icon (pencil) on user row
3. Update details (cannot change username)
4. Click **Update User**

### Deleting Users

1. Go to **Users** tab
2. Click delete icon (trash) on user row
3. Confirm deletion

**Note:** Cannot delete your own account

### Changing Password

1. Click on your profile
2. Select "Change Password"
3. Enter current and new password
4. Submit

## 🔒 Security Features

### Password Security
- Passwords hashed with bcrypt (10 rounds)
- Minimum 6 characters
- Never stored in plain text

### Session Management
- 24-hour session expiration
- HTTP-only cookies
- Automatic cleanup of expired sessions

### Rate Limiting
- Login: 5 attempts per 15 minutes
- API: 100 requests per 15 minutes

### Activity Logging
- All user actions logged
- IP address tracking
- Timestamp for each action
- Admins can view full activity log

## 📁 Database Schema

```sql
users
├── id (PRIMARY KEY)
├── username (UNIQUE)
├── password (bcrypt hash)
├── email
├── full_name
├── role (admin/developer/viewer)
├── is_active (1/0)
├── created_at
└── last_login

sessions
├── id (UUID)
├── user_id (FOREIGN KEY)
├── expires_at
└── created_at

documents
├── id (PRIMARY KEY)
├── user_id (FOREIGN KEY)
├── filename
├── file_type
├── file_size
├── metadata (JSON)
├── chunks_count
├── is_public (1/0)
└── created_at

activity_log
├── id (PRIMARY KEY)
├── user_id (FOREIGN KEY)
├── action
├── details
├── ip_address
└── created_at
```

## 🎨 UI Changes

### Login Screen
- Modern, centered login form
- Error message display
- Responsive design

### Sidebar Updates
- User avatar with role indicator
- Full name display
- Role badge (color-coded)
- Logout button

### Navigation
- Dynamic tabs based on role
- Viewers see: Chat, Settings
- Developers see: Chat, Documents, Settings
- Admins see: Chat, Documents, Settings, Users

## 🔐 API Endpoints

### Authentication

```bash
# Login
POST /api/auth/login
Body: { username, password }
Response: { user: { id, username, email, full_name, role } }

# Logout
POST /api/auth/logout
Response: { message }

# Get current user
GET /api/auth/me
Response: { user }

# Change password
POST /api/auth/change-password
Body: { currentPassword, newPassword }
Response: { message }
```

### User Management (Admin Only)

```bash
# Get all users
GET /api/users
Response: { users: [...] }

# Create user
POST /api/users
Body: { username, password, email, full_name, role }
Response: { message, userId }

# Update user
PUT /api/users/:id
Body: { email, full_name, role, is_active }
Response: { message }

# Delete user
DELETE /api/users/:id
Response: { message }

# Get activity log
GET /api/activity?limit=100
Response: { activities: [...] }
```

### Documents (Role-Based)

```bash
# Upload (Developer/Admin only)
POST /api/upload
Requires: developer or admin role

# Get documents (All users)
GET /api/documents
Returns: User's documents + public documents
```

## 🧪 Testing Scenarios

### Test 1: Admin Access

```bash
# Login as admin
Username: admin
Password: admin123

# Should see:
✅ Chat tab
✅ Documents tab
✅ Settings tab
✅ Users tab
✅ Can upload documents
✅ Can create users
```

### Test 2: Developer Access

```bash
# Create developer user
Role: developer

# Should see:
✅ Chat tab
✅ Documents tab
✅ Settings tab
❌ Users tab (hidden)
✅ Can upload documents
❌ Cannot create users
```

### Test 3: Viewer Access

```bash
# Create viewer user
Role: viewer

# Should see:
✅ Chat tab
❌ Documents tab (hidden)
✅ Settings tab
❌ Users tab (hidden)
❌ Cannot upload documents
✅ Can chat with existing documents
```

## 🔧 Environment Variables

Update `.env`:

```bash
# Existing
PORT=3001
NODE_ENV=development
OLLAMA_URL=http://localhost:11434

# New (optional)
SESSION_SECRET=your-random-secret-here
FRONTEND_URL=http://localhost:5173
```

## 📊 Activity Logging

Actions logged:
- `LOGIN` - User logged in
- `LOGOUT` - User logged out
- `PASSWORD_CHANGED` - User changed password
- `USER_CREATED` - Admin created new user
- `USER_UPDATED` - Admin updated user
- `USER_DELETED` - Admin deleted user
- `DOCUMENT_UPLOAD` - User uploaded document
- `OLLAMA_REQUEST` - User made AI request
- `UNAUTHORIZED_ACCESS_ATTEMPT` - User tried to access restricted area

View logs (Admin only):
1. Go to **Users** tab
2. Scroll to bottom
3. View recent activity

## 🐛 Troubleshooting

### Cannot login

**Check:**
```bash
# Verify database exists
ls -la data/
# Should show: localllm.db

# Check default user
sqlite3 data/localllm.db "SELECT * FROM users WHERE username='admin';"
```

**Reset admin password:**
```bash
# Stop server
# Delete database
rm data/localllm.db

# Restart server (will recreate with default admin)
npm run dev
```

### "Not authenticated" errors

**Solutions:**
- Clear browser cookies
- Check server logs for session errors
- Verify cookie settings in server/index.js

### Users can't upload documents

**Check role:**
- User must be Developer or Admin
- Viewers cannot upload

### Database locked error

**Solutions:**
- Only one process can access SQLite at a time
- Stop all instances of the server
- Check for zombie processes: `ps aux | grep node`

## 🔄 Migration from Non-Auth Version

If upgrading from the previous version:

1. **Backup your data** (if any)
2. Install new dependencies
3. Add new files
4. Update existing files
5. Restart server
6. Login with default admin
7. Create user accounts for team members
8. Users will need to re-upload documents (not preserved)

## 🚀 Production Deployment

### Additional Security

1. **Change SESSION_SECRET:**
```bash
# Generate random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
SESSION_SECRET=<generated-secret>
```

2. **Enable HTTPS:**
- Sessions use `secure` flag in production
- Requires SSL certificate

3. **Database Backups:**
```bash
# Backup database
cp data/localllm.db data/localllm.backup.db

# Automated backup (cron)
0 2 * * * cp /path/to/data/localllm.db /path/to/backups/localllm-$(date +\%Y\%m\%d).db
```

4. **Password Policy:**
- Enforce stronger passwords (edit server/index.js)
- Add password expiration
- Require password change on first login

## 📈 Scaling Considerations

### Multi-Server Setup

- Use Redis for session storage (replace express-session)
- Use PostgreSQL instead of SQLite
- Implement JWT tokens for stateless auth

### Performance

- Database is fast for < 1000 users
- Activity log grows over time (consider archiving)
- Index created on common queries

## ✅ Success Checklist

- [ ] Dependencies installed
- [ ] New files created
- [ ] Server starts without errors
- [ ] Can login with admin/admin123
- [ ] Changed default password
- [ ] Created test users (developer, viewer)
- [ ] Verified role permissions work
- [ ] Upload restricted to developer/admin
- [ ] Viewers can only chat
- [ ] Activity logging works
- [ ] Sessions persist across page refreshes
- [ ] Logout works correctly

---

**Your LocalLLM Hub now has enterprise-grade authentication!** 🎉🔐

All user data is stored securely with role-based access control.