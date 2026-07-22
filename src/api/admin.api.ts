import { apiClient } from './client';

export const adminApi = {
  getDashboardOverview: async () => {
    return apiClient.get('/admin/dashboard/overview');
  },
  getUsersAnalytics: async () => {
    return apiClient.get('/admin/users');
  },
  getSubscriptionsAnalytics: async () => {
    return apiClient.get('/admin/subscriptions');
  },
  getAiUsageAnalytics: async () => {
    return apiClient.get('/admin/usage');
  }
};
