/**
 * Search Synonym Expansion Utility
 * 
 * Maps common abbreviations and short terms to their full forms
 * to improve search hit rates when users search with abbreviated terms.
 */

// Common search term expansions for podcast search
export const SEARCH_SYNONYMS: Record<string, string[]> = {
    // Technology
    'ai': ['artificial intelligence', 'machine learning', 'deep learning', 'neural network'],
    'ml': ['machine learning', 'deep learning', 'data science', 'AI'],
    'llm': ['large language model', 'AI', 'GPT', 'chatbot'],
    'nlp': ['natural language processing', 'AI', 'language model'],
    'ux': ['user experience', 'design', 'usability', 'product design'],
    'ui': ['user interface', 'design', 'frontend', 'web design'],
    'vr': ['virtual reality', 'metaverse', 'immersive'],
    'ar': ['augmented reality', 'mixed reality'],
    'iot': ['internet of things', 'connected devices', 'smart home'],
    'api': ['application programming interface', 'integration', 'developer'],
    'saas': ['software as a service', 'cloud software', 'subscription software'],
    'paas': ['platform as a service', 'cloud platform'],
    'devops': ['development operations', 'CI/CD', 'infrastructure'],
    'crypto': ['cryptocurrency', 'bitcoin', 'blockchain', 'web3'],
    'nft': ['non fungible token', 'digital art', 'blockchain', 'web3'],
    'web3': ['decentralized', 'blockchain', 'crypto'],

    // Business
    'b2b': ['business to business', 'enterprise', 'corporate'],
    'b2c': ['business to consumer', 'consumer', 'retail'],
    'd2c': ['direct to consumer', 'ecommerce', 'retail'],
    'ceo': ['chief executive officer', 'founder', 'leadership', 'executive'],
    'cto': ['chief technology officer', 'tech leadership', 'engineering'],
    'cfo': ['chief financial officer', 'finance', 'executive'],
    'cmo': ['chief marketing officer', 'marketing', 'growth'],
    'hr': ['human resources', 'recruiting', 'hiring', 'talent', 'people ops'],
    'vc': ['venture capital', 'startup funding', 'investment', 'fundraising'],
    'pe': ['private equity', 'investment', 'buyout'],
    'roi': ['return on investment', 'metrics', 'business results'],
    'kpi': ['key performance indicator', 'metrics', 'goals'],
    'okr': ['objectives key results', 'goals', 'planning'],
    'gtm': ['go to market', 'sales', 'growth strategy'],

    // Marketing
    'seo': ['search engine optimization', 'organic traffic', 'google ranking'],
    'sem': ['search engine marketing', 'paid search', 'google ads'],
    'ppc': ['pay per click', 'paid advertising', 'google ads'],
    'cpc': ['cost per click', 'paid advertising', 'digital marketing'],
    'ctr': ['click through rate', 'email marketing', 'ads'],
    'crm': ['customer relationship management', 'sales', 'customer success'],
    'pr': ['public relations', 'media', 'press', 'communications'],

    // Health & Lifestyle  
    'diy': ['do it yourself', 'crafts', 'maker', 'home improvement'],
    'hiit': ['high intensity interval training', 'fitness', 'workout'],
    'cbd': ['cannabidiol', 'cannabis', 'wellness', 'hemp'],
    'adhd': ['attention deficit hyperactivity disorder', 'neurodivergent', 'focus'],
    'ptsd': ['post traumatic stress disorder', 'trauma', 'mental health'],

    // Other common abbreviations
    'usa': ['united states', 'america', 'american'],
    'uk': ['united kingdom', 'british', 'england'],
    'nyc': ['new york city', 'new york', 'manhattan'],
    'la': ['los angeles', 'california', 'hollywood'],
    'sf': ['san francisco', 'bay area', 'silicon valley'],
};

/**
 * Expands a search query by adding synonym variations
 * 
 * @param query - The original search query
 * @returns Array of expanded query strings to try
 */
export function expandSearchQuery(query: string): string[] {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const normalizedQuery = query.toLowerCase().trim();
    const words = normalizedQuery.split(/\s+/);
    const expanded = new Set<string>([normalizedQuery]);

    // For each word, check if it has synonyms
    for (const word of words) {
        const synonyms = SEARCH_SYNONYMS[word];
        if (synonyms) {
            // Add the original query with the word replaced by each synonym
            for (const syn of synonyms) {
                const expandedQuery = normalizedQuery.replace(
                    new RegExp(`\\b${word}\\b`, 'gi'),
                    syn
                );
                expanded.add(expandedQuery);
            }

            // Also add just the synonyms themselves for short queries
            if (words.length <= 2) {
                for (const syn of synonyms) {
                    expanded.add(syn);
                }
            }
        }
    }

    // For very short queries (1-3 chars), also try the full expanded terms
    if (normalizedQuery.length <= 3 && SEARCH_SYNONYMS[normalizedQuery]) {
        SEARCH_SYNONYMS[normalizedQuery].forEach(syn => expanded.add(syn));
    }

    return Array.from(expanded);
}

/**
 * Check if a query is likely an abbreviation that needs expansion
 */
export function isLikelyAbbreviation(query: string): boolean {
    const normalized = query.toLowerCase().trim();
    return normalized.length <= 4 && SEARCH_SYNONYMS[normalized] !== undefined;
}
