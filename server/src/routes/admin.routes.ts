import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Group } from '../models/Group';
import { GroupMember } from '../models/GroupMember';

const router = Router();

// Apply auth and admin middleware to all routes in this router
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all users
router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error });
  }
});

// Get pending approval users
router.get('/pending-users', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pendingUsers = await User.find({ status: 'PENDING' }).select('-passwordHash').sort({ createdAt: -1 });
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending users', error });
  }
});

// Approve user
router.post('/users/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.status = 'ACTIVE';
    user.approvedBy = req.user!._id as any;
    user.approvedAt = new Date();
    await user.save();

    res.json({ message: `User ${user.username} approved successfully!`, user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve user', error });
  }
});

// Block user
router.post('/users/:id/block', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.role === 'ADMIN' && req.user!._id.toString() === user._id.toString()) {
      res.status(400).json({ message: 'Cannot block yourself' });
      return;
    }

    user.status = 'BLOCKED';
    await user.save();

    res.json({ message: `User ${user.username} blocked`, user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to block user', error });
  }
});

// Unblock user
router.post('/users/:id/unblock', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = _req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.status = 'ACTIVE';
    await user.save();

    res.json({ message: `User ${user.username} unblocked`, user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unblock user', error });
  }
});

// Change user role
router.post('/users/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['ADMIN', 'USER'].includes(role)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.role = role;
    await user.save();

    res.json({ message: `User ${user.username} role updated to ${role}`, user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change role', error });
  }
});

// Get system stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, pendingUsers, totalGroups] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'PENDING' }),
      Group.countDocuments(),
    ]);

    res.json({
      totalUsers,
      pendingUsers,
      activeUsers: totalUsers - pendingUsers,
      totalGroups,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats', error });
  }
});

export default router;
