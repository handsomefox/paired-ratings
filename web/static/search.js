(() => {
  const form = document.querySelector("[data-live-search]");
  const input = form?.querySelector('input[name="q"]');
  const results = document.querySelector("[data-results]");
  const resultsCount = document.querySelector("[data-results-count]");
  const sentinel = document.querySelector("[data-results-sentinel]");
  const filterForm = document.querySelector("[data-search-filters]");
  const filterToggle = document.querySelector("[data-filter-toggle]");
  const filterPanel = document.querySelector("[data-filters-panel]");
  const filterClose = document.querySelector("[data-filter-close]");
  if (!form || !input || !results) return;

  const imageBase = results.dataset.imageBase || "";
  let lastController = null;
  let debounceTimer = null;
  let currentPage = 1;
  let totalPages = 1;
  let currentQuery = "";
  let currentFilters = null;
  let currentKey = "";
  let loading = false;

  const openFilters = () => {
    filterPanel?.classList.add("is-open");
  };

  const closeFilters = () => {
    filterPanel?.classList.remove("is-open");
  };

  filterToggle?.addEventListener("click", openFilters);
  filterClose?.addEventListener("click", closeFilters);

  const setResultsCount = (query, count, hasFilters, total) => {
    if (!resultsCount) return;
    if (!query && !hasFilters) {
      resultsCount.textContent = "";
      return;
    }
    if (query) {
      if (total && total > count) {
        resultsCount.textContent = `Results for “${query}” (${count} / ${total})`;
      } else {
        resultsCount.textContent = `Results for “${query}” (${count})`;
      }
      return;
    }
    if (total && total > count) {
      resultsCount.textContent = `Results (${count} / ${total})`;
      return;
    }
    resultsCount.textContent = `Results (${count})`;
  };

  const getFilters = () => {
    if (!filterForm) {
      return {
        mediaType: "all",
        yearFrom: null,
        yearTo: null,
        minRating: null,
      };
    }
    const data = new FormData(filterForm);
    const parseNumber = (val) => {
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    return {
      mediaType: String(data.get("media_type") || "all"),
      yearFrom: parseNumber(data.get("year_from")),
      yearTo: parseNumber(data.get("year_to")),
      minRating: parseNumber(data.get("min_rating")),
      minVotes: parseNumber(data.get("min_votes")),
      sort: String(data.get("sort") || "relevance"),
    };
  };

  const hasActiveFilters = (filters) =>
    filters.mediaType !== "all" ||
    !!filters.yearFrom ||
    !!filters.yearTo ||
    !!filters.minRating ||
    !!filters.minVotes;

  const buildKey = (query, filters) =>
    JSON.stringify({
      q: query,
      mediaType: filters.mediaType,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      minRating: filters.minRating,
      minVotes: filters.minVotes,
      sort: filters.sort,
    });

  const countLoaded = () => results.querySelectorAll(".result-card").length;

  const renderResults = (items, append) => {
    if (!append) {
      results.textContent = "";
    }
    if (!items.length) {
      if (!append) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent =
          "No results yet. Try a different search or filters.";
        results.appendChild(empty);
      }
      return;
    }
    const createEl = (tag, className) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      return el;
    };
    const createAddForm = (item, status, label, secondary) => {
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/add";
      const inputID = document.createElement("input");
      inputID.type = "hidden";
      inputID.name = "tmdb_id";
      inputID.value = String(item.id || "");
      const inputMedia = document.createElement("input");
      inputMedia.type = "hidden";
      inputMedia.name = "media_type";
      inputMedia.value = String(item.media_type || "");
      const inputStatus = document.createElement("input");
      inputStatus.type = "hidden";
      inputStatus.name = "status";
      inputStatus.value = status;
      const button = document.createElement("button");
      button.type = "submit";
      button.textContent = label;
      if (secondary) button.className = "secondary";
      form.appendChild(inputID);
      form.appendChild(inputMedia);
      form.appendChild(inputStatus);
      form.appendChild(button);
      return form;
    };
    for (const item of items) {
      const mediaLabel = item.media_type === "movie" ? "Movie" : "TV";
      const card = createEl("div", "result-card");
      const posterWrap = createEl("div", "poster");
      if (item.poster_path) {
        const img = document.createElement("img");
        img.src = `${imageBase}${item.poster_path}`;
        img.alt = item.title || "";
        posterWrap.appendChild(img);
      } else {
        const placeholder = createEl("div", "poster-placeholder");
        placeholder.textContent = "No poster";
        posterWrap.appendChild(placeholder);
      }

      const body = createEl("div", "result-body");
      const titleRow = createEl("div", "result-title");
      const titleText = document.createElement("strong");
      titleText.textContent = item.title || "";
      titleRow.appendChild(titleText);
      if (item.year) {
        const year = createEl("span", "year");
        year.textContent = item.year;
        titleRow.appendChild(year);
      }
      body.appendChild(titleRow);

      const meta = createEl("div", "result-meta");
      meta.textContent = mediaLabel;
      body.appendChild(meta);

      if (item.vote_average && item.vote_average > 0) {
        const ratingChip = createEl("div", "rating-chip");
        ratingChip.append(
          document.createTextNode(`TMDB ${item.vote_average.toFixed(1)}`)
        );
        if (item.vote_count && item.vote_count > 0) {
          const votes = createEl("span", "votes");
          votes.textContent = `(${item.vote_count})`;
          ratingChip.appendChild(document.createTextNode(" "));
          ratingChip.appendChild(votes);
        }
        body.appendChild(ratingChip);
      }

      if (item.overview) {
        const overview = document.createElement("p");
        overview.textContent = item.overview;
        body.appendChild(overview);
      }

      if (item.in_library) {
        const inLibrary = createEl("div", "in-library");
        inLibrary.textContent = "In library";
        body.appendChild(inLibrary);
      } else {
        const actions = createEl("div", "actions");
        actions.appendChild(
          createAddForm(item, "planned", "Add planned", false)
        );
        actions.appendChild(
          createAddForm(item, "watched", "Add watched", true)
        );
        body.appendChild(actions);
      }

      card.appendChild(posterWrap);
      card.appendChild(body);
      results.appendChild(card);
    }
    results.classList.remove("jitter");
    void results.offsetHeight;
    results.classList.add("jitter");
  };

  const fetchResults = (query, filters, page) => {
    if (lastController) lastController.abort();
    lastController = new AbortController();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filters.mediaType && filters.mediaType !== "all") {
      params.set("media_type", filters.mediaType);
    }
    if (filters.yearFrom) params.set("year_from", String(filters.yearFrom));
    if (filters.yearTo) params.set("year_to", String(filters.yearTo));
    if (filters.minRating) params.set("min_rating", String(filters.minRating));
    if (filters.minVotes) params.set("min_votes", String(filters.minVotes));
    if (filters.sort && filters.sort !== "relevance") {
      params.set("sort", filters.sort);
    }
    if (page && page > 1) {
      params.set("page", String(page));
    }
    const endpoint = params.toString()
      ? `/api/search?${params.toString()}`
      : "/api/search";
    return fetch(endpoint, {
      signal: lastController.signal,
      headers: { Accept: "application/json" },
    }).then((res) => {
      if (!res.ok) throw new Error("search failed");
      return res.json();
    });
  };

  const loadPage = (query, filters, page, append) => {
    if (loading) return;
    loading = true;
    const key = currentKey;
    fetchResults(query, filters, page)
      .then((data) => {
        if (key !== currentKey) return;
        const payload = Array.isArray(data)
          ? {
              results: data,
              page: 1,
              total_pages: 1,
              total_results: data.length,
            }
          : data;
        const items = payload?.results || [];
        renderResults(items, append);
        currentPage = payload?.page || page;
        totalPages = payload?.total_pages || currentPage;
        const loaded = countLoaded();
        setResultsCount(
          query,
          loaded,
          hasActiveFilters(filters),
          payload?.total_results
        );
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error(err);
      })
      .finally(() => {
        loading = false;
      });
  };

  const handleInput = () => {
    const value = input.value.trim();
    const filters = getFilters();
    const hasFilters = hasActiveFilters(filters);
    clearTimeout(debounceTimer);
    if (!value && !hasFilters) {
      results.innerHTML = "";
      setResultsCount("", 0, false);
      currentPage = 1;
      totalPages = 1;
      currentQuery = "";
      currentFilters = null;
      currentKey = "";
      return;
    }
    const jitter = 80 + Math.floor(Math.random() * 120);
    debounceTimer = setTimeout(() => {
      currentQuery = value;
      currentFilters = filters;
      currentKey = buildKey(value, filters);
      currentPage = 1;
      totalPages = 1;
      loadPage(value, filters, 1, false);
    }, 200 + jitter);
  };

  filterForm?.addEventListener("input", handleInput);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFilters();
  });

  input.addEventListener("input", handleInput);
  if (input.value.trim()) {
    handleInput();
  }

  if (sentinel) {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!currentKey || loading) return;
        if (!currentFilters) return;
        if (currentPage >= totalPages) return;
        loadPage(currentQuery, currentFilters, currentPage + 1, true);
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(sentinel);
  }

  const params = new URLSearchParams(window.location.search);
  if (filterForm) {
    const mediaType = params.get("media_type");
    if (mediaType) {
      const select = filterForm.querySelector('select[name="media_type"]');
      if (select) select.value = mediaType;
    }
    const yearFrom = params.get("year_from");
    if (yearFrom) {
      const inputEl = filterForm.querySelector('input[name="year_from"]');
      if (inputEl) inputEl.value = yearFrom;
    }
    const yearTo = params.get("year_to");
    if (yearTo) {
      const inputEl = filterForm.querySelector('input[name="year_to"]');
      if (inputEl) inputEl.value = yearTo;
    }
    const minRating = params.get("min_rating");
    if (minRating) {
      const inputEl = filterForm.querySelector('input[name="min_rating"]');
      if (inputEl) inputEl.value = minRating;
    }
    const minVotes = params.get("min_votes");
    if (minVotes) {
      const inputEl = filterForm.querySelector('input[name="min_votes"]');
      if (inputEl) inputEl.value = minVotes;
    }
    const sort = params.get("sort");
    if (sort) {
      const select = filterForm.querySelector('select[name="sort"]');
      if (select) select.value = sort;
    }
  }
  if (!input.value.trim() && params.toString()) {
    handleInput();
  }
})();
