const jwt = require('jsonwebtoken');
const { queryOne, sql } = require('../config/db');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  // Single-session enforcement: verify the token's jti matches the active
  // session stored in the DB. If another login has occurred, jti won't match
  // and this session is invalidated (HTTP 401 → frontend redirects to login).
  try {
    const user = await queryOne(
      'SELECT SessionToken FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: decoded.id } }
    );

    if (!user || user.SessionToken !== decoded.jti) {
      return res.status(401).json({ message: 'Session invalidated. Please sign in again.' });
    }
  } catch (err) {
    console.error('Session check error:', err.message);
    return res.status(500).json({ message: 'Server error during session validation' });
  }

  req.user = decoded;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };
