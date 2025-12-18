"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { blogApi } from "@/lib/data";
import { Blog } from "@/lib/types";
import Image from "next/image";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Custom debounce hook logic (simplified if hook doesn't exist, but I'll assume standard pattern or write useDebounce inline if needed)
  // Actually, I should check if use-debounce exists or just use useEffect with timeout.
  // I'll implement simple useEffect debounce here to be safe and dependency-free.
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { posts } = await blogApi.searchBlogs(debouncedQuery);
        setResults(posts || []);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (slug: string) => {
    router.push(`/blog/${slug}`);
    setShowResults(false);
    setQuery("");
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md hidden md:flex items-center"
    >
      <SearchIcon className="absolute left-3 w-4 h-4 text-muted-foreground z-10" />
      <Input
        placeholder="Search blogs..."
        className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-all"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
      />
      {isLoading && (
        <Loader2 className="absolute right-3 w-4 h-4 animate-spin text-muted-foreground" />
      )}

      {showResults && debouncedQuery.trim().length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-card rounded-lg shadow-lg border border-border overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
          {results.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto py-2">
              {results.map((post) => (
                <div
                  key={post.id}
                  onClick={() => handleSelect(post.slug)}
                  className="px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors group flex items-start gap-3"
                >
                  {post.coverImage && (
                    <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-muted">
                      {/* using standard img to avoid next/image config issues with external urls if not fully configured */}
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{post.author.name || "Anonymous"}</span>
                      <span>•</span>
                      <span>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {!isLoading ? "No results found" : "Searching..."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
