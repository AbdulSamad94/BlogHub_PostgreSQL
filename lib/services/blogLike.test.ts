
import { BlogService } from "./blogService";
import { db } from "@/lib/db";
import { posts, postLikes } from "@/lib/db/schema/schema";

jest.mock("@/lib/db", () => {
    const mockDbImpl: any = {
        insert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        query: {
            posts: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            postLikes: {
                findFirst: jest.fn(),
            }
        },
        execute: jest.fn(),
    };

    mockDbImpl.transaction = jest.fn(async (callback: any) => callback(mockDbImpl));

    return {
        db: mockDbImpl,
    };
});

jest.mock("@/lib/cloudinary", () => ({
    uploadImageToCloudinary: jest.fn(),
}));

describe("BlogService Like Features", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("likePost", () => {
        it("should like a post if not already liked", async () => {
            const userId = "user-1";
            const postId = "post-1";

            // Mock not liked yet
            (db.query.postLikes.findFirst as jest.Mock).mockResolvedValue(null);

            // Mock insert returns
            const mockValues = jest.fn().mockResolvedValue([]);
            (db.insert as jest.Mock).mockReturnValue({ values: mockValues });

            // Mock update returns
            const mockSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
            (db.update as jest.Mock).mockReturnValue({ set: mockSet });

            await BlogService.likePost(userId, postId);

            // Verify check
            expect(db.query.postLikes.findFirst).toHaveBeenCalled();

            // Verify insert
            expect(db.insert).toHaveBeenCalledWith(postLikes);
            expect(mockValues).toHaveBeenCalledWith({
                postId,
                userId,
                createdAt: expect.any(Date)
            });

            // Verify update count
            expect(db.update).toHaveBeenCalledWith(posts);
            expect(mockSet).toHaveBeenCalled(); // checks update was called
        });

        it("should NOOP if already liked", async () => {
            const userId = "user-1";
            const postId = "post-1";

            // Mock ALREADY liked
            (db.query.postLikes.findFirst as jest.Mock).mockResolvedValue({ id: "like-1" });

            await BlogService.likePost(userId, postId);

            // Verify no insert
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe("unlikePost", () => {
        it("should unlike a post if liked", async () => {
            const userId = "user-1";
            const postId = "post-1";

            // Mock delete returning the deleted row
            const mockReturning = jest.fn().mockResolvedValue([{ id: "like-1" }]);
            const mockWhere = jest.fn().mockReturnValue({ returning: mockReturning });
            (db.delete as jest.Mock).mockReturnValue({ where: mockWhere });

            // Mock update
            const mockSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
            (db.update as jest.Mock).mockReturnValue({ set: mockSet });

            await BlogService.unlikePost(userId, postId);

            // Verify delete
            expect(db.delete).toHaveBeenCalledWith(postLikes);

            // Verify count update (should happen because delete returned row)
            expect(db.update).toHaveBeenCalledWith(posts);
        });

        it("should not update count if not liked (delete returns empty)", async () => {
            const userId = "user-1";
            const postId = "post-1";

            // Mock delete returning EMPTY array
            const mockReturning = jest.fn().mockResolvedValue([]);
            const mockWhere = jest.fn().mockReturnValue({ returning: mockReturning });
            (db.delete as jest.Mock).mockReturnValue({ where: mockWhere });

            await BlogService.unlikePost(userId, postId);

            // Verify delete
            expect(db.delete).toHaveBeenCalledWith(postLikes);

            // Verify NO count update
            expect(db.update).not.toHaveBeenCalled();
        });
    });

    describe("getPostLikeStatus", () => {
        it("should return like count and hasLiked=false if public", async () => {
            const postId = "post-1";
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue({ likeCount: 5 });

            const result = await BlogService.getPostLikeStatus(postId);

            expect(result.likeCount).toBe(5);
            expect(result.hasLiked).toBe(false);
            expect(db.query.postLikes.findFirst).not.toHaveBeenCalled();
        });

        it("should return like count and hasLiked=true if user liked", async () => {
            const postId = "post-1";
            const userId = "user-1";
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue({ likeCount: 5 });
            (db.query.postLikes.findFirst as jest.Mock).mockResolvedValue({ id: "like-1" });

            const result = await BlogService.getPostLikeStatus(postId, userId);

            expect(result.likeCount).toBe(5);
            expect(result.hasLiked).toBe(true);
            expect(db.query.postLikes.findFirst).toHaveBeenCalled();
        });
    });

    describe("getPostBySlug with Like Status", () => {
        it("should return hasLiked=true if user is provided and has liked", async () => {
            const userId = "user-1";
            const slug = "test-post";

            // Mock post find
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue({ id: "post-1", slug, likeCount: 2 });
            // Mock like find
            (db.query.postLikes.findFirst as jest.Mock).mockResolvedValue({ id: "like-1" });

            const result = await BlogService.getPostBySlug(slug, userId);

            expect(result).not.toBeNull();
            expect(result!.hasLiked).toBe(true);
        });

        it("should return hasLiked=false if user is provided but has NOT liked", async () => {
            const userId = "user-1";
            const slug = "test-post";

            // Mock post find
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue({ id: "post-1", slug, likeCount: 2 });
            // Mock like find (null)
            (db.query.postLikes.findFirst as jest.Mock).mockResolvedValue(null);

            const result = await BlogService.getPostBySlug(slug, userId);

            expect(result).not.toBeNull();
            expect(result!.hasLiked).toBe(false);
        });
    });
});
