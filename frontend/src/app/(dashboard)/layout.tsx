import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="flex h-screen">
                <Sidebar />
                <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
                    {children}
                </main>
            </div>
        </AuthGuard>
    );
}
