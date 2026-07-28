import { apiClient } from './client';

export const adminApi = {
  getDashboardOverview: async () => {
    return apiClient('/admin/dashboard/overview');
  },
  getUsersAnalytics: async () => {
    return apiClient('/admin/users');
  },
  getSubscriptionsAnalytics: async () => {
    return apiClient('/admin/subscriptions');
  },
  getAiUsageAnalytics: async () => {
    return apiClient('/admin/usage');
  }
};
