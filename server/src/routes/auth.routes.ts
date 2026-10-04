import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { generateToken } from '../utils/token';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Register: sets user to PENDING approval
router.post('/register', async (req, res: Response): Promise<void> => {
  try {
    const { username, displayName, password } = req.body;
    if (!username || !displayName || !password) {
      res.status(400).json({ message: 'Username, display name, and password are required' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      res.status(409).json({ message: 'Username is already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: cleanUsername,
      displayName: displayName.trim(),
      passwordHash,
      role: 'USER',
      status: 'PENDING',
    });

    res.status(201).json({
      message: 'Registration successful! Your account is pending administrator approval before you can log in.',
      userId: user._id,
      status: user.status,
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error });
  }
});

// Login
router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }

    if (user.status === 'PENDING') {
      res.status(403).json({
        message: 'Your account is pending administrator approval. Please ask your administrator to approve your account.',
        status: 'PENDING',
      });
      return;
    }

    if (user.status === 'BLOCKED') {
      res.status(403).json({
        message: 'Your account has been blocked by an administrator.',
        status: 'BLOCKED',
      });
      return;
    }

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error });
  }
});

// Get current profile
router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  const user = req.user!;
  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
  });
});

export default router;
