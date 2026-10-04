import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { upload } from '../middleware/upload';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

const router = Router();
router.use(authMiddleware);

// Get all conversations for current user
router.get('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!._id as mongoose.Types.ObjectId;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate('groupId', 'name description avatarUrl isPrivate')
      .populate('participants', 'username displayName avatarUrl status role')
      .populate('lastMessage.senderId', 'username displayName')
      .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch conversations', error });
  }
});

// Start or get Direct Message conversation
router.post('/conversations/dm', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user!._id as mongoose.Types.ObjectId;

    if (!targetUserId) {
      res.status(400).json({ message: 'Target user ID is required' });
      return;
    }

    if (currentUserId.toString() === targetUserId) {
      res.status(400).json({ message: 'Cannot start conversation with yourself' });
      return;
    }

    // Verify target user is active
    const targetUser = await User.findById(targetUserId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      res.status(404).json({ message: 'Target user not found or inactive' });
      return;
    }

    // Check if DM conversation already exists
    let conversation = await Conversation.findOne({
      type: 'DIRECT',
      participants: { $all: [currentUserId, targetUserId], $size: 2 },
    })
      .populate('participants', 'username displayName avatarUrl status role')
      .populate('lastMessage.senderId', 'username displayName');

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'DIRECT',
        participants: [currentUserId, targetUserId],
        lastMessageAt: new Date(),
      });
      await conversation.populate('participants', 'username displayName avatarUrl status role');
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Failed to initialize DM conversation', error });
  }
});

// Get messages for a conversation (with cursor pagination)
router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!._id as mongoose.Types.ObjectId;
    const { before, limit = 50 } = req.query;

    // Verify user is a participant
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === currentUserId.toString()
    );

    if (!isParticipant && req.user!.role !== 'ADMIN') {
      res.status(403).json({ message: 'Access denied: You are not part of this conversation' });
      return;
    }

    const query: any = { conversationId: id };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'username displayName avatarUrl')
      .populate('replyTo', 'content senderId type')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Return in chronological order
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages', error });
  }
});

// Search active users (to start DM or add to group)
router.get('/users/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const currentUserId = req.user!._id;

    const filter: any = {
      status: 'ACTIVE',
      _id: { $ne: currentUserId },
    };

    if (q) {
      filter.$or = [
        { username: { $regex: q as string, $options: 'i' } },
        { displayName: { $regex: q as string, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).select('username displayName avatarUrl role status');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'User search failed', error });
  }
});

// File upload
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const file = req.file;
    let type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' = 'FILE';

    if (file.mimetype.startsWith('image/')) type = 'IMAGE';
    else if (file.mimetype.startsWith('video/')) type = 'VIDEO';
    else if (file.mimetype.startsWith('audio/')) type = 'AUDIO';

    const fileInfo = {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/api/chat/files/${file.filename}`,
      type,
    };

    res.json(fileInfo);
  } catch (error) {
    res.status(500).json({ message: 'File upload failed', error });
  }
});

// Download/View file
router.get('/files/:filename', (req: AuthRequest, res: Response): void => {
  try {
    const filename = String(req.params.filename);
    const filePath = path.join(__dirname, '../../uploads', filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve file', error });
  }
});

export default router;
