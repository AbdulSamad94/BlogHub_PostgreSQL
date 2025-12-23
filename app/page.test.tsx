import { render, screen } from "@testing-library/react";
import Home from "./page";

// Mock child components to isolate Home testing
jest.mock("@/components/navbar", () => ({
  Navbar: () => <nav>Navbar</nav>,
}));
jest.mock("@/components/footer", () => ({
  Footer: () => <footer>Footer</footer>,
}));
jest.mock("@/components/home/hero-section", () => ({
  HeroSection: () => <div>Discover Stories Worth Reading</div>,
}));
jest.mock("@/components/home/home-skeleton", () => ({
  HomeSkeleton: () => <div data-testid="home-skeleton">Home Skeleton</div>,
}));

// Crucial: Mock HomeFeed as a synchronous component
// This bypasses the async/await complexity in JSDOM testing for Server Components
jest.mock("@/components/home/home-feed", () => ({
  HomeFeed: () => (
    <div data-testid="home-feed-content">
      <div data-testid="featured-blog">First Blog</div>
      <div data-testid="blog-card">Second Blog</div>
    </div>
  ),
}));

// Simple Suspense Mock
jest.mock("react", () => {
  const original = jest.requireActual("react");
  return {
    ...original,
    Suspense: ({ children, fallback }: any) => {
      return (
        <>
          {fallback}
          {children}
        </>
      );
    },
  };
});

describe("Home Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders layout elements correctly", () => {
    render(<Home />);

    expect(screen.getByText("Navbar")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
    expect(
      screen.getByText("Discover Stories Worth Reading")
    ).toBeInTheDocument();
  });

  test("renders home feed content", () => {
    // Since we mock HomeFeed to just render, we simply check it appears.
    render(<Home />);

    expect(screen.getByTestId("home-feed-content")).toBeInTheDocument();
  });
});
