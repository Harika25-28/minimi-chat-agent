
import "dotenv/config";

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
}

interface TavilySearchResponse {
    query: string;
    results: TavilySearchResult[];
    response_time?: number;
}

export async function searchWeb(
    query: string,
    domains?: string[]
): Promise<TavilySearchResponse> {

    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
        throw new Error("TAVILY_API_KEY is missing from environment variables");
    }

    if (!query.trim() || query.length > 400) {
        throw new Error("Search query must contain 1–400 characters");
    }

    // Validate optional preferred domains
    const validDomains = domains?.filter(domain =>
        /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)
    );

    const requestBody = {
        query: query,
        search_depth: "advanced",
        max_results: 8,
        include_answer: false,
        include_published_date: true,

        ...(validDomains?.length
            ? { include_domains: validDomains }
            : {}),
    };

    const response = await fetch(
        "https://api.tavily.com/search",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },

            body: JSON.stringify(requestBody),

            signal: AbortSignal.timeout(15000),
        }
    );

    if (!response.ok) {
        const errorDetails = await response.text();

        throw new Error(
            `Tavily API error (${response.status}): ${errorDetails}`
        );
    }

    const data = await response.json() as TavilySearchResponse;

    // Remove duplicate localized versions of the same article
    const seen = new Set<string>();

    const uniqueResults = data.results.filter(result => {
        try {
            const url = new URL(result.url);

            // Remove language prefixes such as /en/, /uk/, /ro/
            const path = url.pathname.replace(
                /^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i,
                ""
            );

            const key = `${url.hostname}${path}`.toLowerCase();

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;

        } catch {
            return false;
        }
    });

    return {
        ...data,
        results: uniqueResults,
    };
}
