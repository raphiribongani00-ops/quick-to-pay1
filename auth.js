const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function authMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).send('Unauthorized: No token');
    }
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).send('Unauthorized: Invalid token');
    }
    if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
      return res.status(403).send('Forbidden: Insufficient role');
    }
    req.user = payload;
    next();
  };
}

module.exports = { generateToken, verifyToken, authMiddleware };