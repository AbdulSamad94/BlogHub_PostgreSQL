import { FeaturedBlog } from "@/components/blog/featured-blog";
import { BlogGrid } from "@/components/home/blog-grid";
import { calculateReadTime, formatDate } from "@/lib/utils";
import { BlogService } from "@/lib/services/blogService";

export async function HomeFeed() {
  const posts = await BlogService.getAllPosts({ status: "published" });

  // Filter out any potential nulls if types are loose, though Service returns solid array
  const validPosts = posts || [];

  const featuredBlog = validPosts[0] || null;
  const otherBlogs = validPosts.slice(1);

  const otherBlogsProps = otherBlogs.map((blog) => ({
    id: blog.slug,
    title: blog.title,
    excerpt:
      blog.excerpt ||
      blog.content.replace(/<[^>]*>/g, "").substring(0, 150) + "...",
    author: blog.author.name || "Anonymous",
    authorId: blog.author.id,
    date: formatDate(blog.createdAt),
    tags: blog.postCategories?.map((pc) => pc.category.name) || [],
    coverImage: blog.coverImage || "/placeholder.svg?height=400&width=600",
    readTime: calculateReadTime(blog.content),
  }));

  return (
    <>
      {/* Featured Blog */}
      {featuredBlog && (
        <section className="mb-20">
          <FeaturedBlog
            id={featuredBlog.slug}
            title={featuredBlog.title}
            excerpt={
              featuredBlog.excerpt ||
              featuredBlog.content.replace(/<[^>]*>/g, "").substring(0, 200) +
                "..."
            }
            author={featuredBlog.author.name || "Anonymous"}
            authorId={featuredBlog.author.id}
            date={formatDate(featuredBlog.createdAt)}
            tags={
              featuredBlog.postCategories?.map((pc) => pc.category.name) || []
            }
            coverImage={
              featuredBlog.coverImage || "/placeholder.svg?height=400&width=800"
            }
            readTime={calculateReadTime(featuredBlog.content)}
          />
        </section>
      )}

      {/* Latest Articles */}
      {otherBlogs.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-8">Latest Articles</h2>
          <BlogGrid blogs={otherBlogsProps} />
        </section>
      )}
    </>
  );
}
