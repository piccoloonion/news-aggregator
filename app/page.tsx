"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Category, NewsState } from "@/types/news";
import { MainLayout } from "@/components/layout/main-layout";
import { NewsGrid } from "@/components/news-grid";

export default function HomePage() {
  const [category, setCategory] = useState<Category>("global");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [state, setState] = useState<NewsState>({
    articles: [],
    loading: true,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNews = useCallback(async (cat: Category) => {
    setState({ articles: [], loading: true, error: null });
    try {
      const params = new URLSearchParams({ category: cat });
      const response = await fetch("/api/news?" + params.toString());

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch news");
      }

      const data = await response.json();
      setState({ articles: data.articles || [], loading: false, error: null });
    } catch (err) {
      setState({
        articles: [],
        loading: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    }
  }, []);

  useEffect(() => {
    fetchNews(category);
  }, [category, fetchNews]);

  // Debounced search
  const onSearchChange = (query: string) => {
    setSearchQuery(query);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(query);
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Client-side search filter
  const filteredArticles = debouncedSearch
    ? state.articles.filter(
        (a) =>
          a.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (a.description &&
            a.description.toLowerCase().includes(debouncedSearch.toLowerCase()))
      )
    : state.articles;

  return (
    <MainLayout
      category={category}
      searchQuery={searchQuery}
      onCategoryChange={(cat) => {
        setCategory(cat);
        setSearchQuery("");
        setDebouncedSearch("");
      }}
      onSearchChange={onSearchChange}
    >
      <NewsGrid
        articles={filteredArticles}
        loading={state.loading}
        error={state.error}
        onRetry={() => fetchNews(category)}
        searchQuery={debouncedSearch}
      />
    </MainLayout>
  );
}
