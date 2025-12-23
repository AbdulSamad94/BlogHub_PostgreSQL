"use client";

import { motion } from "framer-motion";
import { BlogCard } from "@/components/blog/blog-card";
import { BlogCardProps } from "@/lib/types";

export function BlogGrid({ blogs }: { blogs: BlogCardProps[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {blogs.map((blog, index) => (
        <motion.div
          key={blog.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <BlogCard {...blog} />
        </motion.div>
      ))}
    </div>
  );
}
