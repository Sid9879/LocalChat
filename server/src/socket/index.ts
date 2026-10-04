import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/token';
import { User, IUser } from '../models/User';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { GroupMember } from '../models/GroupMember';
import mongoose from 'mongoose';

// Map of userId -> Set of active socket IDs
const onlineUsers = new Map<string, Set<string>>();

export function setupSocketIO(io: SocketIOServer): void {
  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid or expired token'));
      }

      const user = await User.findById(payload.userId);
      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('User not found or account is not active'));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user: IUser = socket.data.user;
    const userId = user._id.toString();

    // Track active socket
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Join personal user room
    socket.join(`user:${userId}`);

    // Join rooms for all groups user belongs to
    try {
      const memberships = await GroupMember.find({ userId: user._id });
      for (const m of memberships) {
        socket.join(`group:${m.groupId.toString()}`);
      }
    } catch (err) {
      console.error('Error joining group rooms:', err);
    }

    // Broadcast online status to others
    io.emit('presence:update', {
      userId,
      status: 'ONLINE',
      onlineUserIds: Array.from(onlineUsers.keys()),
    });

    // Provide initial list of online users to connecting socket
    socket.emit('presence:list', Array.from(onlineUsers.keys()));

    console.log(`[Socket Connected] ${user.username} (${userId}) on socket ${socket.id}`);

    // Join a newly created or joined group room dynamically
    socket.on('group:join_room', async ({ groupId }) => {
      try {
        const isMember = await GroupMember.exists({ groupId, userId: user._id });
        if (isMember) {
          socket.join(`group:${groupId}`);
        }
      } catch (err) {
        console.error('Error joining group room:', err);
      }
    });

    // Send Message
    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, type = 'TEXT', attachment, replyTo } = data;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ error: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );

        if (!isParticipant) {
          if (callback) callback({ error: 'Not authorized for this conversation' });
          return;
        }

        const message = await Message.create({
          conversationId,
          senderId: user._id,
          type,
          content: content || '',
          attachment,
          replyTo: replyTo || undefined,
          deliveryStatus: 'SENT',
        });

        await message.populate('senderId', 'username displayName avatarUrl');
        if (replyTo) {
          await message.populate('replyTo', 'content senderId type');
        }

        // Update conversation lastMessage
        conversation.lastMessage = {
          senderId: user._id as mongoose.Types.ObjectId,
          content: type === 'TEXT' ? content : `[${type}]`,
          type,
          createdAt: new Date(),
        };
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Deliver message
        if (conversation.type === 'GROUP' && conversation.groupId) {
          io.to(`group:${conversation.groupId.toString()}`).emit('message:received', message);
        } else {
          for (const p of conversation.participants) {
            io.to(`user:${p.toString()}`).emit('message:received', message);
          }
        }

        if (callback) callback({ success: true, message });
      } catch (err: any) {
        console.error('Error sending message:', err);
        if (callback) callback({ error: err.message || 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing:start', ({ conversationId }) => {
      socket.broadcast.emit('typing:status', {
        conversationId,
        userId,
        username: user.displayName || user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.broadcast.emit('typing:status', {
        conversationId,
        userId,
        username: user.displayName || user.username,
        isTyping: false,
      });
    });

    // Message read receipts
    socket.on('message:read', async ({ conversationId, messageIds }) => {
      try {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return;
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            conversationId,
            'readBy.userId': { $ne: user._id },
          },
          {
            $push: { readBy: { userId: user._id, readAt: new Date() } },
            $set: { deliveryStatus: 'READ' },
          }
        );

        io.emit('message:read_receipt', {
          conversationId,
          userId,
          messageIds,
        });
      } catch (err) {
        console.error('Error updating read receipts:', err);
      }
    });

    // ==========================================
    // WebRTC Signaling for Voice & Video Calls
    // ==========================================

    // Initiate Call (1:1 or Group)
    socket.on('call:initiate', async ({ targetUserId, conversationId, isVideo }) => {
      console.log(`[Call Initiate] From ${user.username} to ${targetUserId || 'group'} (Video: ${isVideo})`);
      
      const callData = {
        callerId: userId,
        callerName: user.displayName || user.username,
        callerAvatar: user.avatarUrl,
        conversationId,
        isVideo: !!isVideo,
      };

      if (targetUserId) {
        // 1:1 call
        io.to(`user:${targetUserId}`).emit('call:incoming', callData);
      } else if (conversationId) {
        // Group call: broadcast to conversation participants
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          for (const p of conv.participants) {
            if (p.toString() !== userId) {
              io.to(`user:${p.toString()}`).emit('call:incoming', callData);
            }
          }
        }
      }
    });

    // Accept Call
    socket.on('call:accept', ({ callerId, conversationId }) => {
      console.log(`[Call Accepted] By ${user.username} for caller ${callerId}`);
      io.to(`user:${callerId}`).emit('call:accepted', {
        accepterId: userId,
        accepterName: user.displayName || user.username,
        conversationId,
      });
    });

    // Reject Call
    socket.on('call:reject', ({ callerId, reason }) => {
      console.log(`[Call Rejected] By ${user.username} for caller ${callerId}`);
      io.to(`user:${callerId}`).emit('call:rejected', {
        rejectedBy: userId,
        reason: reason || 'Call declined',
      });
    });

    // End Call
    socket.on('call:end', ({ targetUserId, conversationId }) => {
      console.log(`[Call Ended] By ${user.username}`);
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:ended', { endedBy: userId });
      } else if (conversationId) {
        socket.broadcast.emit('call:ended', { endedBy: userId, conversationId });
      }
    });

    // WebRTC Offer
    socket.on('webrtc:offer', ({ targetUserId, sdp }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:offer', {
        senderId: userId,
        sdp,
      });
    });

    // WebRTC Answer
    socket.on('webrtc:answer', ({ targetUserId, sdp }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:answer', {
        senderId: userId,
        sdp,
      });
    });

    // WebRTC ICE Candidate
    socket.on('webrtc:ice', ({ targetUserId, candidate }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:ice', {
        senderId: userId,
        candidate,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline
          io.emit('presence:update', {
            userId,
            status: 'OFFLINE',
            onlineUserIds: Array.from(onlineUsers.keys()),
          });
        }
      }
      console.log(`[Socket Disconnected] ${user.username} (${userId})`);
    });
  });
}
