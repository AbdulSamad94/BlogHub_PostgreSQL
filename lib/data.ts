import axios from "axios";
import { Blog, BlogPayload, Category, UserProfileWithPosts, UpdateProfilePayload, FollowActionResponse } from "./types";
import { User } from "next-auth";

const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.error || error.message || "An error occurred";
    console.error("API Error:", errorMessage);

    const customError = new Error(errorMessage);
    return Promise.reject(customError);
  }
);

interface BlogResponse {
  success: true;
  post: Blog;
}

interface BlogsResponse {
  success: true;
  posts: Blog[];
}

interface UpdateBlogResponse {
  success: true;
  message: string;
  post: Blog;
}

interface CategoriesResponse {
  success: true;
  categories: Category[];
}

interface CategoryResponse {
  success: true;
  category: Category;
}

interface UserProfileResponse {
  success: true;
  user: UserProfileWithPosts;
}

export const blogApi = {
  getAllBlogs: async (): Promise<{ posts: Blog[] }> => {
    try {
      const response = await apiClient.get<BlogsResponse>("/blogs");
      return { posts: response.data.posts };
    } catch (error) {
      console.error("Error fetching blogs:", error);
      throw error;
    }
  },

  searchBlogs: async (query: string): Promise<{ posts: Blog[] }> => {
    try {
      const response = await apiClient.get<BlogsResponse>(`/blogs?search=${encodeURIComponent(query)}`);
      return { posts: response.data.posts };
    } catch (error) {
      console.error(`Error searching blogs with query "${query}":`, error);
      throw error;
    }
  },

  getBlogById: async (id: string): Promise<{ post: Blog }> => {
    try {
      const response = await apiClient.get<BlogResponse>(`/blogs/${id}`);
      return { post: response.data.post };
    } catch (error) {
      console.error(`Error fetching blog with id ${id}:`, error);
      throw error;
    }
  },

  getBlogsByAuthor: async (userId: string): Promise<{ posts: Blog[] }> => {
    try {
      const response = await apiClient.get<BlogsResponse>(`/blogs?authorId=${userId}`);
      return { posts: response.data.posts };
    } catch (error) {
      console.error(`Error fetching blogs for user ${userId}:`, error);
      throw error;
    }
  },

  getBlogsByCategory: async (categorySlug: string): Promise<{ posts: Blog[] }> => {
    try {
      const response = await apiClient.get<BlogsResponse>(`/blogs?category=${categorySlug}`);
      return { posts: response.data.posts };
    } catch (error) {
      console.error(`Error fetching blogs for category ${categorySlug}:`, error);
      throw error;
    }
  },

  createBlog: async (blogData: BlogPayload): Promise<{ success: boolean; post: Blog }> => {
    try {
      const response = await apiClient.post<{ success: true; post: Blog }>("/blogs", blogData);
      return response.data;
    } catch (error) {
      console.error("Error creating blog:", error);
      throw error;
    }
  },

  updateBlog: async (id: string, blogData: BlogPayload): Promise<{ success: boolean; post: Blog; message: string }> => {
    try {
      const response = await apiClient.put<UpdateBlogResponse>(`/blogs/${id}`, blogData);
      return response.data;
    } catch (error) {
      console.error(`Error updating blog with id ${id}:`, error);
      throw error;
    }
  },

  deleteBlog: async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.delete<{ success: true; message: string }>(`/blogs/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting blog with id ${id}:`, error);
      throw error;
    }
  },
};

// Category API
export const categoryApi = {
  getAllCategories: async (): Promise<{ categories: Category[] }> => {
    try {
      const response = await apiClient.get<CategoriesResponse>("/categories");
      return { categories: response.data.categories };
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  },

  getCategoryById: async (id: string): Promise<{ category: Category }> => {
    try {
      const response = await apiClient.get<CategoryResponse>(`/categories/${id}`);
      return { category: response.data.category };
    } catch (error) {
      console.error(`Error fetching category with id ${id}:`, error);
      throw error;
    }
  },

  createCategory: async (categoryData: { name: string; description?: string }): Promise<{ success: boolean; category: Category }> => {
    try {
      const response = await apiClient.post<{ success: true; category: Category }>("/categories", categoryData);
      return response.data;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },
};

// Auth-related API functions
export const authApi = {
  signup: async (userData: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user: User; token?: string }> => {
    try {
      const response = await apiClient.post("/auth/signup", userData);
      return response.data;
    } catch (error) {
      console.error("Error during signup:", error);
      throw error;
    }
  },

  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<{ user: User; token?: string }> => {
    try {
      const response = await apiClient.post("/auth/login", credentials);
      return response.data;
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  },

  getUserProfile: async (): Promise<User> => {
    try {
      const response = await apiClient.get("/auth/profile");
      return response.data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  },
};

// User-related API functions
export const userApi = {
  getUserById: async (id: string): Promise<UserProfileWithPosts> => {
    try {
      const response = await apiClient.get<UserProfileResponse>(`/users/${id}`);
      return response.data.user;
    } catch (error) {
      console.error(`Error fetching user with id ${id}:`, error);
      throw error;
    }
  },

  updateUser: async (id: string, userData: UpdateProfilePayload): Promise<UserProfileWithPosts> => {
    try {
      const response = await apiClient.put<UserProfileResponse>(`/users/${id}`, userData);
      return response.data.user;
    } catch (error) {
      console.error(`Error updating user with id ${id}:`, error);
      throw error;
    }
  },

  followUser: async (userId: string): Promise<FollowActionResponse> => {
    try {
      const response = await apiClient.post<FollowActionResponse>(`/users/${userId}/follow`);
      return response.data;
    } catch (error) {
      console.error(`Error following user ${userId}:`, error);
      throw error;
    }
  },

  unfollowUser: async (userId: string): Promise<FollowActionResponse> => {
    try {
      const response = await apiClient.delete<FollowActionResponse>(`/users/${userId}/follow`);
      return response.data;
    } catch (error) {
      console.error(`Error unfollowing user ${userId}:`, error);
      throw error;
    }
  },
};