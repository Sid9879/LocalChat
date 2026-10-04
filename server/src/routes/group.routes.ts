import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Group } from '../models/Group';
import { GroupMember } from '../models/GroupMember';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = Router();
router.use(authMiddleware);

// Create a new private group
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name || name.trim().length < 2) {
      res.status(400).json({ message: 'Group name is required' });
      return;
    }

    const currentUserId = req.user!._id as mongoose.Types.ObjectId;

    // Create group
    const group = await Group.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: currentUserId,
      isPrivate: true,
    });

    // Add creator as OWNER
    await GroupMember.create({
      groupId: group._id,
      userId: currentUserId,
      role: 'OWNER',
    });

    // Create associated Conversation
    const conversation = await Conversation.create({
      type: 'GROUP',
      groupId: group._id,
      participants: [currentUserId],
      lastMessageAt: new Date(),
    });

    res.status(201).json({
      group,
      conversationId: conversation._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create group', error });
  }
});

// Get user's groups
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!._id;
    const memberships = await GroupMember.find({ userId: currentUserId }).populate('groupId');
    const groups = memberships
      .filter((m) => m.groupId)
      .map((m) => {
        const groupObj: any = (m.groupId as any).toObject();
        return {
          ...groupObj,
          myRole: m.role,
        };
      });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch groups', error });
  }
});

// Get group details and members (only for members)
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!._id;

    // Check membership
    const membership = await GroupMember.findOne({ groupId: id, userId: currentUserId });
    if (!membership && req.user!.role !== 'ADMIN') {
      res.status(403).json({ message: 'Access denied: You are not a member of this group' });
      return;
    }

    const group = await Group.findById(id).populate('createdBy', 'username displayName');
    if (!group) {
      res.status(404).json({ message: 'Group not found' });
      return;
    }

    const members = await GroupMember.find({ groupId: id }).populate('userId', 'username displayName role status avatarUrl');

    res.json({
      group,
      members,
      myRole: membership ? membership.role : 'ADMIN_VIEW',
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group', error });
  }
});

// Add member to group (Group Owner/Admin or System Admin only)
router.post('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;
    const currentUserId = req.user!._id;

    // Check caller permission
    const myMembership = await GroupMember.findOne({ groupId: id, userId: currentUserId });
    const isGroupAdmin = myMembership && ['OWNER', 'ADMIN'].includes(myMembership.role);
    const isSystemAdmin = req.user!.role === 'ADMIN';

    if (!isGroupAdmin && !isSystemAdmin) {
      res.status(403).json({ message: 'Only group admins or system admins can add members' });
      return;
    }

    // Verify user exists and is ACTIVE
    const targetUser = await User.findById(userId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      res.status(400).json({ message: 'Target user is not active or does not exist' });
      return;
    }

    // Check if already member
    const existing = await GroupMember.findOne({ groupId: id, userId });
    if (existing) {
      res.status(409).json({ message: 'User is already a member of this group' });
      return;
    }

    const newMember = await GroupMember.create({
      groupId: id,
      userId,
      role: role && ['ADMIN', 'MEMBER'].includes(role) ? role : 'MEMBER',
    });

    // Update Conversation participants
    await Conversation.findOneAndUpdate(
      { groupId: id },
      { $addToSet: { participants: userId } }
    );

    res.status(201).json({ message: 'User added to group successfully', member: newMember });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add member', error });
  }
});

// Remove member from group
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const currentUserId = req.user!._id;

    // Self leaving or Admin removing
    const isSelf = currentUserId.toString() === userId;
    const myMembership = await GroupMember.findOne({ groupId: id, userId: currentUserId });
    const isGroupAdmin = myMembership && ['OWNER', 'ADMIN'].includes(myMembership.role);
    const isSystemAdmin = req.user!.role === 'ADMIN';

    if (!isSelf && !isGroupAdmin && !isSystemAdmin) {
      res.status(403).json({ message: 'Permission denied to remove member' });
      return;
    }

    await GroupMember.findOneAndDelete({ groupId: id, userId });
    await Conversation.findOneAndUpdate(
      { groupId: id },
      { $pull: { participants: userId } }
    );

    res.json({ message: 'Member removed from group' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove member', error });
  }
});

export default router;
