import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await axios.get('/api/notifications');
      return response.data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    // If we have more unread notifications than before, trigger the "new" flag
    if (prevUnreadCount !== null && unreadCount > prevUnreadCount) {
      setHasNewNotification(true);
      
      // Auto-reset the visual highlight after 10 seconds
      const timer = setTimeout(() => {
        setHasNewNotification(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
    
    // Update our tracker
    if (unreadCount !== prevUnreadCount) {
      setPrevUnreadCount(unreadCount);
    }
  }, [unreadCount, prevUnreadCount]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId?: string) => {
      await axios.put('/api/notifications', { 
        notificationId, 
        markAllRead: !notificationId 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setHasNewNotification(false);
    },
  });

  const markAllRead = () => markAsReadMutation.mutate(undefined);
  const markAsRead = (id: string) => markAsReadMutation.mutate(id);

  return {
    notifications: data?.notifications || [],
    unreadCount,
    isLoading,
    hasNewNotification,
    setHasNewNotification,
    markAsRead,
    markAllRead,
    refetch,
  };
}
