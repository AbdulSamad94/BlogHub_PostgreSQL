import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { NextAuthOptions } from "next-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { UserService } from "@/lib/services/userService";

const DEFAULT_PROFILE_IMAGE = "/default-profile.jpeg";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await db.query.users.findFirst({
                    where: eq(users.email, credentials.email),
                });

                // Check if user exists and has a password (credentials user)
                if (!user || !user.passwordHash) return null;

                const isValid = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                );

                if (!isValid) return null;

                return {
                    id: user.id,
                    name: user.name ?? "Unnamed User",
                    email: user.email,
                    image: user.image ?? DEFAULT_PROFILE_IMAGE,
                };
            },
        }),
    ],

    session: {
        strategy: "jwt",
    },
    jwt: {
        secret: process.env.NEXTAUTH_SECRET,
    },

    callbacks: {
        async signIn({ user, account }) {
            if (!user?.email) return false;

            if (account?.provider === "google" || account?.provider === "github") {
                const isSuccess = await UserService.handleOauthUser(
                    { email: user.email, name: user.name || "Unnamed User", image: user.image || undefined },
                    { provider: account.provider, providerAccountId: account.providerAccountId || "" }
                );
                return isSuccess;
            }

            return true;
        },

        async jwt({ token, user }) {
            // When user first logs in (new session)
            if (user) {
                const dbUser = await db.query.users.findFirst({
                    where: eq(users.email, user.email!),
                });

                if (dbUser) {
                    token.id = dbUser.id; // Use DB UUID
                    token.name = dbUser.name ?? "Unnamed User";
                    token.email = dbUser.email;
                    token.image = dbUser.image ?? DEFAULT_PROFILE_IMAGE;
                } else {
                    // Fallback (shouldn’t happen)
                    token.id = user.id;
                    token.name = user.name ?? "Unnamed User";
                    token.email = user.email;
                    token.image = user.image ?? DEFAULT_PROFILE_IMAGE;
                }
            }

            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string;
                session.user.email = token.email as string;
                session.user.image = token.image as string;
            }
            return session;
        },
    },


    pages: {
        signIn: "/login",
    },
};