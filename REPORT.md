# Stock Listing Endpoint Design Report

## 1. Overview

This report details the design and implementation choices for the `/stocks` endpoint, which is responsible for listing all available financial stocks. The primary goal is to provide a highly performant, reliable, and "production-ready" solution despite interacting with a potentially unreliable external stock vendor API with specific data freshness requirements.

---

## 2. Why NestJS?

NestJS was chosen as the primary framework for this project due to its:

* **Architectural Clarity:** NestJS promotes a modular, scalable, and easily maintainable application structure inspired by Angular, using decorators, modules, and providers. This leads to cleaner code separation and better organization.
* **Built-in Features:** It comes with robust built-in modules for HTTP (via `HttpModule`), caching (`CacheModule`), and scheduling (`ScheduleModule`), significantly accelerating development and providing battle-tested solutions for common enterprise needs.
* **TypeScript Support:** Being built with TypeScript, it offers strong typing, improving code quality, readability, and reducing runtime errors, which is crucial for a financial application.
* **Dependency Injection:** Its powerful dependency injection system simplifies testing and managing application components.

---

## 3. Addressing the Core Challenges: Vendor Unreliability & Data Freshness

The external stock vendor API presents two significant challenges:

* **Vendor Unreliability:** The vendor is stated to be "not reliable 100% all the time." Direct, synchronous calls to such a vendor could lead to poor user experience (high latency, errors) if the vendor is slow or down.
* **Data Freshness Requirement:** Stock prices change every 5 minutes, implying a need for frequent data updates.
* **Paginating Vendor API:** The vendor's `/stocks` endpoint requires pagination, even potentially looping on the last page's `nextToken`.

---

## 4. Solution: Proactive Caching with Cron Jobs

To mitigate vendor unreliability and ensure data freshness, a robust caching strategy was implemented using NestJS's `CacheModule` and `ScheduleModule`.

**Decision:** Implement a **proactive caching (pre-fetching)** strategy using an in-memory cache managed by `cache-manager` and scheduled tasks (cron jobs).

**How it Works:**

* **`_fetchAndCacheAllStocksFromVendor()` (Private Method):** This core method is responsible for:
    * Interacting with the external vendor's paginated `/stocks` endpoint, handling the `nextToken` logic (including detection of repeated tokens to prevent infinite loops).
    * Consolidating all retrieved stock items from all pages.
    * **Storing each `StockItem` individually** in the cache (e.g., using `stock:SYMBOL` as the key) with a specified Time-To-Live (TTL, defaulting to 5 minutes) reflecting data freshness.
    * **Storing a global list of all stock symbols** (e.g., `all_stocks_symbols_list`) in the cache, serving as an index for quick retrieval of all currently known stocks.
* **Cron Job (`handleCronStockRefresh()`):**
    * Decorated with `@Cron(CronExpression.EVERY_5_MINUTES)`, this method is automatically invoked by NestJS's scheduler every 5 minutes.
    * Its sole purpose is to call `_fetchAndCacheAllStocksFromVendor()`, thus ensuring the entire stock cache is **proactively updated and kept "hot"** in the background.
    * An `onModuleInit` hook also triggers an initial fetch to populate the cache immediately on application startup.

**Advantages of Proactive Caching (vs. Lazy/On-Demand Caching):**

* **Reduced User-Facing Latency:** Users requesting stock data will almost always receive it instantly from the cache, as updates occur in the background.
* **Vendor Unreliability Isolation:** Failures or slowness from the external vendor during a cron job execution will primarily affect the cache's freshness, not directly impact the user's request. The user will still receive the most recently available data from the cache.
* **Predictable Vendor Load:** API calls to the vendor are evenly distributed by the cron job, avoiding sudden spikes in load on the vendor's side that could occur with purely on-demand fetching after cache expiry.
* **Improved User Experience:** Consistent, fast responses lead to a smoother and more reliable application for the end-user.

**Disadvantages of Proactive Caching:**

* **Background Resource Consumption:** The system will periodically make calls to the vendor and process data even if there's no active user traffic, consuming some network and processing resources. For very low-traffic APIs, this might seem inefficient, but the benefits for reliability and user experience often outweigh this.
* **Slightly Higher Initial Complexity:** Requires setting up a scheduling module and managing background tasks.

---

## 5. API Pagination for the `/stocks` Endpoint

While the internal caching fetches all stocks, directly returning thousands of items in a single API response is not scalable or efficient for web applications.

**Decision:** Implement **internal pagination** for the public `/stocks` endpoint.

**How it Works (`getAllStocks(page, limit)`):**

* This public method now accepts `page` and `limit` query parameters.
* It first attempts to retrieve the `all_stocks_symbols_list` from the cache.
* If the cache is cold or incomplete, it transparently triggers `_fetchAndCacheAllStocksFromVendor()` to refresh it.
* Once the complete list of symbols is available in memory/cache, it **applies pagination logic locally** (slicing the array of symbols based on `page` and `limit`).
* It then retrieves only the `StockItem` objects corresponding to the current page's symbols from the individual stock cache entries.
* The API returns a structured `PaginatedStocksResponse` object, including `items` for the current page, `total` items, `page` number, `limit`, and `totalPages`.

**Advantages of Internal Pagination (vs. Returning All Stocks):**

* **Scalability for Large Datasets:** The API can effectively handle an increasing number of stocks (even if it grows beyond the current ~50) without degrading performance. Only a small subset of data is transmitted per request.
* **Optimized Network Bandwidth:** Reduces the data transfer size, leading to faster response times, especially for mobile users or those with slower internet connections.
* **Improved Client-Side Performance:** Frontend applications do not have to parse and render massive JSON payloads, resulting in a more responsive user interface.
* **Professional API Design:** Following RESTful best practices for collection endpoints, which enhances the "production-ready" aspect.

**Disadvantages of Internal Pagination:**

* **Increased API Layer Complexity:** Requires additional logic in the service and controller to handle pagination parameters and calculations.
* **Client-Side Paging Logic:** Frontend applications must implement their own pagination controls and logic to consume the paginated API.

---

## 6. Individual Stock Lookup (`getStockBySymbol`)

The `getStockBySymbol(symbol)` method also significantly benefits from this caching strategy:

* It primarily attempts to fetch the `StockItem` directly from the individual cache (`stock:SYMBOL`).
* Only if the item is not found or has expired in the cache does it trigger a full `_fetchAndCacheAllStocksFromVendor()` refresh (which updates the entire cache) and then re-attempts to retrieve the specific stock. This ensures high availability and fast lookups for individual stocks.

---

## 7. Conclusion

By combining NestJS's robust features with a proactive caching strategy and internal pagination, this solution effectively addresses the challenges posed by an unreliable, paginated external vendor and strict data freshness requirements. The design prioritizes user experience through low latency and high availability, while also demonstrating a scalable and maintainable architecture suitable for a production environment.