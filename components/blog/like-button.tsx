"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { blogApi } from "@/lib/data";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LikeButtonProps {
  postId: string;
  initialLikeCount?: number;
  initialHasLiked?: boolean;
}

export function LikeButton({
  postId,
  initialLikeCount = 0,
  initialHasLiked,
}: LikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [hasLiked, setHasLiked] = useState(initialHasLiked ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  // Fetch initial status ONLY if not provided (fallback)
  useEffect(() => {
    // If we have initial data (which we should from server), don't re-fetch immediately
    if (initialHasLiked !== undefined) return;

    let isMounted = true;
    async function fetchStatus() {
      try {
        const status = await blogApi.getPostLikeStatus(postId);
        if (isMounted) {
          setLikeCount(status.likeCount);
          setHasLiked(status.hasLiked);
        }
      } catch (error) {
        console.error("Failed to fetch like status", error);
      }
    }
    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, [postId, initialHasLiked, session?.user?.id]);

  const handleToggleLike = async () => {
    if (!session) {
      toast.error("Please sign in to like posts");
      router.push("/login?callbackUrl=" + window.location.pathname);
      return;
    }

    if (isLoading) return;

    // Optimistic Update
    const previousHasLiked = hasLiked;
    const previousLikeCount = likeCount;

    setHasLiked(!previousHasLiked);
    setLikeCount((prev) => (previousHasLiked ? prev - 1 : prev + 1));
    setIsLoading(true);

    try {
      if (previousHasLiked) {
        await blogApi.unlikePost(postId);
      } else {
        await blogApi.likePost(postId);
      }
    } catch (error) {
      // Revert optimistic update
      setHasLiked(previousHasLiked);
      setLikeCount(previousLikeCount);
      toast.error("Failed to update like status");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggleLike}
      disabled={isLoading}
      className={cn(
        "gap-2 shrink-0 transition-colors",
        hasLiked && "text-red-500 hover:text-red-600 hover:bg-red-50"
      )}
      aria-label={hasLiked ? "Unlike post" : "Like post"}
    >
      <Heart className={cn("w-5 h-5", hasLiked && "fill-current")} />
      <span>{likeCount}</span>
    </Button>
  );
}
