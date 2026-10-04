import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Conversation, Group } from '../types';
import {
  MessageSquare,
  Users,
  Shield,
  Plus,
  LogOut,
  Wifi,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  groups: Group[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  onOpenAdmin: () => void;
  pendingApprovalsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  groups,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onOpenAdmin,
  pendingApprovalsCount,
}) => {
  const { user, logout } = useAuth();
  const { isConnected, onlineUserIds } = useSocket();

  // Separate DMs and Group conversations
  const directConversations = conversations.filter((c) => c.type === 'DIRECT');
  const groupConversations = conversations.filter((c) => c.type === 'GROUP');

  const getOtherParticipant = (c: Conversation) => {
    return c.participants.find((p) => p.id !== user?.id && p._id !== user?.id);
  };

  const isUserOnline = (userId?: string) => {
    if (!userId) return false;
    return onlineUserIds.includes(userId);
  };

  return (
    <aside className="w-80 h-screen bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30">
            LC
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              LocalChat
              <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-full">
                LAN
              </span>
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{isConnected ? 'Online' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>

        {/* Start New Chat/Group button */}
        <button
          onClick={onOpenNewChat}
          title="New Chat or Group"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700/60"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Admin Panel Quick Access (if user is Admin) */}
      {user?.role === 'ADMIN' && (
        <div className="p-3 border-b border-slate-800 bg-indigo-950/20">
          <button
            onClick={onOpenAdmin}
            className="w-full flex items-center justify-between px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Admin Management</span>
            </div>
            {pendingApprovalsCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                {pendingApprovalsCount} new
              </span>
            )}
          </button>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Direct Messages */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Direct Messages
            </span>
            <span className="text-[10px] text-slate-500">{directConversations.length}</span>
          </div>

          <div className="space-y-1">
            {directConversations.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-1.5 italic">No direct chats yet</p>
            ) : (
              directConversations.map((c) => {
                const other = getOtherParticipant(c);
                const online = isUserOnline(other?.id || other?._id);
                const isSelected = c._id === activeConversationId;

                return (
                  <button
                    key={c._id}
                    onClick={() => onSelectConversation(c._id)}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-300 border border-slate-700">
                        {other?.displayName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                          online ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate text-slate-200">
                          {other?.displayName || other?.username || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {c.lastMessage?.content || 'Start a conversation'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Private Groups */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Private Groups
            </span>
            <span className="text-[10px] text-slate-500">{groups.length}</span>
          </div>

          <div className="space-y-1">
            {groups.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-1.5 italic">No private groups joined</p>
            ) : (
              groups.map((group) => {
                const groupConv = groupConversations.find(
                  (c) => c.groupId?._id === group._id || (c.groupId as any) === group._id
                );
                const convId = groupConv?._id;
                const isSelected = convId === activeConversationId;

                return (
                  <button
                    key={group._id}
                    onClick={() => {
                      if (convId) onSelectConversation(convId);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-400 border border-slate-700">
                      <Lock className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate text-slate-200">
                          {group.name}
                        </span>
                        <span className="text-[10px] text-indigo-400/80 bg-indigo-500/10 px-1 rounded">
                          {group.myRole}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {group.description || 'Private Group Chat'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-700/30 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
            {user?.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">
                {user?.displayName}
              </span>
              {user?.role === 'ADMIN' && (
                <span className="text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded">
                  Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>@{user?.username}</span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
