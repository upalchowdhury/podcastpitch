import { db } from '../db/index.js';
import { podcasts } from '../db/schema.js';
import { eq, and, or, lt, isNull, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

interface CrawlResult {
    podcastId: string;
    success: boolean;
    status: 'found' | 'not_found' | 'failed' | 'blocked';
    email?: string;
    confidence?: number;
    source?: string;
    error?: string;
}

export class ContactEnrichmentService {
    private static readonly MAX_PAGES = 5;
    private static readonly USER_AGENT = 'PodcastPitchBot/1.0 (contact: support@podcastpitch.com)';
    private static readonly CONTACT_PATHS = [
        '',  // homepage
        '/contact',
        '/contact-us',
        '/about',
        '/about-us',
        '/advertise',
        '/sponsor',
        '/team',
        '/advertising',
    ];

    /**
     * Attempt to find contact email for a podcast by crawling its website
     */
    static async enrichContact(podcastId: string): Promise<CrawlResult> {
        try {
            const podcast = await db.query.podcasts.findFirst({
                where: eq(podcasts.id, podcastId),
            });

            if (!podcast || !podcast.websiteUrl) {
                return {
                    podcastId,
                    success: false,
                    status: 'failed',
                    error: 'Podcast or website URL not found'
                };
            }

            // Skip if already has high-confidence email
            if (podcast.contactEmail && podcast.contactConfidence >= 80) {
                return {
                    podcastId,
                    success: true,
                    status: 'found',
                    email: podcast.contactEmail,
                    confidence: podcast.contactConfidence,
                };
            }

            const baseUrl = new URL(podcast.websiteUrl);
            let bestEmail: string | null = null;
            let bestConfidence = 0;
            let emailSource = '';
            let pagesChecked = 0;

            for (const path of this.CONTACT_PATHS) {
                if (pagesChecked >= this.MAX_PAGES) break;

                try {
                    const url = new URL(path, baseUrl);

                    // Only crawl same domain
                    if (url.hostname !== baseUrl.hostname) continue;

                    const response = await fetch(url.toString(), {
                        method: 'GET',
                        headers: {
                            'User-Agent': this.USER_AGENT,
                            'Accept': 'text/html,application/xhtml+xml',
                        },
                        signal: AbortSignal.timeout(15000),
                        redirect: 'follow',
                    });

                    pagesChecked++;

                    if (!response.ok) {
                        if (response.status === 403 || response.status === 429) {
                            // Blocked - stop crawling this site
                            await db
                                .update(podcasts)
                                .set({
                                    contactEnrichStatus: 'blocked',
                                    lastError: `HTTP ${response.status} on ${path}`,
                                })
                                .where(eq(podcasts.id, podcastId));
                            return {
                                podcastId,
                                success: false,
                                status: 'blocked',
                                error: `HTTP ${response.status}`,
                            };
                        }
                        continue;
                    }

                    const html = await response.text();
                    const { email, confidence, source } = this.extractEmail(html, path);

                    if (email && confidence > bestConfidence) {
                        bestEmail = email;
                        bestConfidence = confidence;
                        emailSource = source;

                        // If we found a high-confidence email, stop early
                        if (confidence >= 90) break;
                    }

                    // Rate limiting: wait 500ms between requests
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    logger.debug({ error, path }, 'Page fetch failed');
                }
            }

            if (bestEmail) {
                // Found an email
                await db
                    .update(podcasts)
                    .set({
                        contactEmail: bestEmail,
                        contactSource: 'website',
                        contactConfidence: bestConfidence,
                        contactEnrichStatus: 'found',
                        lastError: null,
                    })
                    .where(eq(podcasts.id, podcastId));

                return {
                    podcastId,
                    success: true,
                    status: 'found',
                    email: bestEmail,
                    confidence: bestConfidence,
                    source: emailSource,
                };
            } else {
                // No email found
                await db
                    .update(podcasts)
                    .set({
                        contactEnrichStatus: 'not_found',
                    })
                    .where(eq(podcasts.id, podcastId));

                return {
                    podcastId,
                    success: true,
                    status: 'not_found',
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ podcastId, error: errorMessage }, 'Contact enrichment failed');

            await db
                .update(podcasts)
                .set({
                    contactEnrichStatus: 'failed',
                    lastError: errorMessage,
                })
                .where(eq(podcasts.id, podcastId));

            return {
                podcastId,
                success: false,
                status: 'failed',
                error: errorMessage,
            };
        }
    }

    /**
     * Get podcasts that need contact enrichment
     */
    static async getPodcastsNeedingEnrichment(limit = 100): Promise<string[]> {
        const results = await db
            .select({ id: podcasts.id })
            .from(podcasts)
            .where(
                and(
                    sql`${podcasts.websiteUrl} IS NOT NULL`,
                    or(
                        isNull(podcasts.contactEmail),
                        lt(podcasts.contactConfidence, 70)
                    ),
                    sql`${podcasts.contactEnrichStatus} NOT IN ('found', 'blocked')`
                )
            )
            .limit(limit);

        return results.map(r => r.id);
    }

    /**
     * Batch process multiple podcasts
     */
    static async batchEnrich(podcastIds: string[], concurrency = 3): Promise<CrawlResult[]> {
        const results: CrawlResult[] = [];

        // Process one at a time to be respectful
        for (const id of podcastIds) {
            const result = await this.enrichContact(id);
            results.push(result);

            // Wait between different websites
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return results;
    }

    private static extractEmail(html: string, path: string): { email: string | null; confidence: number; source: string } {
        // Try mailto: links first (highest confidence)
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        const mailtoMatches = html.matchAll(mailtoRegex);

        for (const match of mailtoMatches) {
            const email = match[1].toLowerCase();
            if (this.isValidContactEmail(email)) {
                return {
                    email,
                    confidence: this.getConfidenceForPath(path, true),
                    source: `mailto:${path}`,
                };
            }
        }

        // Try regex patterns for exposed emails
        const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi;
        const emailMatches = html.matchAll(emailRegex);
        const foundEmails: string[] = [];

        for (const match of emailMatches) {
            const email = match[1].toLowerCase();
            if (this.isValidContactEmail(email) && !foundEmails.includes(email)) {
                foundEmails.push(email);
            }
        }

        // Try obfuscated patterns
        const obfuscatedRegex = /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@|&#64;)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.)\s*(com|org|net|io|co)/gi;
        const obfuscatedMatches = html.matchAll(obfuscatedRegex);

        for (const match of obfuscatedMatches) {
            const email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
            if (this.isValidContactEmail(email) && !foundEmails.includes(email)) {
                foundEmails.push(email);
            }
        }

        // Return the best email found
        if (foundEmails.length > 0) {
            // Prefer emails with contact/booking/guest keywords
            const preferredEmail = foundEmails.find(e =>
                e.includes('contact') ||
                e.includes('booking') ||
                e.includes('guest') ||
                e.includes('pitch') ||
                e.includes('hello') ||
                e.includes('info')
            ) || foundEmails[0];

            return {
                email: preferredEmail,
                confidence: this.getConfidenceForPath(path, false),
                source: `regex:${path}`,
            };
        }

        return { email: null, confidence: 0, source: '' };
    }

    private static isValidContactEmail(email: string): boolean {
        // Filter out common false positives
        const invalidPatterns = [
            '@example.com',
            '@test.com',
            '@localhost',
            'noreply@',
            'no-reply@',
            'donotreply@',
            'notifications@',
            'support@wordpress',
            '@sentry.io',
            '@wix.com',
            '@squarespace',
            'privacy@',
            'legal@',
            'abuse@',
            'postmaster@',
            'webmaster@',
        ];

        for (const pattern of invalidPatterns) {
            if (email.includes(pattern)) return false;
        }

        return true;
    }

    private static getConfidenceForPath(path: string, isMailto: boolean): number {
        const baseConfidence = isMailto ? 90 : 70;

        // Higher confidence for contact/booking pages
        if (path.includes('contact') || path.includes('booking') || path.includes('advertise')) {
            return Math.min(baseConfidence + 5, 95);
        }
        if (path.includes('about') || path.includes('team')) {
            return baseConfidence;
        }
        // Homepage has slightly lower confidence
        if (path === '' || path === '/') {
            return baseConfidence - 5;
        }

        return baseConfidence;
    }
}
