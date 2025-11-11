/**
 * Socket.IO Event Constants
 * Centralizes all event names for consistency between server and client.
 */
export const SOCKET_EVENTS = {
  // Client to Server
  SUBSCRIBE_EQUIPMENT: 'subscribe:equipment',
  UNSUBSCRIBE_EQUIPMENT: 'unsubscribe:equipment',
  
  // Server to Client
  EQUIPMENT_STATUS: 'equipment:status',
  EQUIPMENT_STATUS_UPDATE: 'equipment:status:update',
  ALERT_NEW: 'alert:new',
  NOTIFICATION_NEW: 'notification:new',
  
  // Connection Events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error'
};