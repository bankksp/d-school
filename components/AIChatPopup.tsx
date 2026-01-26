import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Personnel, ChatMessage } from '../types';
import { postToGoogleScript, formatOnlyTime, getFirstImageSource, prepareDataForApi, safeParseArray } from '../utils';

interface ChatPopupProps {
    currentUser: Personnel | null;
    personnel: Personnel[];
}

const AIChatPopup: React.FC<ChatPopupProps> = ({ currentUser, personnel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'list' | 'chat' | 'newMessage'>('list');
    const [selectedContact, setSelectedContact] = useState<Personnel | 'all' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const lastFetchTimestampRef = useRef<string | null>(null);
    const pollingIntervalRef = useRef<number | null>(null);

    const [onlineStatus, setOnlineStatus] = useState<Map<number, boolean>>(new Map());

    useEffect(() => {
        const updateStatuses = () => {
            if (!personnel || personnel.length === 0) return;
            const newStatuses = new Map<number, boolean>();
            personnel.forEach(p => {
                // ~30% chance of being online to make it look less crowded
                newStatuses.set(p.id, Math.random() < 0.3);
            });
            setOnlineStatus(newStatuses);
        };

        updateStatuses(); // Initial set

        // Update every 30 seconds to simulate live changes
        const intervalId = setInterval(updateStatuses, 30000);

        return () => clearInterval(intervalId);
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
            fetchMessages(true); // Initial fetch
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            const intervalId = window.setInterval(() => fetchMessages(false), 5000); // Poll every 5 seconds
            pollingIntervalRef.current = intervalId;
            return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
        } else {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            setMessages([]);
            lastFetchTimestampRef.current = null;
        }
    }, [currentUser, fetchMessages]);

    useEffect(() => {
        if (attachment) {
            if (attachment.type.startsWith('image/')) {
                setAttachmentPreview(URL.createObjectURL(attachment));
            } else {
                setAttachmentPreview(null); // No preview for non-image files
            }
        } else {
            setAttachmentPreview(null);
        }

        return () => {
            if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
        };
    }, [attachment]);


    useEffect(() => {
        if (isOpen && scrollRef.current) {
            setTimeout(() => {
                scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
            }, 100);
        }
    }, [isOpen, messages, view, selectedContact]);

    const allContacts = useMemo(() => {
        return personnel.filter(p => p.id !== currentUser?.id);
    }, [personnel, currentUser]);

    const activeMessages = useMemo(() => {
        if (!selectedContact || !currentUser) return [];
        if (selectedContact === 'all') {
            return messages.filter(m => m.receiverId === 'all' && !m.isDeleted);
        }
        return messages.filter(m => 
            !m.isDeleted && (
                (m.senderId === currentUser.id && m.receiverId === selectedContact.id) ||
                (m.senderId === selectedContact.id && m.receiverId === currentUser.id)
            )
        );
    }, [messages, selectedContact, currentUser]);

    const inboxList = useMemo(() => {
        const conversations: Map<string, { person: Personnel | 'all', lastMsg: ChatMessage }> = new Map();
        
        const sortedMessages = [...messages].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        for (const msg of sortedMessages) {
            if (msg.isDeleted) continue;
            let key: string;
            let person: Personnel | 'all' | undefined;

            if (msg.receiverId === 'all') {
                key = 'all';
                person = 'all';
            } else {
                const otherId = msg.senderId === currentUser?.id ? msg.receiverId : msg.senderId;
                key = String(otherId);
                person = personnel.find(p => p.id === otherId);
            }
            
            if (person && !conversations.has(key)) {
                conversations.set(key, { person, lastMsg: msg });
            }
        }
        return Array.from(conversations.values());
    }, [messages, currentUser, personnel]);


    const handleSend = async () => {
        if ((!input.trim() && !attachment) || !currentUser || !selectedContact) return;

        setIsSending(true);
        const receiverId = selectedContact === 'all' ? 'all' : selectedContact.id;
        const tempId = Date.now();
        
        let messageData: Partial<ChatMessage> = {
            id: tempId,
            senderId: currentUser.id,
            senderName: `${currentUser.personnelTitle}${currentUser.personnelName}`,
            receiverId: receiverId,
            text: input,
            timestamp: new Date().toISOString(),
            isRead: true, // Optimistic: read by sender
        };
        
        if (attachment) {
            messageData.attachments = [attachment];
            messageData.text = input || `Sent a file: ${attachment.name}`;
        }
        
        setMessages(prev => [...prev, messageData as ChatMessage]);
        setInput('');
        setAttachment(null);

        try {
            const apiPayload = await prepareDataForApi(messageData);
            const response = await postToGoogleScript({
                action: 'sendChatMessage',
                data: apiPayload
            });

            if (response.status === 'success' && response.data) {
                setMessages(prev => prev.map(m => m.id === tempId ? response.data : m));
            } else {
                throw new Error('Failed to send message');
            }
        } catch (e) {
            console.error('Send chat error:', e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInput(messageData.text || '');
            setAttachment(messageData.attachments ? messageData.attachments[0] as File : null);
            alert('ไม่สามารถส่งข้อความได้');
        } finally {
            setIsSending(false);
        }
    };
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setAttachment(event.target.files[0]);
        }
    };

    const handleSelectChat = (contact: Personnel | 'all') => {
        setSelectedContact(contact);
        setView('chat');
    };
    
    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => { // Delay reset for closing animation
            setView('list'); 
            setSelectedContact(null);
        }, 300);
    }
    
    const renderChatBubble = (msg: ChatMessage) => {
        const isMe = msg.senderId === currentUser?.id;
        const sender = isMe ? currentUser : personnel.find(p => p.id === msg.senderId);
        const attachments = msg.attachments ? safeParseArray(msg.attachments) : [];
        
        const isImageAttachment = attachments.length > 0 && (String(getFirstImageSource(attachments[0])).toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) != null);
        const isFileAttachment = attachments.length > 0 && !isImageAttachment;

        return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {sender && getFirstImageSource(sender.profileImage) ? <img src={getFirstImageSource(sender.profileImage)!} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs font-bold text-gray-400">{sender?.personnelName.charAt(0)}</div>}
                    </div>
                )}
                <div className={`p-1 rounded-2xl max-w-[70%] ${isMe ? 'bg-blue-600 text-white rounded-br-lg' : 'bg-gray-100 text-gray-800 rounded-bl-lg'}`}>
                    {isImageAttachment && (
                        <div className="p-2">
                            <img src={getFirstImageSource(attachments[0])!} className="rounded-xl max-w-xs" alt="attachment" />
                        </div>
                    )}
                    
                    {msg.text && (
                        isFileAttachment ? (
                            <a href={getFirstImageSource(attachments[0])!} target="_blank" rel="noreferrer" className="flex items-start gap-2 px-3 pt-2 pb-1 text-current no-underline hover:underline">
                                <span className="flex-shrink-0 mt-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
                                </span>
                                <p className="text-sm break-words">{msg.text}</p>
                            </a>
                        ) : (
                            <p className="text-sm px-3 pt-2 pb-1">{msg.text}</p>
                        )
                    )}
                    
                    <p className={`text-[10px] mt-1 text-right px-3 pb-2 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{formatOnlyTime(msg.timestamp)}</p>
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
                                <div className="p-4 pt-5 shrink-0 flex justify-between items-center">
                                    <h2 className="text-2xl font-bold text-navy">Messenger</h2>
                                    <div>
                                        <button onClick={() => setView('newMessage')} className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" title="New Message">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                        </button>
                                        <button onClick={handleClose} className="p-2 ml-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200" title="Close">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 pt-2 shrink-0">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Online</p>
                                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
                                        {personnel.filter(p => onlineStatus.get(p.id) && p.id !== currentUser?.id).slice(0, 8).map(c => (
                                            <div key={c.id} onClick={() => handleSelectChat(c)} className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 w-16 group">
                                                <div className="relative">
                                                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm transition-transform group-hover:scale-105">
                                                        {getFirstImageSource(c.profileImage) ? <img src={getFirstImageSource(c.profileImage)!} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full font-bold text-gray-500">{c.personnelName.charAt(0)}</div>}
                                                    </div>
                                                    <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white bg-green-500"></span>
                                                </div>
                                                <p className="text-xs text-gray-600 truncate w-full text-center font-medium">{c.personnelName.split(' ')[0]}</p>
                                            </div>
                                        ))}
                                    </div>
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
                        {view === 'chat' && selectedContact && currentUser && (
                             <div className="flex flex-col h-full">
                                <div className="p-3 border-b shrink-0 flex items-center gap-3 bg-white/80 backdrop-blur-sm z-10">
                                    <button onClick={() => setView('list')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                        {selectedContact !== 'all' && getFirstImageSource(selectedContact.profileImage) ? <img src={getFirstImageSource(selectedContact.profileImage)!} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-lg">{selectedContact === 'all' ? '📢' : selectedContact.personnelName.charAt(0)}</div>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-base text-gray-900">{selectedContact === 'all' ? 'ประกาศถึงทุกคน' : selectedContact.personnelName}</p>
                                        <p className="text-xs text-gray-500">{selectedContact !== 'all' && onlineStatus.get(selectedContact.id) ? 'Online' : 'Offline'}</p>
                                    </div>
                                </div>
                                <div className="flex-grow p-4 space-y-4 overflow-y-auto bg-gray-50" ref={scrollRef}>
                                    {activeMessages.map(renderChatBubble)}
                                </div>
                                <div className="p-2 border-t shrink-0 bg-white">
                                    {attachment && (
                                        <div className="p-2 flex justify-between items-center bg-gray-100 rounded-lg mb-2">
                                            {attachmentPreview ? <img src={attachmentPreview} className="w-16 h-16 rounded object-cover" /> : <div className="text-xs p-2 bg-gray-200 rounded">{attachment.name}</div>}
                                            <button onClick={() => setAttachment(null)} className="p-2 text-red-500">&times;</button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                                        <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                                        <button onClick={() => cameraInputRef.current?.click()} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                                        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-grow bg-gray-100 border-none rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-primary-blue" />
                                        <button onClick={handleSend} disabled={isSending} className="p-3 bg-primary-blue text-white rounded-full disabled:opacity-50 transition-transform active:scale-90">
                                            <svg className="w-5 h-5 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        </button>
                                    </div>
                                </div>
                             </div>
                        )}

                         {/* New Message View */}
                        {view === 'newMessage' && (
                            <div className="flex flex-col h-full">
                                <div className="p-3 border-b shrink-0 flex items-center gap-3">
                                    <button onClick={() => setView('list')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                    <h3 className="text-lg font-bold text-navy">New Message</h3>
                                </div>
                                <div className="p-4 shrink-0">
                                    <input type="text" placeholder="ค้นหาบุคลากร..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-100 border-none rounded-full px-5 py-3" />
                                </div>
                                <div className="flex-grow overflow-y-auto p-2">
                                    {allContacts.filter(c => c.personnelName.toLowerCase().includes(searchTerm.toLowerCase())).map(contact => (
                                        <div key={contact.id} onClick={() => handleSelectChat(contact)} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                                            <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                                                {getFirstImageSource(contact.profileImage) && <img src={getFirstImageSource(contact.profileImage)!} className="w-full h-full object-cover" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-base text-gray-900">{contact.personnelName}</p>
                                                <p className="text-xs text-gray-500">{contact.position}</p>
                                            </div>
                                        </div>
                                    ))}
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
            
            <div className={`fixed bottom-24 right-6 z-[1090] transition-all duration-300 ${isOpen ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100'}`}>
                <div className="bg-white/80 backdrop-blur-md p-2 pl-4 rounded-full shadow-lg text-sm font-bold text-gray-700 flex items-center gap-2">
                    <span>Chat with us!</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
            </div>
        </>
    );
};

export default AIChatPopup;
