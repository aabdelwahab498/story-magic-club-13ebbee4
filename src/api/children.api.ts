import { apiClient } from './client';

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  language: string;
  readingLevel?: string;
  emotionalGoals?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildProfileDto {
  name: string;
  age: number;
  language: string;
  readingLevel?: string;
  emotionalGoals?: string[];
}

export interface UpdateChildProfileDto {
  name?: string;
  age?: number;
  language?: string;
  readingLevel?: string;
  emotionalGoals?: string[];
}

export const childrenApi = {
  getChildren: () => {
    return apiClient<ChildProfile[]>('/users/me/children');
  },

  getChild: (id: string) => {
    return apiClient<ChildProfile>(`/users/me/children/${id}`);
  },

  createChild: (data: CreateChildProfileDto) => {
    return apiClient<ChildProfile>('/users/me/children', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateChild: (id: string, data: UpdateChildProfileDto) => {
    return apiClient<ChildProfile>(`/users/me/children/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteChild: (id: string) => {
    return apiClient<void>(`/users/me/children/${id}`, {
      method: 'DELETE',
    });
  },
};
