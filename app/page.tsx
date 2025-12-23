import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/home/hero-section";
import { HomeSkeleton } from "@/components/home/home-skeleton";
import { HomeFeed } from "@/components/home/home-feed";

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
