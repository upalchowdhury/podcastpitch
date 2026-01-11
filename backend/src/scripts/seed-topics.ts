/**
 * Topic Seeding Script
 * 
 * Seeds the topics taxonomy with canonical topics, aliases, and Listen Notes genre mappings.
 * Run with: npx tsx src/scripts/seed-topics.ts
 */

import { db, pool } from '../db/index.js';
import { topics, topicAliases, genreTopicMapping } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// =============================================================================
// TOPIC DEFINITIONS
// =============================================================================

interface TopicDefinition {
    slug: string;
    displayName: string;
    parentSlug?: string;
    isGeneric?: boolean;
    description?: string;
    aliases: string[];
    genreIds?: number[]; // Listen Notes genre IDs
}

// Core topic taxonomy - organized by category
const TOPIC_DEFINITIONS: TopicDefinition[] = [
    // =============================================================================
    // TECHNOLOGY (Parent)
    // =============================================================================
    {
        slug: 'technology',
        displayName: 'Technology',
        isGeneric: true,
        description: 'General technology topics',
        aliases: ['tech', 'tecnologia'],
        genreIds: [127], // Listen Notes: Technology
    },

    // AI & Machine Learning
    {
        slug: 'artificial-intelligence',
        displayName: 'Artificial Intelligence',
        parentSlug: 'technology',
        aliases: ['ai', 'a.i.', 'machine intelligence', 'intelligent systems'],
        genreIds: [129], // Listen Notes: Tech News (closest)
    },
    {
        slug: 'machine-learning',
        displayName: 'Machine Learning',
        parentSlug: 'artificial-intelligence',
        aliases: ['ml', 'm.l.', 'statistical learning', 'predictive models'],
    },
    {
        slug: 'deep-learning',
        displayName: 'Deep Learning',
        parentSlug: 'machine-learning',
        aliases: ['neural networks', 'neural nets', 'dnn', 'cnn', 'rnn'],
    },
    {
        slug: 'generative-ai',
        displayName: 'Generative AI',
        parentSlug: 'artificial-intelligence',
        aliases: ['genai', 'gen ai', 'generative models', 'llm', 'large language model', 'large language models', 'gpt', 'chatgpt', 'claude', 'gemini'],
    },
    {
        slug: 'natural-language-processing',
        displayName: 'Natural Language Processing',
        parentSlug: 'artificial-intelligence',
        aliases: ['nlp', 'n.l.p.', 'text analysis', 'language models', 'text mining'],
    },
    {
        slug: 'computer-vision',
        displayName: 'Computer Vision',
        parentSlug: 'artificial-intelligence',
        aliases: ['cv', 'image recognition', 'visual ai', 'image processing'],
    },

    // Software Development
    {
        slug: 'software-development',
        displayName: 'Software Development',
        parentSlug: 'technology',
        aliases: ['software engineering', 'programming', 'coding', 'development', 'dev'],
    },
    {
        slug: 'web-development',
        displayName: 'Web Development',
        parentSlug: 'software-development',
        aliases: ['web dev', 'frontend', 'frontend development', 'backend', 'backend development', 'fullstack', 'full stack'],
    },
    {
        slug: 'mobile-development',
        displayName: 'Mobile Development',
        parentSlug: 'software-development',
        aliases: ['mobile dev', 'ios development', 'android development', 'app development'],
    },
    {
        slug: 'devops',
        displayName: 'DevOps',
        parentSlug: 'software-development',
        aliases: ['dev ops', 'development operations', 'devsecops', 'platform engineering', 'sre', 'site reliability'],
    },
    {
        slug: 'cloud-computing',
        displayName: 'Cloud Computing',
        parentSlug: 'technology',
        aliases: ['cloud', 'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'saas', 'paas', 'iaas'],
    },

    // Data
    {
        slug: 'data-science',
        displayName: 'Data Science',
        parentSlug: 'technology',
        aliases: ['data analytics', 'analytics', 'data analysis', 'big data'],
    },
    {
        slug: 'data-engineering',
        displayName: 'Data Engineering',
        parentSlug: 'data-science',
        aliases: ['data infra', 'data infrastructure', 'data pipelines', 'etl'],
    },

    // Cybersecurity
    {
        slug: 'cybersecurity',
        displayName: 'Cybersecurity',
        parentSlug: 'technology',
        aliases: ['cyber security', 'security', 'infosec', 'information security', 'hacking', 'ethical hacking'],
    },
    {
        slug: 'privacy',
        displayName: 'Privacy',
        parentSlug: 'cybersecurity',
        aliases: ['data privacy', 'gdpr', 'privacy compliance'],
    },

    // Crypto & Web3
    {
        slug: 'cryptocurrency',
        displayName: 'Cryptocurrency',
        parentSlug: 'technology',
        aliases: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'digital currency'],
    },
    {
        slug: 'blockchain',
        displayName: 'Blockchain',
        parentSlug: 'cryptocurrency',
        aliases: ['distributed ledger', 'dlt', 'web3', 'decentralized'],
    },
    {
        slug: 'nft',
        displayName: 'NFT',
        parentSlug: 'blockchain',
        aliases: ['nfts', 'non-fungible token', 'non-fungible tokens', 'digital collectibles'],
    },

    // Emerging Tech
    {
        slug: 'virtual-reality',
        displayName: 'Virtual Reality',
        parentSlug: 'technology',
        aliases: ['vr', 'v.r.', 'metaverse', 'immersive tech'],
    },
    {
        slug: 'augmented-reality',
        displayName: 'Augmented Reality',
        parentSlug: 'technology',
        aliases: ['ar', 'a.r.', 'mixed reality', 'mr', 'xr', 'extended reality'],
    },
    {
        slug: 'internet-of-things',
        displayName: 'Internet of Things',
        parentSlug: 'technology',
        aliases: ['iot', 'i.o.t.', 'connected devices', 'smart devices', 'smart home'],
    },
    {
        slug: 'robotics',
        displayName: 'Robotics',
        parentSlug: 'technology',
        aliases: ['robots', 'automation'],
    },

    // =============================================================================
    // BUSINESS (Parent)
    // =============================================================================
    {
        slug: 'business',
        displayName: 'Business',
        isGeneric: true,
        description: 'General business topics',
        aliases: ['biz'],
        genreIds: [93], // Listen Notes: Business
    },

    // Entrepreneurship
    {
        slug: 'entrepreneurship',
        displayName: 'Entrepreneurship',
        parentSlug: 'business',
        aliases: ['entrepreneur', 'entrepreneurs', 'founder', 'founders', 'startup founder'],
    },
    {
        slug: 'startups',
        displayName: 'Startups',
        parentSlug: 'entrepreneurship',
        aliases: ['startup', 'start-up', 'start-ups', 'early stage'],
    },
    {
        slug: 'venture-capital',
        displayName: 'Venture Capital',
        parentSlug: 'startups',
        aliases: ['vc', 'v.c.', 'vcs', 'venture investing', 'startup funding', 'fundraising'],
    },

    // Marketing
    {
        slug: 'marketing',
        displayName: 'Marketing',
        parentSlug: 'business',
        aliases: ['mktg', 'digital marketing', 'brand marketing'],
        genreIds: [94], // Listen Notes: Marketing
    },
    {
        slug: 'content-marketing',
        displayName: 'Content Marketing',
        parentSlug: 'marketing',
        aliases: ['content strategy', 'content creation'],
    },
    {
        slug: 'seo',
        displayName: 'SEO',
        parentSlug: 'marketing',
        aliases: ['search engine optimization', 'organic search', 'google ranking'],
    },
    {
        slug: 'social-media-marketing',
        displayName: 'Social Media Marketing',
        parentSlug: 'marketing',
        aliases: ['smm', 'social marketing', 'social media'],
    },
    {
        slug: 'growth-marketing',
        displayName: 'Growth Marketing',
        parentSlug: 'marketing',
        aliases: ['growth', 'growth hacking', 'gtm', 'go to market'],
    },

    // Sales
    {
        slug: 'sales',
        displayName: 'Sales',
        parentSlug: 'business',
        aliases: ['selling', 'b2b sales', 'enterprise sales'],
    },

    // Finance
    {
        slug: 'finance',
        displayName: 'Finance',
        parentSlug: 'business',
        aliases: ['financial', 'money'],
    },
    {
        slug: 'investing',
        displayName: 'Investing',
        parentSlug: 'finance',
        aliases: ['investment', 'investments', 'investor', 'stock market', 'stocks'],
        genreIds: [144], // Listen Notes: Investing
    },
    {
        slug: 'personal-finance',
        displayName: 'Personal Finance',
        parentSlug: 'finance',
        aliases: ['money management', 'budgeting', 'financial planning'],
    },
    {
        slug: 'real-estate',
        displayName: 'Real Estate',
        parentSlug: 'investing',
        aliases: ['property', 'real estate investing', 'rei'],
    },

    // Leadership
    {
        slug: 'leadership',
        displayName: 'Leadership',
        parentSlug: 'business',
        aliases: ['management', 'executive', 'ceo', 'c-suite', 'cxo'],
        genreIds: [97], // Listen Notes: Management
    },
    {
        slug: 'product-management',
        displayName: 'Product Management',
        parentSlug: 'leadership',
        aliases: ['product', 'pm', 'product manager', 'product managers'],
    },

    // HR
    {
        slug: 'human-resources',
        displayName: 'Human Resources',
        parentSlug: 'business',
        aliases: ['hr', 'h.r.', 'people ops', 'recruiting', 'hiring', 'talent acquisition'],
    },

    // =============================================================================
    // HEALTH & WELLNESS (Parent)
    // =============================================================================
    {
        slug: 'health-wellness',
        displayName: 'Health & Wellness',
        isGeneric: true,
        description: 'Health and wellness topics',
        aliases: ['health', 'wellness', 'wellbeing', 'well-being'],
        genreIds: [88], // Listen Notes: Health & Fitness
    },

    // Mental Health
    {
        slug: 'mental-health',
        displayName: 'Mental Health',
        parentSlug: 'health-wellness',
        aliases: ['psychology', 'therapy', 'counseling', 'mental wellness'],
        genreIds: [91], // Listen Notes: Mental Health
    },
    {
        slug: 'meditation',
        displayName: 'Meditation',
        parentSlug: 'mental-health',
        aliases: ['mindfulness', 'mindful', 'zen'],
    },

    // Fitness
    {
        slug: 'fitness',
        displayName: 'Fitness',
        parentSlug: 'health-wellness',
        aliases: ['exercise', 'workout', 'workouts', 'training', 'gym'],
    },
    {
        slug: 'nutrition',
        displayName: 'Nutrition',
        parentSlug: 'health-wellness',
        aliases: ['diet', 'dieting', 'healthy eating', 'food science'],
        genreIds: [90], // Listen Notes: Nutrition
    },

    // Medicine
    {
        slug: 'medicine',
        displayName: 'Medicine',
        parentSlug: 'health-wellness',
        aliases: ['medical', 'healthcare', 'health care', 'clinical'],
        genreIds: [89], // Listen Notes: Medicine
    },

    // =============================================================================
    // SCIENCE (Parent)
    // =============================================================================
    {
        slug: 'science',
        displayName: 'Science',
        isGeneric: true,
        description: 'Scientific topics',
        aliases: ['sciences', 'scientific'],
        genreIds: [107], // Listen Notes: Science
    },
    {
        slug: 'physics',
        displayName: 'Physics',
        parentSlug: 'science',
        aliases: ['physical science', 'quantum physics', 'astronomy', 'astrophysics'],
    },
    {
        slug: 'biology',
        displayName: 'Biology',
        parentSlug: 'science',
        aliases: ['biological', 'life science', 'biotech', 'biotechnology'],
    },
    {
        slug: 'climate',
        displayName: 'Climate',
        parentSlug: 'science',
        aliases: ['climate change', 'climate science', 'global warming', 'environment', 'sustainability'],
    },

    // =============================================================================
    // EDUCATION (Parent)
    // =============================================================================
    {
        slug: 'education',
        displayName: 'Education',
        isGeneric: true,
        description: 'Education topics',
        aliases: ['learning', 'teaching', 'educational'],
        genreIds: [111], // Listen Notes: Education
    },
    {
        slug: 'career-development',
        displayName: 'Career Development',
        parentSlug: 'education',
        aliases: ['career', 'careers', 'professional development', 'job search'],
        genreIds: [112], // Listen Notes: Courses
    },
    {
        slug: 'productivity',
        displayName: 'Productivity',
        parentSlug: 'education',
        aliases: ['time management', 'efficiency', 'getting things done', 'gtd'],
        genreIds: [115], // Listen Notes: Self-Improvement
    },

    // =============================================================================
    // SOCIETY & CULTURE
    // =============================================================================
    {
        slug: 'society-culture',
        displayName: 'Society & Culture',
        isGeneric: true,
        description: 'Society and culture topics',
        aliases: ['culture', 'society'],
        genreIds: [122], // Listen Notes: Society & Culture
    },
    {
        slug: 'politics',
        displayName: 'Politics',
        parentSlug: 'society-culture',
        aliases: ['political', 'government', 'policy'],
    },
    {
        slug: 'philosophy',
        displayName: 'Philosophy',
        parentSlug: 'society-culture',
        aliases: ['philosophical', 'ethics'],
        genreIds: [126], // Listen Notes: Philosophy
    },
    {
        slug: 'parenting',
        displayName: 'Parenting',
        parentSlug: 'society-culture',
        aliases: ['parents', 'motherhood', 'fatherhood', 'family'],
        genreIds: [85], // Listen Notes: Kids & Family
    },

    // =============================================================================
    // ENTERTAINMENT
    // =============================================================================
    {
        slug: 'entertainment',
        displayName: 'Entertainment',
        isGeneric: true,
        description: 'Entertainment topics',
        aliases: ['entertainment industry'],
        genreIds: [68], // Listen Notes: TV & Film
    },
    {
        slug: 'gaming',
        displayName: 'Gaming',
        parentSlug: 'entertainment',
        aliases: ['video games', 'videogames', 'esports', 'e-sports'],
        genreIds: [82], // Listen Notes: Video Games
    },
    {
        slug: 'music',
        displayName: 'Music',
        parentSlug: 'entertainment',
        aliases: ['musician', 'musicians', 'music industry'],
        genreIds: [134], // Listen Notes: Music
    },
    {
        slug: 'true-crime',
        displayName: 'True Crime',
        parentSlug: 'entertainment',
        aliases: ['crime', 'criminal'],
        genreIds: [135], // Listen Notes: True Crime
    },
    {
        slug: 'comedy',
        displayName: 'Comedy',
        parentSlug: 'entertainment',
        aliases: ['humor', 'funny', 'comedian'],
        genreIds: [133], // Listen Notes: Comedy
    },
];

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

