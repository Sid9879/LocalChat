export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  _id?: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt?: string;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  createdBy: string | { _id: string; username: string; displayName: string };
  isPrivate: boolean;
  avatarUrl?: string;
  myRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'ADMIN_VIEW';
  createdAt: string;
}

export interface GroupMember {
  _id: string;
  groupId: string;
  userId: User;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

export interface Conversation {
  _id: string;
  type: 'DIRECT' | 'GROUP';
  groupId?: Group;
  participants: User[];
  lastMessage?: {
    senderId: { _id: string; username: string; displayName: string };
    content: string;
    type: string;
    createdAt: string;
  };
  lastMessageAt: string;
  hiddenFor?: string[];
  unreadCount?: number;
}

export interface Attachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: User;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
  content: string;
  attachment?: Attachment;
  replyTo?: {
    _id: string;
    content: string;
    senderId: string;
    type: string;
  };
  deliveryStatus: 'SENT' | 'DELIVERED' | 'READ';
  readBy?: { userId: string; readAt: string }[];
  isEdited?: boolean;
  editedAt?: string;
  createdAt: string;
}

export interface CallSession {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  conversationId?: string;
  isVideo: boolean;
  isIncoming?: boolean;
}
