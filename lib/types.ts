// Frontend-specific types that may include additional fields or transformations
export interface Author {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  createdAt: string | Date;
  author: Author;
  likeCount: number;
  hasLiked?: boolean;
  postCategories?: Array<{
    category: Category;
  }>;
}

// BlogCard specific props
export interface BlogCardProps {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  authorId: string; // Added for profile linking
  date: string;
  tags: string[];
  coverImage: string;
  readTime: number;
}

// FeaturedBlog specific props
export interface FeaturedBlogProps {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  authorId: string; // Added for profile linking
  date: string;
  tags: string[];
  coverImage: string;
  readTime: number;
}

// BlogCoverImage specific props
export interface BlogCoverImageProps {
  src: string | null;
  alt: string;
  aspect?: "video" | "square" | "landscape";
  className?: string;
  priority?: boolean;
}

// BlogContent specific props
export interface BlogContentProps {
  content: string;
  className?: string;
}

// BlogMetadata specific props
export interface BlogMetadataProps {
  authorName: string | null;
  authorEmail: string;
  authorImage: string | null;
  authorId: string; // Added for profile linking
  createdAt: string;
  readTime: number;
  className?: string;
}

// BlogTags specific props
export interface BlogTagsProps {
  tags: string[];
  className?: string;
  variant?: "default" | "featured";
}

// Common state types
export interface BlogState {
  blogs: Blog[];
  loading: boolean;
  error: string | null;
}

// Common form types
export interface BlogFormData {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  coverImageFile: File | null;
  status: "draft" | "published";
}

// Validation types (can be imported from validation files if needed)
export type CreateBlogInput = {
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  status: "draft" | "published";
};

// RichTextEditor specific props
export interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
}

// Common form state types
export interface WithSavingState {
  saving: boolean;
}

export interface WithErrorState {
  error: string | null;
  setError: (error: string | null) => void;
}

export interface WithPreviewState {
  preview: boolean;
  setPreview: (preview: boolean) => void;
}

export interface EditBlogFormState {
  title: string;
  setTitle: (title: string) => void;
  excerpt: string;
  setExcerpt: (excerpt: string) => void;
  content: string;
  setContent: (content: string) => void;
  coverImage: string | null;
  setCoverImage: (coverImage: string | null) => void;
  tags: string;
  setTags: (tags: string) => void;
  preview: boolean;
  setPreview: (preview: boolean) => void;
  saving: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string | Date;
}

export type BlogPayload = {
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string | null;
  status?: "draft" | "published";
  coverImageBase64?: string;
  coverImageType?: string;
  categoryIds?: string[];
};

// ==================== USER PROFILE TYPES ====================

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string;
  followerCount: number;
  followingCount: number;
  createdAt: string;
  isFollowing?: boolean; // For the current user's perspective
}

export interface UserProfileWithPosts extends UserProfile {
  posts: Blog[];
}

export interface UpdateProfilePayload {
  name?: string;
  bio?: string;
  image?: string;
}

export interface FollowActionResponse {
  success: boolean;
  isFollowing: boolean;
  followerCount: number;
}

export interface UserProfileState {
  profile: UserProfileWithPosts | null;
  loading: boolean;
  error: string | null;
}