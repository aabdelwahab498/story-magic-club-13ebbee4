import axios from 'axios';

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Maps raw Axios errors into a standardized ApiError shape.
 */
export const errorMapper = (error: any): never => {
  if (axios.isAxiosError(error) || error?.name === 'AxiosError' || error?.response || error?.config) {
    const status = error.response?.status || 500;
    let message = '';
    
    if (error.code === 'ECONNABORTED') {
      message = 'Request timed out. Please try again.';
    } else if (error.response?.data?.message) {
      message = Array.isArray(error.response.data.message)
        ? error.response.data.message.join(', ')
        : error.response.data.message;
    } else if (!error.response) {
      message = 'Network error. Please check your connection.';
    }

    if (!message) {
      switch (status) {
        case 401:
          message = 'Unauthorized. Please log in again.';
          break;
        case 403:
          message = 'Forbidden. You do not have permission to perform this action.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 409:
          message = 'Conflict. The resource already exists or is out of sync.';
          break;
        case 422:
          message = 'Unprocessable Entity. Validation failed.';
          break;
        case 429:
          message = 'Too many requests. Please slow down and try again later.';
          break;
        case 500:
          message = 'Internal Server Error. Please try again later.';
          break;
        default:
          message = error.message || 'An error occurred';
      }
    }

    throw new ApiError(status, message, error.response?.data);
  }
  
  // Standard fallback
  throw new ApiError(500, error instanceof Error ? error.message : 'An unknown error occurred');
};
