import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ParentDashboard from "./ParentDashboard";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/childProfilesApi", () => ({
  useChildren: vi.fn(() => ({ data: [{ id: "child-1", name: "Ali", age: 7 }], isLoading: false })),
  getActiveChildId: vi.fn(() => "child-1"),
  setActiveChildId: vi.fn(),
}));

vi.mock("@/lib/parentApi", () => ({
  useBedtimeSchedules: vi.fn(() => ({ data: [] })),
  useUpsertSchedule: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
  useDeleteSchedule: vi.fn(() => ({ mutate: vi.fn() })),
  useChildStats: vi.fn(() => ({
    data: {
      totalStories: 2,
      completedCount: 1,
      generatingCount: 0,
      failedCount: 1,
      recentTitles: [
        { id: "s1", title: "Story about Space", created_at: "2023-01-01T00:00:00Z", status: "generated" },
        { id: "s2", title: "Story about Cats", created_at: "2023-01-02T00:00:00Z", status: "failed" },
      ],
      skillCounts: { "Empathy": 2 },
    },
  })),
  useFavoriteStories: vi.fn(() => ({
    favorites: ["s1"],
    toggleFavorite: vi.fn(),
    isFavorite: (id: string) => id === "s1",
  })),
}));

vi.mock("@/api/stories.api", () => ({
  storiesApi: {
    retryStory: vi.fn(),
    deleteStory: vi.fn(),
  },
}));

const queryClient = new QueryClient();

describe("ParentDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ParentDashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it("renders child profile correctly", () => {
    renderComponent();
    expect(screen.getByText("Ali · 7")).toBeInTheDocument();
  });

  it("renders stat cards correctly", () => {
    renderComponent();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    const values = screen.getAllByText(/^[0-9]+$/).map((el) => el.textContent);
    expect(values).toContain("2");
    expect(values).toContain("1");
    expect(values).toContain("0");
    expect(values.filter((v) => v === "1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders recent stories with correct statuses", () => {
    renderComponent();
    expect(screen.getByText("Story about Space")).toBeInTheDocument();
    expect(screen.getByText("Story about Cats")).toBeInTheDocument();
    expect(screen.getByText("Ready to read")).toBeInTheDocument();
    expect(screen.getByText("Needs retry")).toBeInTheDocument();
  });

  it("shows action buttons depending on status", () => {
    renderComponent();
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
