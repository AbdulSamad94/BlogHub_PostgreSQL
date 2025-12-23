import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FeaturedBlog } from "@/components/blog/featured-blog";
import { HeroSection } from "@/components/home/hero-section";
import { BlogGrid } from "@/components/home/blog-grid";
import { calculateReadTime, formatDate } from "@/lib/utils";
import { BlogService } from "@/lib/services/blogService";
import { HomeSkeleton } from "@/components/home/home-skeleton";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <HeroSection />

        <Suspense fallback={<HomeSkeleton />}>
          <HomeFeed />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

async function HomeFeed() {
  const posts = await BlogService.getAllPosts({ status: "published" });

  // Filter out any potential nulls if types are loose, though Service returns solid array
  const validPosts = posts || [];

  const featuredBlog = validPosts[0] || null;
  const otherBlogs = validPosts.slice(1);

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
          <BlogGrid blogs={otherBlogs} />
        </section>
      )}
    </>
  );
}
