import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import { Group, GroupMember, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, UserMinus, Shield, X, Lock } from 'lucide-react';

interface GroupDetailsModalProps {
  groupId: string;
  onClose: () => void;
  onMembersUpdated?: () => void;
}

export const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  groupId,
  onClose,
  onMembersUpdated,
}) => {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myRole, setMyRole] = useState<string>('MEMBER');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchGroupDetails = async () => {
    try {
      const data = await apiRequest(`/api/groups/${groupId}`);
      setGroup(data.group);
      setMembers(data.members);
      setMyRole(data.myRole);

      // Fetch active users to allow adding
      const allActive = await apiRequest('/api/chat/users/search');
      // Filter out users already in members
      const existingUserIds = data.members.map((m: any) => m.userId?._id || m.userId?.id || m.userId);
      const candidates = allActive.filter((u: User) => !existingUserIds.includes(u.id || u._id));
      setAvailableUsers(candidates);
    } catch (err) {
      console.error('Failed to load group details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN' || user?.role === 'ADMIN';

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      await apiRequest(`/api/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId, role: 'MEMBER' }),
      });
      setSelectedUserId('');
      await fetchGroupDetails();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: any) {
      alert(`Could not add member: ${err.message}`);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm('Are you sure you want to remove this member from the private group?')) return;

    try {
      await apiRequest(`/api/groups/${groupId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      await fetchGroupDetails();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: any) {
      alert(`Could not remove member: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white">{group?.name || 'Group Info'}</h3>
              <p className="text-xs text-slate-400">Strictly Private Group</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Group Description */}
        {group?.description && (
          <p className="text-xs text-slate-300 my-3 p-3 bg-slate-800/40 rounded-xl border border-slate-800">
            {group.description}
          </p>
        )}

        {/* Add Member form (if caller has rights) */}
        {canManage && (
          <form onSubmit={handleAddMember} className="my-3 flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select active user to add...</option>
              {availableUsers.map((u) => (
                <option key={u.id || u._id} value={u.id || u._id}>
                  {u.displayName} (@{u.username})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedUserId}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </form>
        )}

        {/* Members List */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2 mb-2">
          <span>Members ({members.length})</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center text-xs text-slate-500 py-6">Loading members...</p>
          ) : (
            members.map((m) => {
              const memberUser = m.userId;
              const isOwner = m.role === 'OWNER';
              const canRemoveThisUser =
                canManage &&
                memberUser &&
                memberUser._id !== user?.id &&
                memberUser.id !== user?.id;

              return (
                <div
                  key={m._id}
                  className="p-2.5 bg-slate-800/40 border border-slate-700/40 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300">
                      {memberUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-200">
                          {memberUser?.displayName || 'User'}
                        </span>
                        <span className="text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-300 px-1 rounded">
                          {m.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">@{memberUser?.username}</p>
                    </div>
                  </div>

                  {canRemoveThisUser && (
                    <button
                      onClick={() => handleRemoveMember(memberUser._id || memberUser.id)}
                      title="Remove from group"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
