import { sessionQueries, userQueries, activityQueries } from '../database.js';

// Check if user is authenticated
export const requireAuth = (req, res, next) => {
  const sessionId = req.cookies.session_id;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const session = sessionQueries.findById.get(sessionId);
  
  if (!session) {
    res.clearCookie('session_id');
    return res.status(401).json({ error: 'Session expired' });
  }
  
  const user = userQueries.findById.get(session.user_id);
  
  if (!user || !user.is_active) {
    sessionQueries.deleteById.run(sessionId);
    res.clearCookie('session_id');
    return res.status(401).json({ error: 'User not active' });
  }
  
  // Attach user to request
  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role
  };
  
  next();
};

// Check if user has required role
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized attempt
      activityQueries.log.run(
        req.user.id,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        `Attempted to access ${req.path} without sufficient permissions`,
        req.ip
      );
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Role hierarchy
const roleHierarchy = {
  admin: 3,
  developer: 2,
  viewer: 1
};

// Check if user has minimum role level
export const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const minRoleLevel = roleHierarchy[minRole] || 0;
    
    if (userRoleLevel < minRoleLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_min: minRole,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Log activity
export const logActivity = (action) => {
  return (req, res, next) => {
    if (req.user) {
      activityQueries.log.run(
        req.user.id,
        action,
        JSON.stringify({ path: req.path, method: req.method }),
        req.ip
      );
    }
    next();
  };
};