import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    pgEnum,
    integer,
    uniqueIndex,
    index,
    foreignKey
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "published"]);

// Users Table
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }),
    email: varchar("email", { length: 100 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    image: text("image"),
    provider: varchar("provider", { length: 50 }).notNull().default("credentials"),
    providerAccountId: varchar("provider_account_id", { length: 100 }),
    role: roleEnum("role").default("user").notNull(),
    bio: text("bio").default("Hey there! I'm new on BlogHub").notNull(),
    followerCount: integer("follower_count").default(0).notNull(),
    followingCount: integer("following_count").default(0).notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at")
        .default(sql`CURRENT_TIMESTAMP`)
        .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

// Posts Table
export const posts = pgTable("posts", {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    coverImage: text("cover_image"),
    status: postStatusEnum("status").default("draft").notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    commentCount: integer("comment_count").default(0).notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at")
        .default(sql`CURRENT_TIMESTAMP`)
        .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
}, (table) => [
    uniqueIndex("posts_slug_idx").on(table.slug),
    index("posts_author_idx").on(table.authorId),
]);

// Categories Table
export const categories = pgTable("categories", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
    uniqueIndex("categories_slug_idx").on(table.slug),
]);

// Post-Categories Junction Table
export const postCategories = pgTable("post_categories", {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
    uniqueIndex("post_categories_post_category_idx").on(table.postId, table.categoryId),
]);

// Comments Table (with nested replies support)
export const comments = pgTable("comments", {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id"),
    content: text("content").notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at")
        .default(sql`CURRENT_TIMESTAMP`)
        .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    postIdx: index("comments_post_idx").on(table.postId),
    authorIdx: index("comments_author_idx").on(table.authorId),
    parentFk: foreignKey({
        columns: [table.parentCommentId],
        foreignColumns: [table.id],
        name: "comments_parent_comment_id_fk"
    }).onDelete("cascade"),
}));

// Post Likes Table
export const postLikes = pgTable("post_likes", {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
    uniqueIndex("post_likes_post_user_idx").on(table.postId, table.userId),
]);

// Comment Likes Table
export const commentLikes = pgTable("comment_likes", {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
    uniqueIndex("comment_likes_comment_user_idx").on(table.commentId, table.userId),
]);

// Follows Table (user following)
export const follows = pgTable("follows", {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
    uniqueIndex("follows_follower_following_idx").on(table.followerId, table.followingId),
]);

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
    posts: many(posts),
    comments: many(comments),
    postLikes: many(postLikes),
    commentLikes: many(commentLikes),
    followers: many(follows, { relationName: "following" }),
    following: many(follows, { relationName: "follower" }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
    author: one(users, {
        fields: [posts.authorId],
        references: [users.id],
    }),
    comments: many(comments),
    postCategories: many(postCategories),
    likes: many(postLikes),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
    postCategories: many(postCategories),
}));

export const postCategoriesRelations = relations(postCategories, ({ one }) => ({
    post: one(posts, {
        fields: [postCategories.postId],
        references: [posts.id],
    }),
    category: one(categories, {
        fields: [postCategories.categoryId],
        references: [categories.id],
    }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
    post: one(posts, {
        fields: [comments.postId],
        references: [posts.id],
    }),
    author: one(users, {
        fields: [comments.authorId],
        references: [users.id],
    }),
    parentComment: one(comments, {
        fields: [comments.parentCommentId],
        references: [comments.id],
        relationName: "replies",
    }),
    replies: many(comments, { relationName: "replies" }),
    likes: many(commentLikes),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
    post: one(posts, {
        fields: [postLikes.postId],
        references: [posts.id],
    }),
    user: one(users, {
        fields: [postLikes.userId],
        references: [users.id],
    }),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
    comment: one(comments, {
        fields: [commentLikes.commentId],
        references: [comments.id],
    }),
    user: one(users, {
        fields: [commentLikes.userId],
        references: [users.id],
    }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
    follower: one(users, {
        fields: [follows.followerId],
        references: [users.id],
        relationName: "follower",
    }),
    following: one(users, {
        fields: [follows.followingId],
        references: [users.id],
        relationName: "following",
    }),
}));

// ==================== TYPE EXPORTS ====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type PostCategory = typeof postCategories.$inferSelect;
export type NewPostCategory = typeof postCategories.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type NewPostLike = typeof postLikes.$inferInsert;
export type CommentLike = typeof commentLikes.$inferSelect;
export type NewCommentLike = typeof commentLikes.$inferInsert;
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;