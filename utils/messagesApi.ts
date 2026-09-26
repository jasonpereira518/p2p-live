/**
 * Thin REST client for the secure messaging module.
 * All requests carry the bearer JWT via apiFetch; never read or log message bodies elsewhere.
 */

import { apiFetch } from './api';
import type {
  ChatConversation,
  ChatMessage,
  ConversationsResponse,
  MessagesResponse,
} from '../types/messaging';

export async function fetchConversations(): Promise<ConversationsResponse> {
  return apiFetch<ConversationsResponse>('/api/messages/conversations', {
    method: 'GET',
    authRequired: true,
  });
}

export async function fetchMessages(
  conversationId: string,
  options: { limit?: number; before?: number } = {}
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.before) params.set('before', String(options.before));
  const qs = params.toString();
  const path = `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ''}`;
  return apiFetch<MessagesResponse>(path, { method: 'GET', authRequired: true });
}

export async function sendMessage(
  conversationId: string,
  body: string,
  clientMessageId: string
): Promise<{ message: ChatMessage; clientMessageId: string }> {
  return apiFetch(`/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    authRequired: true,
    body: JSON.stringify({ body, clientMessageId }),
  });
}

export async function markConversationRead(conversationId: string) {
  return apiFetch<{ ok: boolean; updated: number; unreadCount: number }>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: 'POST', authRequired: true }
  );
}

export async function startConversationWithDriver(driverId: string, driverName?: string) {
  return apiFetch<{ conversation: ChatConversation }>(`/api/messages/conversations`, {
    method: 'POST',
    authRequired: true,
    body: JSON.stringify({ driverId, driverName }),
  });
}

export async function fetchManagedDrivers() {
  return apiFetch<{ drivers: { id: string; name: string; email?: string; role: string }[] }>(
    '/api/messages/drivers',
    { method: 'GET', authRequired: true }
  );
}

export function generateClientMessageId(): string {
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
