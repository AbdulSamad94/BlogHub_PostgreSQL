// Mock external modules before importing
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/services/blogService", () => ({
  BlogService: {
    createPost: jest.fn(),
    getAllPosts: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: jest.fn(),
      },
      posts: {
        findMany: jest.fn(),
      },
    },
  },
}));

jest.mock('@/lib/validations/blog', () => ({
  createPostSchema: {
    parse: jest.fn(),
  },
}));

import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { BlogService } from "@/lib/services/blogService";
import { createPostSchema } from '@/lib/validations/blog';
import { ZodError } from 'zod';

describe('Blogs API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/blogs', () => {
    test('returns 401 if user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = {
        json: jest.fn().mockResolvedValue({}),
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseJson = await response.json();

      expect(response.status).toBe(401);
      expect(responseJson.error).toBe('Unauthorized');
    });

    test('creates a new blog post successfully via Service', async () => {
      // Mock validation
      (createPostSchema.parse as jest.Mock).mockImplementation((data) => data);

      // Mock session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      // Mock user lookup
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      });

      // Mock Service Success
      const mockPost = { id: '1', title: 'Test Blog', slug: 'test-blog' };
      (BlogService.createPost as jest.Mock).mockResolvedValue(mockPost);

      const request = {
        json: jest.fn().mockResolvedValue({
          title: 'Test Blog',
          content: '<p>Test content</p>',
          status: 'draft',
        }),
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseJson = await response.json();

      expect(response.status).toBe(200);
      expect(responseJson.success).toBe(true);
      expect(responseJson.post).toEqual(mockPost);

      // Verify service was called with correct params
      expect(BlogService.createPost).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Blog',
        authorId: '1',
      }));
    });

    test('returns 400 if validation fails', async () => {
      // Suppress console.error for this expected error test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        id: '1',
      });

      // Mock validation to throw real ZodError
      (createPostSchema.parse as jest.Mock).mockImplementation(() => {
        throw new ZodError([]);
      });

      const request = {
        json: jest.fn().mockResolvedValue({
          title: '', // Invalid
        }),
      } as unknown as NextRequest;

      const response = await POST(request);
      const responseJson = await response.json();

      expect(response.status).toBe(400);
      expect(responseJson.error).toBe('Validation failed');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /api/blogs', () => {
    test('returns all published blog posts using Service', async () => {
      const mockPosts = [{ id: '1', title: 'Test' }];
      (BlogService.getAllPosts as jest.Mock).mockResolvedValue(mockPosts);

      const request = {
        url: 'http://localhost:3000/api/blogs',
      } as unknown as NextRequest;

      const response = await GET(request);
      const responseJson = await response.json();

      expect(response.status).toBe(200);
      expect(responseJson.posts).toEqual(mockPosts);
      expect(BlogService.getAllPosts).toHaveBeenCalledWith({
        status: undefined,
        authorId: undefined,
        categorySlug: undefined
      });
    });
  });
});