async function seedTopics(): Promise<void> {
    console.log('🌱 Seeding topics taxonomy...\n');

    // First pass: Create all topics without parent references
    const topicIdMap = new Map<string, string>();

    for (const topicDef of TOPIC_DEFINITIONS) {
        // Check if topic already exists
        const existing = await db
            .select({ id: topics.id })
            .from(topics)
            .where(eq(topics.slug, topicDef.slug))
            .limit(1);

        let topicId: string;

        if (existing.length > 0) {
            topicId = existing[0].id;
            console.log(`  ⏭️  Topic "${topicDef.displayName}" already exists`);
        } else {
            const [inserted] = await db
                .insert(topics)
                .values({
                    slug: topicDef.slug,
                    displayName: topicDef.displayName,
                    description: topicDef.description || null,
                    isGeneric: topicDef.isGeneric || false,
                    parentId: null, // Will update in second pass
                })
                .returning({ id: topics.id });

            topicId = inserted.id;
            console.log(`  ✅ Created topic "${topicDef.displayName}"`);
        }

        topicIdMap.set(topicDef.slug, topicId);
    }

    // Second pass: Update parent references
    console.log('\n🔗 Linking parent topics...');
    for (const topicDef of TOPIC_DEFINITIONS) {
        if (topicDef.parentSlug) {
            const topicId = topicIdMap.get(topicDef.slug);
            const parentId = topicIdMap.get(topicDef.parentSlug);

            if (topicId && parentId) {
                await db
                    .update(topics)
                    .set({ parentId })
                    .where(eq(topics.id, topicId));
            }
        }
    }

    // Third pass: Create aliases
    console.log('\n📝 Creating topic aliases...');
    for (const topicDef of TOPIC_DEFINITIONS) {
        const topicId = topicIdMap.get(topicDef.slug);
        if (!topicId) continue;

        for (const alias of topicDef.aliases) {
            const normalizedAlias = alias.toLowerCase().trim();

            try {
                await db
                    .insert(topicAliases)
                    .values({
                        topicId,
                        alias: normalizedAlias,
                    })
                    .onConflictDoNothing();
            } catch (error) {
                // Alias might already exist for another topic
                console.log(`    ⚠️  Alias "${normalizedAlias}" already exists, skipping`);
            }
        }
    }

    // Fourth pass: Create genre mappings
    console.log('\n🎵 Creating Listen Notes genre mappings...');
    for (const topicDef of TOPIC_DEFINITIONS) {
        if (!topicDef.genreIds || topicDef.genreIds.length === 0) continue;

        const topicId = topicIdMap.get(topicDef.slug);
        if (!topicId) continue;

        for (const genreId of topicDef.genreIds) {
            try {
                await db
                    .insert(genreTopicMapping)
                    .values({
                        genreId,
                        topicId,
                    })
                    .onConflictDoNothing();
                console.log(`    ✅ Mapped genre ${genreId} → ${topicDef.displayName}`);
            } catch (error) {
                console.log(`    ⚠️  Genre ${genreId} already mapped, skipping`);
            }
        }
    }

    console.log('\n✨ Topic seeding complete!\n');
}

async function showStats(): Promise<void> {
    const [topicCount] = await db
        .select({ count: topics.id })
        .from(topics);

    const [aliasCount] = await db
        .select({ count: topicAliases.id })
        .from(topicAliases);

    const [genreCount] = await db
        .select({ count: genreTopicMapping.genreId })
        .from(genreTopicMapping);

    console.log('📊 Topic Statistics:');
    console.log(`   Topics: ${topicCount?.count || 0}`);
    console.log(`   Aliases: ${aliasCount?.count || 0}`);
    console.log(`   Genre Mappings: ${genreCount?.count || 0}`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    try {
        await seedTopics();
        await showStats();
    } catch (error) {
        console.error('❌ Error seeding topics:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
