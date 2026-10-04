import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import { User, Conversation } from '../types';
import { Search, MessageSquare, X, Shield, Lock } from 'lucide-react';

interface NewChatModalProps {
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  onClose,
  onConversationCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const queryParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
        const data = await apiRequest(`/api/chat/users/search${queryParam}`);
        setUsers(data);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [searchQuery]);

  const handleStartDM = async (targetUserId: string) => {
    try {
      const conv = await apiRequest('/api/chat/conversations/dm', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      onConversationCreated(conv);
      onClose();
    } catch (err: any) {
      alert(`Could not start chat: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Start a Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="my-4 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search approved friends by name..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Active Approved Users List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center text-xs text-slate-500 py-6">Searching approved users...</p>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              <Shield className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
              <p>No other active approved users found.</p>
              <p className="text-[11px] text-slate-600 mt-1">
                New users must be approved by an Admin first.
              </p>
            </div>
          ) : (
            users.map((u) => (
              <button
                key={u.id || u._id}
                onClick={() => handleStartDM(u.id || u._id || '')}
                className="w-full p-2.5 bg-slate-800/40 hover:bg-indigo-600/20 border border-slate-700/50 hover:border-indigo-500/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">{u.displayName}</h4>
                    <p className="text-[11px] text-slate-400">@{u.username}</p>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 text-xs font-medium flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Chat
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
