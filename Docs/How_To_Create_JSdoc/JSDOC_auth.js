/**
 * @fileoverview Authentication and Authorization Middleware
 * @module server/middleware/auth
 * @requires ../database
 * 
 * Provides middleware functions for:
 * - User authentication via session cookies
 * - Role-based access control (RBAC)
 * - Activity logging
 * - Session management
 * 
 * Role Hierarchy:
 * - admin: Full system access
 * - developer: Document upload, chat, full features
 * - viewer: Read-only access to shared documents
 * 
 * @author Your Team
 * @version 2.0.0
 */

import { userQueries, sessionQueries, activityQueries } from '../database.js';

/**
 * Role hierarchy definition for access control
 * Higher index = higher privileges
 * @constant {Array<string>}
 */
const ROLE_HIERARCHY = ['viewer', 'developer', 'admin'];

/**
 * Authentication middleware - Validates user session
 * 
 * Checks for valid session cookie and attaches user object to request.
 * Returns 401 Unauthorized if session is invalid or expired.
 * 
 * @async
 * @function requireAuth
 * @param {Object} req - Express request object
 * @param {Object} req.cookies - Session cookies
 * @param {string} req.cookies.session_id - Session ID from cookie
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @returns {void}
 * 
 * @throws {401} If no session cookie or session not found
 * @throws {401} If session expired
 * @throws {401} If user not found or inactive
 * 
 * @example
 * // Protect route with authentication
 * app.get('/api/documents', requireAuth, (req, res) => {
 *   console.log('Authenticated user:', req.user);
 *   res.json({ documents: [] });
 * });
 * 
 * @example
 * // Access user info in protected route
 * app.post('/api/upload', requireAuth, (req, res) => {
 *   const userId = req.user.id;
 *   const userRole = req.user.role;
 *   // Process upload...
 * });
 */
export const requireAuth = async (req, res, next) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find session in database
    const session = sessionQueries.findById.get(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      sessionQueries.deleteById.run(sessionId);
      return res.status(401).json({ error: 'Session expired' });
    }

    // Get user details
    const user = userQueries.findById.get(session.user_id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Attach user to request object (without password)
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Role-based authorization middleware - Requires exact role match
 * 
 * Checks if authenticated user has the specified role.
 * Must be used after requireAuth middleware.
 * 
 * @function requireRole
 * @param {string} role - Required role (admin|developer|viewer)
 * 
 * @returns {Function} Express middleware function
 * 
 * @throws {403} If user doesn't have required role
 * 
 * @example
 * // Admin-only route
 * app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
 *   // Only admins can access
 * });
 * 
 * @example
 * // Developer-only route
 * app.post('/api/documents/upload', 
 *   requireAuth, 
 *   requireRole('developer'), 
 *   (req, res) => {
 *     // Only developers and admins can upload
 *   }
 * );
 */
export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: role,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Minimum role authorization middleware - Requires role or higher
 * 
 * Checks if authenticated user has the specified role or higher privileges.
 * Uses role hierarchy: viewer < developer < admin
 * Must be used after requireAuth middleware.
 * 
 * @function requireMinRole
 * @param {string} minRole - Minimum required role
 * 
 * @returns {Function} Express middleware function
 * 
 * @throws {403} If user role is below minimum required
 * 
 * @example
 * // Requires developer or admin
 * app.post('/api/documents/upload', 
 *   requireAuth, 
 *   requireMinRole('developer'), 
 *   (req, res) => {
 *     // Accessible to developers and admins
 *   }
 * );
 * 
 * @example
 * // Requires any authenticated user (viewer+)
 * app.get('/api/documents', 
 *   requireAuth, 
 *   requireMinRole('viewer'), 
 *   (req, res) => {
 *     // All authenticated users can access
 *   }
 * );
 */
export const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

    if (userRoleIndex < minRoleIndex) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: minRole,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Activity logging middleware - Logs user actions
 * 
 * Records user activity to database for audit trail.
 * Logs action type, details, and IP address.
 * Must be used after requireAuth middleware.
 * 
 * @function logActivity
 * @param {string} action - Action name (e.g., 'LOGIN', 'UPLOAD', 'DELETE')
 * 
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Log document upload
 * app.post('/api/documents/upload', 
 *   requireAuth, 
 *   logActivity('DOCUMENT_UPLOAD'), 
 *   (req, res) => {
 *     // Upload handler
 *   }
 * );
 * 
 * @example
 * // Log with custom details
 * app.delete('/api/documents/:id', 
 *   requireAuth, 
 *   logActivity('DOCUMENT_DELETE'), 
 *   (req, res) => {
 *     const docId = req.params.id;
 *     // Will log: DOCUMENT_DELETE with document ID
 *   }
 * );
 */
