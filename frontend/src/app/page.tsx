import Link from 'next/link';
import { Mic, Mail, Target, Zap, BarChart3, Shield } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <Mic className="h-8 w-8 text-primary-500" />
                            <span className="text-xl font-bold text-white">PodcastPitch</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/login" className="text-gray-300 hover:text-white transition-colors">
                                Login
                            </Link>
                            <Link href="/register" className="btn-primary">
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4">
                <div className="max-w-7xl mx-auto text-center">
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
                        Land Your Dream
                        <span className="block gradient-text">Podcast Interviews</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                        Generate personalized pitches with AI, manage your outreach at scale,
                        and track every response. Turn cold emails into booked appearances.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/register" className="btn-primary text-lg px-8 py-3">
                            Start Free Trial
                        </Link>
                        <Link href="#features" className="btn-secondary text-lg px-8 py-3">
                            Learn More
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-4">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
                        Everything You Need to Scale Your Podcast Outreach
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Target className="h-8 w-8 text-primary-500" />}
                            title="Smart Podcast Discovery"
                            description="Search our database of podcasts by category, audience size, and language. Build targeted lists for your outreach."
                        />
                        <FeatureCard
                            icon={<Zap className="h-8 w-8 text-accent-500" />}
                            title="AI-Powered Pitches"
                            description="Generate personalized pitch emails in seconds. Our AI crafts compelling messages tailored to each podcast."
                        />
                        <FeatureCard
                            icon={<Mail className="h-8 w-8 text-green-500" />}
                            title="Automated Sending"
                            description="Schedule and send emails through your own SMTP infrastructure. Full control, maximum deliverability."
                        />
                        <FeatureCard
                            icon={<Shield className="h-8 w-8 text-yellow-500" />}
                            title="Domain Health Checks"
                            description="Monitor SPF, DKIM, and DMARC records. Ensure your emails actually reach the inbox."
                        />
                        <FeatureCard
                            icon={<BarChart3 className="h-8 w-8 text-blue-500" />}
                            title="Open & Response Tracking"
                            description="Know exactly when your emails are opened. Track responses and manage your pipeline."
                        />
                        <FeatureCard
                            icon={<Mic className="h-8 w-8 text-red-500" />}
                            title="Response Management"
                            description="Log interested podcasts, track bookings, and manage your guest appearances in one place."
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4 bg-gradient-to-r from-primary-900 to-accent-900">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Ready to Get Booked on More Podcasts?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Join thousands of experts who use PodcastPitch to land their dream interviews.
                    </p>
                    <Link href="/register" className="btn bg-white text-gray-900 hover:bg-gray-100 text-lg px-8 py-3">
                        Start Your Free Trial
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 border-t border-gray-800">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Mic className="h-6 w-6 text-primary-500" />
                        <span className="font-semibold text-white">PodcastPitch</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        © {new Date().getFullYear()} PodcastPitch. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-colors">
            <div className="mb-4">{icon}</div>
            <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400">{description}</p>
        </div>
    );
}
