/**
 * Shared types for the Driver ↔ Manager secure messaging module.
 * Server payloads decrypt message bodies before sending; the client should never log them.
 */

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageSenderRole = 'driver' | 'manager' | 'admin';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: MessageSenderRole;
  body: string;
  createdAt: number;
  deliveredAt?: number | null;
  readAt?: number | null;
  status: MessageStatus;
  /** Local-only client message id used for optimistic UI reconciliation. */
  clientMessageId?: string;
}

export interface ChatConversation {
  id: string;
  driverId: string;
  driverName: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number | null;
  lastMessageSenderId?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
}

export interface ConversationsResponse {
  conversations: ChatConversation[];
  totalUnread: number;
}

export interface MessagesResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
  unreadCount: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline';

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  name?: string;
  role?: MessageSenderRole;
  startedAt: number;
}