export const logActivity = (action) => {
  return (req, res, next) => {
    try {
      if (req.user) {
        const details = JSON.stringify({
          path: req.path,
          method: req.method,
          params: req.params,
          body: sanitizeBody(req.body)
        });

        activityQueries.log.run(
          req.user.id,
          action,
          details,
          req.ip || req.connection.remoteAddress
        );
      }
    } catch (error) {
      console.error('Activity logging error:', error);
      // Continue even if logging fails
    }
    next();
  };
};

/**
 * Sanitize request body for logging
 * Removes sensitive fields like passwords
 * 
 * @private
 * @function sanitizeBody
 * @param {Object} body - Request body
 * 
 * @returns {Object} Sanitized body without sensitive data
 * 
 * @example
 * const body = { username: 'admin', password: 'secret123' };
 * const safe = sanitizeBody(body);
 * // { username: 'admin', password: '[REDACTED]' }
 */
const sanitizeBody = (body) => {
  if (!body) return {};
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'api_key'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

/**
 * Permission check helper - Verify if user can access resource
 * 
 * Checks if user owns a resource or has admin privileges.
 * Used for resource-level access control.
 * 
 * @function canAccess
 * @param {Object} user - User object from req.user
 * @param {number} resourceUserId - ID of resource owner
 * 
 * @returns {boolean} True if user can access resource
 * 
 * @example
 * app.delete('/api/documents/:id', requireAuth, (req, res) => {
 *   const doc = getDocument(req.params.id);
 *   
 *   if (!canAccess(req.user, doc.user_id)) {
 *     return res.status(403).json({ error: 'Access denied' });
 *   }
 *   
 *   // Delete document
 * });
 */
export const canAccess = (user, resourceUserId) => {
  return user.role === 'admin' || user.id === resourceUserId;
};

/**
 * Permission check helper - Verify if user can modify resource
 * 
 * Stricter than canAccess - only owner or admin can modify.
 * 
 * @function canModify
 * @param {Object} user - User object from req.user
 * @param {number} resourceUserId - ID of resource owner
 * 
 * @returns {boolean} True if user can modify resource
 * 
 * @example
 * app.put('/api/documents/:id', requireAuth, (req, res) => {
 *   const doc = getDocument(req.params.id);
 *   
 *   if (!canModify(req.user, doc.user_id)) {
 *     return res.status(403).json({ error: 'Cannot modify' });
 *   }
 *   
 *   // Update document
 * });
 */
export const canModify = (user, resourceUserId) => {
  return user.role === 'admin' || user.id === resourceUserId;
};

/**
 * Session cleanup helper - Remove expired sessions
 * 
 * Should be called periodically (e.g., via cron job or on server start).
 * Removes all sessions past their expiration date.
 * 
 * @async
 * @function cleanupExpiredSessions
 * 
 * @returns {Object} Result with count of deleted sessions
 * 
 * @example
 * // Run on server startup
 * cleanupExpiredSessions();
 * 
 * @example
 * // Run every hour
 * setInterval(() => {
 *   cleanupExpiredSessions();
 * }, 60 * 60 * 1000);
 */
export const cleanupExpiredSessions = async () => {
  try {
    const result = sessionQueries.deleteExpired.run();
    console.log(`🧹 Cleaned up ${result.changes} expired sessions`);
    return { deletedCount: result.changes };
  } catch (error) {
    console.error('Session cleanup error:', error);
    return { error: error.message };
  }
};

/**
 * @typedef {Object} UserObject
 * @property {number} id - User ID
 * @property {string} username - Username
 * @property {string|null} email - Email address
 * @property {string|null} full_name - Full name
 * @property {string} role - User role (admin|developer|viewer)
 */

/**
 * @typedef {Object} SessionObject
 * @property {string} id - Session ID (UUID)
 * @property {number} user_id - User ID
 * @property {string} expires_at - Expiration timestamp
 * @property {string} created_at - Creation timestamp
 */
