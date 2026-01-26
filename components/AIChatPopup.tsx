import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Personnel, ChatMessage, Report, Settings, Student, StudentAttendance } from '../types';
import { postToGoogleScript, formatOnlyTime, getFirstImageSource } from '../utils';

interface ChatPopupProps {
    currentUser: Personnel | null;
    personnel: Personnel[];
    students: Student[];
    reports: Report[];
    settings: Settings;
    studentAttendance: StudentAttendance[];
}

const AIChatPopup: React.FC<ChatPopupProps> = ({ currentUser, personnel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'list' | 'chat' | 'newMessage'>('list');
    const [selectedContact, setSelectedContact] = useState<Personnel | 'all' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastFetchTimestampRef = useRef<string | null>(null);
    const pollingIntervalRef = useRef<number | null>(null);

    // Mock online status and sample data for a richer UI
    const onlineStatus = useMemo(() => {
        const statuses = new Map<number, boolean>();
        personnel.forEach(p => statuses.set(p.id, p.id % 2 === 0));
        return statuses;
    }, [personnel]);

    const unreadCount = useMemo(() => {
        if (!currentUser || isOpen) return 0;
        return messages.filter(m => !m.isRead && m.senderId !== currentUser.id && (m.receiverId === currentUser.id || m.receiverId === 'all') && !m.isDeleted).length;
    }, [messages, currentUser, isOpen]);
    
    const fetchMessages = useCallback(async (isInitial: boolean) => {
        if (!currentUser) return;
        try {
            const response = await postToGoogleScript({ 
                action: 'getChatMessages', 
                userId: currentUser.id,
                userRole: currentUser.role,
                sinceTimestamp: isInitial ? null : lastFetchTimestampRef.current 
            });

            if (response.status === 'success' && response.data) {
                const incomingMsgs = (response.data as ChatMessage[]).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                
                if (incomingMsgs.length > 0) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNewMsgs = incomingMsgs.filter(m => !existingIds.has(m.id));
                        return isInitial ? incomingMsgs : [...prev, ...uniqueNewMsgs];
                    });
                    
                    const latestTimestamp = incomingMsgs[incomingMsgs.length - 1].timestamp;
                    if (!lastFetchTimestampRef.current || new Date(latestTimestamp) > new Date(lastFetchTimestampRef.current)) {
                        lastFetchTimestampRef.current = latestTimestamp;
                    }
                } else if (isInitial) {
                    lastFetchTimestampRef.current = new Date().toISOString();
                }
            }
        } catch (e) {
            console.error(`Chat ${isInitial ? 'initial fetch' : 'poll'} error`, e);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            fetchMessages(true);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            const intervalId = window.setInterval(() => { fetchMessages(false); }, 7000);
            pollingIntervalRef.current = intervalId;
            return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
        } else {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            setMessages([]);
            lastFetchTimestampRef.current = null;
        }
    }, [currentUser, fetchMessages]);

    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [isOpen, messages, view, selectedContact]);

    const allContacts = useMemo(() => {
        return personnel.filter(p => p.id !== currentUser?.id);
    }, [personnel, currentUser]);

    const activeMessages = useMemo(() => {
        if (!selectedContact) return [];
        if (selectedContact === 'all') {
            return messages.filter(m => m.receiverId === 'all' && !m.isDeleted);
        }
        return messages.filter(m => 
            !m.isDeleted && (
                (m.senderId === currentUser?.id && m.receiverId === selectedContact.id) ||
                (m.senderId === selectedContact.id && m.receiverId === currentUser?.id)
            )
        );
    }, [messages, selectedContact, currentUser]);

    const recentConversations = useMemo(() => {
        const groups: Record<string, ChatMessage> = {};
        messages.forEach(m => {
            if (m.isDeleted) return;
            const key = m.receiverId === 'all' 
                ? 'all' 
                : String(m.senderId === currentUser?.id ? m.receiverId : m.senderId);
            if (!groups[key] || new Date(m.timestamp) > new Date(groups[key].timestamp)) {
                groups[key] = m;
            }
        });
        return groups;
    }, [messages, currentUser]);

    const inboxList = useMemo(() => {
        const list: { person: Personnel | 'all', lastMsg: ChatMessage }[] = [];
        const processedIds = new Set<string>();

        // Add announcement if it exists
        if (recentConversations['all']) {
            list.push({ person: 'all', lastMsg: recentConversations['all'] });
            processedIds.add('all');
        }

        // Add other conversations
        Object.keys(recentConversations).forEach(id => {
            if (processedIds.has(id)) return;
            const p = personnel.find(per => String(per.id) === id);
            if (p) {
                list.push({ person: p, lastMsg: recentConversations[id] });
                processedIds.add(id);
            }
        });

        // Add sample users for UI fullness if list is small
        if (list.length < 4) {
            const sampleUsers = [
                {id: 999991, personnelName: "นายคงศักดิ์ ปัดเถ", profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=387&q=80'},
                {id: 999992, personnelName: "นายธนิท ธนพัฒน์นิธิศกุล", profileImage: 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=580&q=80'},
                {id: 999993, personnelName: "สุจิตา ภูผาทอง", profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=387&q=80'},
            ];
            sampleUsers.forEach((user, index) => {
                if (list.length < 4 && !list.some(item => item.person !== 'all' && item.person.id === user.id)) {
                    list.push({
                        person: user as any,
                        lastMsg: { id: 100+index, text: index % 2 === 0 ? "You: สวัสดีครับ" : "ส่งแผนการสอนยังไง?", timestamp: new Date(Date.now() - (index+1) * 3600000).toISOString() } as ChatMessage
                    });
                }
            });
        }
        
        return list.sort((a, b) => new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime());
    }, [recentConversations, personnel]);


// FIX: Implement the handleSend function to allow sending messages.
    const handleSend = async () => {
        if (!input.trim() || !currentUser || !selectedContact) return;

        setIsSending(true);
        const receiverId = selectedContact === 'all' ? 'all' : selectedContact.id;
        const tempId = Date.now();
        const newMessage: ChatMessage = {
            id: tempId,
            senderId: currentUser.id,
            senderName: `${currentUser.personnelTitle}${currentUser.personnelName}`,
            receiverId: receiverId,
            text: input,
            timestamp: new Date().toISOString(),
            isRead: true, // It's read by the sender
        };
        
        // Optimistic update
        setMessages(prev => [...prev, newMessage]);
        setInput('');

        try {
            const response = await postToGoogleScript({
                action: 'sendChatMessage',
                message: newMessage
            });

            if (response.status === 'success' && response.data) {
                // Replace temp message with server-confirmed message
                setMessages(prev => prev.map(m => m.id === tempId ? response.data : m));
            } else {
                throw new Error(response.message || 'Failed to send message');
            }
        } catch (e) {
            console.error('Send chat error:', e);
            // Revert optimistic update on failure
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInput(newMessage.text); // Put the text back
            alert('ไม่สามารถส่งข้อความได้');
        } finally {
            setIsSending(false);
        }
    };

    const handleSelectChat = (contact: Personnel | 'all') => {
        setSelectedContact(contact);
        setView('chat');
    };
    
    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => { // Delay reset to allow closing animation
            setView('list'); 
            setSelectedContact(null);
        }, 300);
    }
    
    const renderChatBubble = (msg: ChatMessage) => {
        const isMe = msg.senderId === currentUser?.id;
        return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {/* Add profile image of sender */}
                    </div>
                )}
                <div className={`p-3 rounded-2xl max-w-[70%] ${isMe ? 'bg-blue-600 text-white rounded-br-lg' : 'bg-gray-100 text-gray-800 rounded-bl-lg'}`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{formatOnlyTime(msg.timestamp)}</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="fixed bottom-6 right-6 z-[1100] font-sarabun no-print">
                {isOpen && (
                    <div className={`w-[375px] h-[calc(100vh-80px)] max-h-[700px] bg-white rounded-[1.75rem] shadow-2xl border border-gray-100 flex flex-col origin-bottom-right transition-all duration-300 ${isOpen ? 'animate-fade-in-up' : 'opacity-0 scale-95'}`}>
                        {/* Main List View */}
                        {view === 'list' && (
                             <div className="flex flex-col h-full">
                                <div className="p-4 pt-5 shrink-0">
                                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
                                        {personnel.slice(0, 5).map(c => (
                                            <div key={c.id} onClick={() => handleSelectChat(c)} className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 w-16 group">
                                                <div className="relative">
                                                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm transition-transform group-hover:scale-105">
                                                        {getFirstImageSource(c.profileImage) ? <img src={getFirstImageSource(c.profileImage)!} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full font-bold text-gray-500">{c.personnelName.charAt(0)}</div>}
                                                    </div>
                                                    <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${onlineStatus.get(c.id) ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                                </div>
                                                <p className="text-xs text-gray-600 truncate w-full text-center font-medium">{c.personnelName.split(' ')[0]}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="px-4 pb-2 border-b border-gray-100 shrink-0">
                                     <button onClick={() => handleSelectChat('all')} className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-2xl cursor-pointer border border-blue-100/50 text-left transition-colors">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-2xl shadow-inner">📢</div>
                                        <div className="flex-grow">
                                            <p className="font-bold text-base text-blue-800">ประกาศถึงทุกคน</p>
                                            <p className="text-xs text-blue-600 font-medium">ส่งข้อความแจ้งเตือนถึงบุคลากรทั้งหมด</p>
                                        </div>
                                    </button>
                                </div>
                                
                                <div className="flex-grow overflow-y-auto p-2" ref={scrollRef}>
                                    <p className="text-xs font-bold text-gray-400 uppercase px-4 py-2">Chats</p>
                                    {inboxList.map(({person, lastMsg}) => {
                                        const isUnread = !lastMsg.isRead && lastMsg.senderId !== currentUser?.id;
                                        const name = person === 'all' ? 'ประกาศถึงทุกคน' : person.personnelName;
                                        const profileImg = person === 'all' ? null : getFirstImageSource(person.profileImage);
                                        const isOnline = person !== 'all' && onlineStatus.get(person.id);
                                        
                                        return (
                                            <div key={person === 'all' ? 'all' : person.id} onClick={() => handleSelectChat(person)} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                <div className="relative flex-shrink-0">
                                                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden">
                                                         {person === 'all' ? <div className="flex items-center justify-center h-full text-2xl">📢</div> : profileImg ? <img src={profileImg} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xl font-bold text-gray-500">{name.charAt(0)}</div>}
                                                    </div>
                                                    {isOnline && <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white bg-green-500"></span>}
                                                </div>
                                                <div className="flex-grow overflow-hidden">
                                                    <div className="flex justify-between items-baseline">
                                                        <p className={`font-bold text-base truncate ${isUnread ? 'text-navy' : 'text-gray-800'}`}>{name}</p>
                                                        <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatOnlyTime(lastMsg.timestamp)}</p>
                                                    </div>
                                                    <p className={`text-sm truncate ${isUnread ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                                                        {lastMsg.senderId === currentUser?.id ? 'You: ' : ''}{lastMsg.text}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                             </div>
                        )}

                        {/* Chat View */}
                        {view === 'chat' && selectedContact && (
                             <div className="flex flex-col h-full">
                                <div className="p-3 border-b shrink-0 flex items-center gap-3 bg-white/80 backdrop-blur-sm">
                                    <button onClick={() => setView('list')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                        {/* Profile image here */}
                                    </div>
                                    <div>
                                        <p className="font-bold text-base text-gray-900">{selectedContact === 'all' ? 'ประกาศถึงทุกคน' : selectedContact.personnelName}</p>
                                        <p className="text-xs text-gray-500">Online</p>
                                    </div>
                                </div>
                                <div className="flex-grow p-4 space-y-4 overflow-y-auto" ref={scrollRef}>
                                    {activeMessages.map(renderChatBubble)}
                                </div>
                                <div className="p-4 border-t shrink-0 bg-white">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && handleSend()}
                                            placeholder="Type a message..." 
                                            className="flex-grow bg-gray-100 border-none rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-primary-blue"
                                        />
                                        <button onClick={handleSend} disabled={isSending} className="p-3 bg-primary-blue text-white rounded-full disabled:opacity-50 transition-transform active:scale-90">
                                            <svg className="w-5 h-5 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        </button>
                                    </div>
                                </div>
                             </div>
                        )}
                    </div>
                )}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transform transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? 'bg-red-500 hover:bg-red-600 rotate-180' : 'bg-primary-blue hover:bg-blue-700'}`}
                >
                    {isOpen ? (
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    )}
                    
                    {unreadCount > 0 && !isOpen && (
                        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </>
    );
};

export default AIChatPopup;
