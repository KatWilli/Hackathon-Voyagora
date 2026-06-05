import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Trip } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import {
  Globe, Plus, Trash2, MapPin, Calendar, LogOut,
  Loader2, ChevronRight, Plane
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface DashboardProps {
  onNewTrip: () => void;
  onOpenTrip: (trip: Trip) => void;
}

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=70',
  'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=600&q=70',
  'https://images.unsplash.com/photo-1503917988258-f87a78e3c995?w=600&q=70',
  'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=70',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=70',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=70',
];

function tripImage(trip: Trip) {
  const hash = trip.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return HERO_IMAGES[hash % HERO_IMAGES.length];
}

export default function DashboardPage({ onNewTrip, onOpenTrip }: DashboardProps) {
  const { user, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTrips(data as Trip[]);
    setLoading(false);
  };

  const deleteTrip = async (trip: Trip) => {
    setDeletingId(trip.id);
    await supabase.from('trips').delete().eq('id', trip.id);
    setTrips((prev) => prev.filter((t) => t.id !== trip.id));
    setDeletingId(null);
    setConfirmDelete(null);
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return 'Dates TBD';
    const fmt = (d: string) => format(parseISO(d), 'MMM d');
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${end ? format(parseISO(end), 'MMM d') : ''}`;
  };

  const tripDays = (trip: Trip) => {
    if (!trip.start_date || !trip.end_date) return null;
    const diff = Math.round(
      (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
    return diff;
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-600" />
            <span className="text-lg font-bold text-stone-800">Voyagora</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-stone-500 truncate max-w-[180px]">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-stone-500 hover:text-stone-800 gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Page heading */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">My Trips</h1>
            <p className="text-stone-500 mt-1">
              {trips.length === 0
                ? 'No trips yet — let\'s plan one!'
                : `${trips.length} trip${trips.length !== 1 ? 's' : ''} planned`}
            </p>
          </div>
          <Button
            onClick={onNewTrip}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            New Trip
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        )}

        {/* Empty state */}
        {!loading && trips.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border border-stone-200">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mb-4">
              <Plane className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-stone-800 mb-2">Plan your first trip</h3>
            <p className="text-stone-500 mb-6 max-w-sm mx-auto">
              Tell us where you're going and we'll build a full day-by-day itinerary for you.
            </p>
            <Button
              onClick={onNewTrip}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              Create my first trip
            </Button>
          </div>
        )}

        {/* Trip grid */}
        {!loading && trips.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onOpenTrip(trip)}
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={tripImage(trip)}
                    alt={trip.destination}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-white font-semibold text-base leading-tight truncate">
                      {trip.title || trip.destination}
                    </p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-stone-500 text-sm mb-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{trip.destination || 'Destination TBD'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-500 text-sm">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                    {tripDays(trip) && (
                      <span className="ml-auto text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {tripDays(trip)}d
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-600 group-hover:text-amber-700 flex items-center gap-1">
                      View itinerary <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(trip); }}
                      disabled={deletingId === trip.id}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      {deletingId === trip.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title || confirmDelete?.destination}" and all its activities
              will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteTrip(confirmDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
