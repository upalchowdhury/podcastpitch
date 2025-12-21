'use client';

import { useEffect, useState } from 'react';
import { targetListApi } from '@/lib/api';
import { Plus, Edit, Trash2, Loader2, List, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface TargetList {
    id: string;
    name: string;
    podcastCount: number;
    createdAt: string;
}

export default function TargetListsPage() {
    const [lists, setLists] = useState<TargetList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchLists();
    }, []);

    const fetchLists = async () => {
        try {
            const data = await targetListApi.getAll();
            setLists(data);
        } catch (error) {
            console.error('Failed to fetch lists:', error);
        } finally {
            setLoading(false);
        }
    };

    const createList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim()) return;

        setCreating(true);
        try {
            const newList = await targetListApi.create(newListName.trim());
            setLists([newList, ...lists]);
            setNewListName('');
            setShowCreate(false);
        } catch (error) {
            console.error('Failed to create list:', error);
        } finally {
            setCreating(false);
        }
    };

    const deleteList = async (id: string) => {
        if (!confirm('Are you sure you want to delete this list?')) return;

        try {
            await targetListApi.delete(id);
            setLists(lists.filter((l) => l.id !== id));
        } catch (error) {
            console.error('Failed to delete list:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Target Lists</h1>
                <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New List
                </button>
            </div>

            {/* Create List Form */}
            {showCreate && (
                <form onSubmit={createList} className="card mb-6">
                    <label className="label">List Name</label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            className="input flex-1"
                            placeholder="e.g., Tech Podcasts to Pitch"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={creating || !newListName.trim()}
                            className="btn-primary"
                        >
                            {creating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Create'
                            )}
                        </button>
                    </div>
                </form>
            )}

            {lists.length === 0 ? (
                <div className="card text-center py-12">
                    <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">
                        No target lists yet. Create one to organize your podcast outreach.
                    </p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="btn-primary"
                    >
                        Create Your First List
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {lists.map((list) => (
                        <div
                            key={list.id}
                            className="card flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                            <Link
                                href={`/lists/${list.id}`}
                                className="flex-1 flex items-center gap-4"
                            >
                                <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                                    <List className="h-6 w-6 text-primary-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{list.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {list.podcastCount} podcast{list.podcastCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </Link>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => deleteList(list.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                                <Link
                                    href={`/lists/${list.id}`}
                                    className="p-2 text-gray-400 hover:text-gray-600"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
