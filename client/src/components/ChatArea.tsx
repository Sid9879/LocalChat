import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { Conversation, Message } from '../types';
import { apiRequest, uploadFile, API_BASE_URL } from '../api';
import {
  Phone,
  Video,
  Send,
  Paperclip,
  Lock,
  FileText,
  Download,
  Check,
  CheckCheck,
  Users,
} from 'lucide-react';

interface ChatAreaProps {
  conversation: Conversation;
  onOpenGroupDetails?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  onOpenGroupDetails,
}) => {
  const { user } = useAuth();
  const { socket, onlineUserIds } = useSocket();
  const { startCall } = useCall();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const isGroup = conversation.type === 'GROUP';
  const otherParticipant = !isGroup
    ? conversation.participants.find((p) => p.id !== user?.id && p._id !== user?.id)
    : null;

  const isOnline = otherParticipant
    ? onlineUserIds.includes(otherParticipant.id || otherParticipant._id || '')
    : false;

  // Load message history
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await apiRequest(`/api/chat/conversations/${conversation._id}/messages`);
        setMessages(data);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversation._id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Listen for real-time messages & typing
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (newMessage: Message) => {
      if (newMessage.conversationId === conversation._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });

        // Mark as read
        if (newMessage.senderId._id !== user?.id) {
          socket.emit('message:read', {
            conversationId: conversation._id,
            messageIds: [newMessage._id],
          });
        }
      }
    };

    const handleTypingStatus = (data: {
      conversationId: string;
      userId: string;
      username: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId === conversation._id && data.userId !== user?.id) {
        setTypingUser(data.isTyping ? data.username : null);
      }
    };

    const handleReadReceipt = ({
      conversationId,
      messageIds,
    }: {
      conversationId: string;
      messageIds: string[];
    }) => {
      if (conversationId === conversation._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg._id) ? { ...msg, deliveryStatus: 'READ' } : msg
          )
        );
      }
    };

    socket.on('message:received', handleMessageReceived);
    socket.on('typing:status', handleTypingStatus);
    socket.on('message:read_receipt', handleReadReceipt);

    return () => {
      socket.off('message:received', handleMessageReceived);
      socket.off('typing:status', handleTypingStatus);
      socket.off('message:read_receipt', handleReadReceipt);
    };
  }, [socket, conversation._id, user?.id]);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (socket) {
      socket.emit('typing:start', { conversationId: conversation._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { conversationId: conversation._id });
      }, 1500);
    }
  };

  // Send text message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit('message:send', {
      conversationId: conversation._id,
      content: inputText.trim(),
      type: 'TEXT',
    });

    setInputText('');
    socket.emit('typing:stop', { conversationId: conversation._id });
  };

  // Handle file attachment upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    setUploading(true);
    try {
      const fileData = await uploadFile(file);

      socket.emit('message:send', {
        conversationId: conversation._id,
        content: file.name,
        type: fileData.type,
        attachment: fileData,
      });
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-400">
            {isGroup ? (
              <Lock className="w-5 h-5 text-amber-400" />
            ) : (
              otherParticipant?.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">
              {isGroup ? conversation.groupId?.name : otherParticipant?.displayName}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {isGroup ? (
                <span>{conversation.participants.length} authorized members</span>
              ) : (
                <>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  />
                  <span>{isOnline ? 'Online on LAN' : 'Offline'}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons: Voice Call, Video Call, Group Info */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              startCall(
                otherParticipant?._id || otherParticipant?.id,
                false,
                isGroup ? conversation._id : undefined
              )
            }
            title="Start Voice Call"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 transition-all cursor-pointer"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              startCall(
                otherParticipant?._id || otherParticipant?.id,
                true,
                isGroup ? conversation._id : undefined
              )
            }
            title="Start Video Call"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-400 border border-slate-700 transition-all cursor-pointer"
          >
            <Video className="w-4 h-4" />
          </button>

          {isGroup && onOpenGroupDetails && (
            <button
              onClick={onOpenGroupDetails}
              title="Group Members & Settings"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Loading conversations...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
            <Lock className="w-8 h-8 mb-2 text-slate-600" />
            <p>End-to-end private communication on this LAN.</p>
            <p className="text-xs text-slate-600 mt-1">Send a message to start chatting.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              msg.senderId._id === user?.id ||
              msg.senderId.id === user?.id ||
              (msg.senderId as any) === user?.id;

            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-indigo-400">
                      {msg.senderId.displayName || msg.senderId.username}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-md break-words ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* Text Content */}
                  {msg.type === 'TEXT' && <p>{msg.content}</p>}

                  {/* Image Attachment */}
                  {msg.type === 'IMAGE' && msg.attachment && (
                    <div className="space-y-1.5">
                      <img
                        src={`${API_BASE_URL}${msg.attachment.url}`}
                        alt={msg.attachment.originalName}
                        className="rounded-xl max-h-72 object-cover cursor-pointer hover:opacity-95"
                        onClick={() =>
                          window.open(`${API_BASE_URL}${msg.attachment?.url}`, '_blank')
                        }
                      />
                      {msg.content && msg.content !== msg.attachment.originalName && (
                        <p className="text-xs mt-1">{msg.content}</p>
                      )}
                    </div>
                  )}

                  {/* Video Attachment */}
                  {msg.type === 'VIDEO' && msg.attachment && (
                    <div className="space-y-1.5">
                      <video
                        controls
                        src={`${API_BASE_URL}${msg.attachment.url}`}
                        className="rounded-xl max-h-72 w-full"
                      />
                    </div>
                  )}

                  {/* Audio Attachment */}
                  {msg.type === 'AUDIO' && msg.attachment && (
                    <div className="space-y-1.5">
                      <audio controls src={`${API_BASE_URL}${msg.attachment.url}`} className="w-64" />
                    </div>
                  )}

                  {/* File / Document Attachment */}
                  {msg.type === 'FILE' && msg.attachment && (
                    <div className="flex items-center gap-3 p-2 bg-slate-900/40 rounded-xl">
                      <FileText className="w-6 h-6 text-indigo-300 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">
                          {msg.attachment.originalName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(msg.attachment.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <a
                        href={`${API_BASE_URL}${msg.attachment.url}`}
                        download={msg.attachment.originalName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-700/60 hover:bg-slate-700 rounded-lg text-slate-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Status checks */}
                  {isMe && (
                    <div className="flex justify-end mt-1 text-indigo-200 text-[10px]">
                      {msg.deliveryStatus === 'READ' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                      ) : msg.deliveryStatus === 'DELIVERED' ? (
                        <CheckCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Realtime Typing Indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 italic px-2 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>{typingUser} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* File attachment picker */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="Attach File or Media"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-400 border-t-transparent" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
