
import { GET } from './route';
import { NextRequest } from 'next/server';
import { BlogService } from "@/lib/services/blogService";

jest.mock("@/lib/services/blogService", () => ({
    BlogService: {
        getAllPosts: jest.fn(),
    },
}));

describe('GET /api/blogs Search', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('passes search query to BlogService', async () => {
        (BlogService.getAllPosts as jest.Mock).mockResolvedValue([]);

        const request = {
            url: 'http://localhost:3000/api/blogs?search=testing',
            searchParams: new URLSearchParams('search=testing'),
        } as unknown as NextRequest;

        // Note: In the actual route, we do new URL(req.url).
        // Mocking NextRequest to work with that:
        const realRequest = new Request('http://localhost:3000/api/blogs?search=testing');

        await GET(realRequest);

        expect(BlogService.getAllPosts).toHaveBeenCalledWith(expect.objectContaining({
            search: 'testing'
        }));
    });
});
