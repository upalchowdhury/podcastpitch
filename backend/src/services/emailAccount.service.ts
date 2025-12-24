import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailAccounts } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { encryptObject, decryptObject } from '../utils/encryption.js';
import { promises as dns } from 'dns';
import { DOMAIN_HEALTH_CONFIG } from '@podcast-pitch/shared';
import type {
    EmailAccount,
    DomainHealthCheck,
    CreateEmailAccountInput
} from '@podcast-pitch/shared';

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
}

export class EmailAccountService {
    static async create(
        userId: string,
        data: CreateEmailAccountInput
    ): Promise<EmailAccount> {
        // Extract domain from email
        const domain = data.fromEmail.split('@')[1];

        // Encrypt SMTP credentials
        let encryptedSecret = '';
        if (data.smtpConfig) {
            const smtpConfig = {
                host: data.smtpConfig.host,
                port: data.smtpConfig.port,
                secure: data.smtpConfig.secure,
                username: data.smtpConfig.username,
                password: data.smtpConfig.password,
            };
            encryptedSecret = encryptObject(smtpConfig);
        }

        const [account] = await db
            .insert(emailAccounts)
            .values({
                userId,
                providerType: data.providerType,
                encryptedSecretRef: encryptedSecret,
                fromName: data.fromName,
                fromEmail: data.fromEmail,
                domain,
                healthStatus: 'healthy',
                isVerified: true,
            })
            .returning();

        return this.mapEmailAccount(account);
    }

    /**
     * Get decrypted SMTP config for an email account
     */
    static async getSmtpConfig(userId: string, accountId: string): Promise<SmtpConfig> {
        const account = await db.query.emailAccounts.findFirst({
            where: eq(emailAccounts.id, accountId),
        });

        if (!account) {
            throw new NotFoundError('Email account');
        }

        if (account.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this email account');
        }

        if (!account.encryptedSecretRef) {
            throw new Error('No SMTP config found for this account');
        }

        return decryptObject<SmtpConfig>(account.encryptedSecretRef);
    }

    static async getUserAccounts(userId: string): Promise<EmailAccount[]> {
        const accounts = await db.query.emailAccounts.findMany({
            where: eq(emailAccounts.userId, userId),
            orderBy: (emailAccounts, { desc }) => [desc(emailAccounts.createdAt)],
        });

        return accounts.map(this.mapEmailAccount);
    }

    static async getById(userId: string, accountId: string): Promise<EmailAccount> {
        const account = await db.query.emailAccounts.findFirst({
            where: eq(emailAccounts.id, accountId),
        });

        if (!account) {
            throw new NotFoundError('Email account');
        }

        if (account.userId !== userId) {
            throw new ForbiddenError('Not authorized to access this email account');
        }

        return this.mapEmailAccount(account);
    }

    static async delete(userId: string, accountId: string): Promise<void> {
        // Direct query to avoid mapping issues with old data
        const account = await db.query.emailAccounts.findFirst({
            where: eq(emailAccounts.id, accountId),
        });

        if (!account) {
            throw new NotFoundError('Email account');
        }

        if (account.userId !== userId) {
            throw new ForbiddenError('Not authorized to delete this email account');
        }

        // First delete any send_jobs that reference this email account
        // Import sendJobs table
        const { sendJobs } = await import('../db/schema.js');
        await db.delete(sendJobs).where(eq(sendJobs.emailAccountId, accountId));

        // Now delete the email account
        await db.delete(emailAccounts).where(eq(emailAccounts.id, accountId));
    }

    static async checkDomainHealth(accountId: string): Promise<DomainHealthCheck> {
        const account = await db.query.emailAccounts.findFirst({
            where: eq(emailAccounts.id, accountId),
        });

        if (!account) {
            throw new NotFoundError('Email account');
        }

        const healthCheck: DomainHealthCheck = {
            spf: { valid: false, record: null },
            dkim: { valid: false, selector: null },
            dmarc: { valid: false, policy: null },
            checkedAt: new Date(),
        };

        // Check SPF
        try {
            const spfRecords = await dns.resolveTxt(account.domain);
            const spfRecord = spfRecords
                .flat()
                .find(r => r.startsWith('v=spf1'));

            if (spfRecord) {
                healthCheck.spf = { valid: true, record: spfRecord };
            }
        } catch {
            // SPF not found
        }

        // Check DKIM
        for (const selector of DOMAIN_HEALTH_CONFIG.dkimSelectors) {
            try {
                const dkimRecords = await dns.resolveTxt(`${selector}._domainkey.${account.domain}`);
                const dkimRecord = dkimRecords.flat().find(r => r.includes('v=DKIM1'));

                if (dkimRecord) {
                    healthCheck.dkim = { valid: true, selector };
                    break;
                }
            } catch {
                // DKIM not found for this selector
            }
        }

        // Check DMARC
        try {
            const dmarcRecords = await dns.resolveTxt(`_dmarc.${account.domain}`);
            const dmarcRecord = dmarcRecords.flat().find(r => r.startsWith('v=DMARC1'));

            if (dmarcRecord) {
                const policyMatch = dmarcRecord.match(/p=(\w+)/);
                healthCheck.dmarc = {
                    valid: true,
                    policy: policyMatch ? policyMatch[1] : 'none'
                };
            }
        } catch {
            // DMARC not found
        }

        // Determine overall health status
        let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy';
        if (!healthCheck.spf.valid || !healthCheck.dkim.valid || !healthCheck.dmarc.valid) {
            healthStatus = 'warning';
        }
        if (!healthCheck.spf.valid && !healthCheck.dmarc.valid) {
            healthStatus = 'error';
        }

        // Update account
        await db
            .update(emailAccounts)
            .set({
                healthStatus,
                healthDetails: healthCheck as unknown as Record<string, unknown>,
                updatedAt: new Date(),
            })
            .where(eq(emailAccounts.id, accountId));

        return healthCheck;
    }

    static async verify(userId: string, accountId: string): Promise<boolean> {
        const account = await this.getById(userId, accountId);

        // TODO: Actually verify email sending capability
        // For now, mark as verified
        await db
            .update(emailAccounts)
            .set({ isVerified: true, updatedAt: new Date() })
            .where(eq(emailAccounts.id, accountId));

        return true;
    }

    private static mapEmailAccount(account: typeof emailAccounts.$inferSelect): EmailAccount {
        return {
            id: account.id,
            userId: account.userId,
            providerType: account.providerType as EmailAccount['providerType'],
            encryptedSecretRef: account.encryptedSecretRef,
            fromName: account.fromName,
            fromEmail: account.fromEmail,
            domain: account.domain,
            healthStatus: account.healthStatus as EmailAccount['healthStatus'],
            isVerified: account.isVerified,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
        };
    }
}
