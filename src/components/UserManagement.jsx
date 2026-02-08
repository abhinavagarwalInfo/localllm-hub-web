import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, Eye, Code, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './UserManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'viewer',
    is_active: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiRequest('/api/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.username || !formData.password || !formData.role) {
      alert('Username, password, and role are required');
      return;
    }

    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    try {
      const response = await apiRequest('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        setShowAddUser(false);
        resetForm();
        alert('User created successfully');
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Create user error:', error);
      alert('Error creating user: ' + error.message);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.username || !formData.role) {
      alert('Username and role are required');
      return;
    }

    // If password is provided, validate it
    if (formData.password && formData.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    try {
      const response = await apiRequest(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        setEditingUser(null);
        resetForm();
        alert('User updated successfully');
      } else {
        alert(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Update user error:', error);
      alert('Error updating user: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiRequest(`/api/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        await fetchUsers();
        alert('User deleted successfully');
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Delete user error:', error);
      alert('Error deleting user: ' + error.message);
    }
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email || '',
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active === 1
    });
    setShowAddUser(false);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      email: '',
      full_name: '',
      role: 'viewer',
      is_active: true
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={16} className="role-icon admin" />;
      case 'developer': return <Code size={16} className="role-icon developer" />;
      case 'viewer': return <Eye size={16} className="role-icon viewer" />;
      default: return null;
    }
  };

  const getRoleBadge = (role) => {
    return <span className={`role-badge ${role}`}>{role}</span>;
  };

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading-state">
          <Loader2 size={48} className="spin" />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="um-header">
        <div>
          <h2>
            <Users size={24} />
            User Management
          </h2>
          <p>{users.length} total users</p>
        </div>
        <button 
          onClick={() => {
            setShowAddUser(true);
            setEditingUser(null);
            resetForm();
          }}
          className="add-user-btn"
        >
          <Plus size={20} />
          Add User
        </button>
      </div>

      {(showAddUser || editingUser) && (
        <div className="user-form-modal">
          <div className="modal-content">
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            
            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
              <div className="form-row">
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    disabled={!!editingUser}
                    placeholder="Enter username"
                  />
                </div>

                {!editingUser && (
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Min 6 characters"
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="viewer">Viewer - Chat only</option>
                    <option value="developer">Developer - Chat + Upload</option>
                    <option value="admin">Admin - Full access</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => {
                  setShowAddUser(false);
                  setEditingUser(null);
                  resetForm();
                }} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-info">
                    <strong>{user.username}</strong>
                    {user.full_name && <span className="full-name">{user.full_name}</span>}
                  </div>
                </td>
                <td>{user.email || '-'}</td>
                <td>
                  <div className="role-cell">
                    {getRoleIcon(user.role)}
                    {getRoleBadge(user.role)}
                  </div>
                </td>
                <td>
                  {user.is_active ? (
                    <span className="status active">
                      <CheckCircle size={14} />
                      Active
                    </span>
                  ) : (
                    <span className="status inactive">
                      <XCircle size={14} />
                      Inactive
                    </span>
                  )}
                </td>
                <td>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                <td>
                  <div className="actions">
                    <button
                      onClick={() => startEdit(user)}
                      className="action-btn edit"
                      title="Edit user"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      className="action-btn delete"
                      title="Delete user"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="role-legend">
        <h4>Role Permissions:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <Shield size={16} className="role-icon admin" />
            <strong>Admin:</strong> Full access - manage users, upload documents, chat
          </div>
          <div className="legend-item">
            <Code size={16} className="role-icon developer" />
            <strong>Developer:</strong> Upload documents and chat
          </div>
          <div className="legend-item">
            <Eye size={16} className="role-icon viewer" />
            <strong>Viewer:</strong> Chat only (read-only access)
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;