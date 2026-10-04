import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { CallProvider, useCall } from './context/CallContext';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AuthModal } from './components/AuthModal';
import { VideoCallModal } from './components/VideoCallModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { NewChatModal } from './components/NewChatModal';
import { GroupDetailsModal } from './components/GroupDetailsModal';
import { Conversation, Group } from './types';
import { apiRequest } from './api';
import { MessageSquare, ShieldCheck, Wifi } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Modals state
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Refresh conversation and group lists
  const loadData = async () => {
    if (!user) return;
    try {
      const [convs, grps] = await Promise.all([
        apiRequest('/api/chat/conversations'),
        apiRequest('/api/groups/my'),
      ]);
      setConversations(convs);
      setGroups(grps);

      if (user.role === 'ADMIN') {
        const pending = await apiRequest('/api/admin/pending-users');
        setPendingApprovalsCount(pending.length);
      }
    } catch (err) {
      console.error('Failed to load initial chat data:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Listen for socket events updating conversation list
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (newMessage: any) => {
      setConversations((prev) => {
        const convIndex = prev.findIndex((c) => c._id === newMessage.conversationId);
        if (convIndex === -1) {
          // If conversation wasn't loaded, reload data
          loadData();
          return prev;
        }

        const updated = [...prev];
        const conv = updated[convIndex];
        conv.lastMessage = {
          senderId: newMessage.senderId,
          content: newMessage.content,
          type: newMessage.type,
          createdAt: newMessage.createdAt,
        };
        conv.lastMessageAt = newMessage.createdAt;

        // Move updated conversation to top
        updated.splice(convIndex, 1);
        updated.unshift(conv);
        return updated;
      });
    };

    socket.on('message:received', handleMessageReceived);

    return () => {
      socket.off('message:received', handleMessageReceived);
    };
  }, [socket]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium">Connecting to LocalChat LAN node...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  const activeConversation = conversations.find((c) => c._id === activeConversationId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        groups={groups}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onOpenNewChat={() => setShowNewChat(true)}
        onOpenAdmin={() => setShowAdmin(true)}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Conversation Stage */}
      {activeConversation ? (
        <ChatArea
          conversation={activeConversation}
          onOpenGroupDetails={
            activeConversation.type === 'GROUP'
              ? () => setShowGroupDetails(true)
              : undefined
          }
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-950 select-none">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Welcome to LocalChat</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            Select a direct chat or private group from the sidebar to start messaging, file sharing,
            or initiating voice/video calls over LAN.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <Wifi className="w-3.5 h-3.5" />
            <span>LAN Mode Active • Host IP: 10.175.128.58</span>
          </div>
        </div>
      )}

      {/* Realtime WebRTC Call Overlays */}
      <VideoCallModal />
      <IncomingCallModal />

      {/* Modals */}
      {showAdmin && (
        <AdminPanelModal
          onClose={() => setShowAdmin(false)}
          onRefreshData={loadData}
        />
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(conv) => {
            setConversations((prev) => [conv, ...prev.filter((c) => c._id !== conv._id)]);
            setActiveConversationId(conv._id);
          }}
        />
      )}

      {showGroupDetails && activeConversation?.groupId && (
        <GroupDetailsModal
          groupId={
            typeof activeConversation.groupId === 'string'
              ? activeConversation.groupId
              : activeConversation.groupId._id
          }
          onClose={() => setShowGroupDetails(false)}
          onMembersUpdated={loadData}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <MainApp />
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
