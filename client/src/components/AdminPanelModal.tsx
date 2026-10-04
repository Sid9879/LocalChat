import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import { User, Group } from '../types';
import {
  Shield,
  UserCheck,
  UserX,
  Users,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
} from 'lucide-react';

interface AdminPanelModalProps {
  onClose: () => void;
  onRefreshData?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'groups'>('pending');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [pending, users, statsData] = await Promise.all([
        apiRequest('/api/admin/pending-users'),
        apiRequest('/api/admin/users'),
        apiRequest('/api/admin/stats'),
      ]);
      setPendingUsers(pending);
      setAllUsers(users);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/approve`, { method: 'POST' });
      await fetchAdminData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleBlock = async (userId: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/block`, { method: 'POST' });
      await fetchAdminData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/unblock`, { method: 'POST' });
      await fetchAdminData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

    try {
      await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchAdminData();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      await apiRequest('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() }),
      });
      setCreatedMsg(`Private group "${groupName}" created successfully!`);
      setGroupName('');
      setGroupDesc('');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Group creation failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl h-[80vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Administrator Control Panel</h2>
              <p className="text-xs text-slate-400">
                LAN User Approvals, Privacy Enforcement & Group Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 p-6 pb-2 shrink-0">
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Pending Approvals</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pendingUsers}</p>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Active Users</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.activeUsers}</p>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Groups</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{stats.totalGroups}</p>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 px-6 gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border-b-2 ${
              activeTab === 'pending'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Pending Approvals ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border-b-2 ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" /> All Users ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border-b-2 ${
              activeTab === 'groups'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" /> Create Private Group
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Loading admin data...
            </div>
          ) : activeTab === 'pending' ? (
            <div className="space-y-3">
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  No new users pending approval on this LAN.
                </div>
              ) : (
                pendingUsers.map((u) => (
                  <div
                    key={u.id || u._id}
                    className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-white text-sm">{u.displayName}</h4>
                      <p className="text-xs text-slate-400">@{u.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(u.id || u._id || '')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleBlock(u.id || u._id || '')}
                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'users' ? (
            <div className="space-y-3">
              {allUsers.map((u) => (
                <div
                  key={u.id || u._id}
                  className="p-3.5 bg-slate-800/40 border border-slate-700/40 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{u.displayName}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : u.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {u.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">@{u.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRoleChange(u.id || u._id || '', u.role)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                    >
                      Role: {u.role}
                    </button>

                    {u.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleBlock(u.id || u._id || '')}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-xs font-medium border border-rose-500/30 transition-all cursor-pointer"
                      >
                        Block
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnblock(u.id || u._id || '')}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white rounded-lg text-xs font-medium border border-emerald-500/30 transition-all cursor-pointer"
                      >
                        Unblock
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto py-4">
              {createdMsg && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs">
                  {createdMsg}
                </div>
              )}

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                    Group Name
                  </label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Core Friends or Developers"
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Private discussion group on LAN"
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    Groups created are strictly <strong>Private</strong>. Only users invited by
                    an Admin will be able to see or exchange messages in this group.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Create Private Group
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
