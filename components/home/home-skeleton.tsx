"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { BlogCardSkeleton } from "@/components/blog/blog-card-skeleton";

export function HomeSkeleton() {
  return (
    <div className="space-y-20">
      {/* Featured Blog Skeleton - mimics FeaturedBlog component */}
      <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
        {/* Cover Image */}
        <div className="aspect-video w-full rounded-lg overflow-hidden relative">
          <Skeleton className="absolute inset-0 w-full h-full" />
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div className="space-y-4">
            {/* Tags */}
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            {/* Title */}
            <div className="space-y-2">
              <Skeleton className="h-10 w-[90%]" />
              <Skeleton className="h-10 w-[70%]" />
            </div>
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 pt-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="w-1 h-1 rounded-full bg-border" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="w-1 h-1 rounded-full bg-border" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Button */}
          <Skeleton className="h-10 w-32 rounded-md mt-4" />
        </div>
      </div>

      {/* Latest Articles Skeleton */}
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <BlogCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
