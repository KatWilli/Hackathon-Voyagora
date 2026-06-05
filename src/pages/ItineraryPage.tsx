import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Trip, Activity, ActivityCategory } from '../lib/database.types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Globe, ArrowLeft, Plus, Pencil, Trash2, Loader2, MapPin,
  Clock, ChevronDown, ChevronUp, Sparkles, Plane, ExternalLink,
  UtensilsCrossed, Landmark, Footprints, Bus, Coffee, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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

interface ItineraryPageProps {
  trip: Trip;
  onBack: () => void;
}

const CATEGORY_META: Record<ActivityCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  food: { label: 'Food & Drink', icon: <UtensilsCrossed className="h-3.5 w-3.5" />, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  sightseeing: { label: 'Sightseeing', icon: <Landmark className="h-3.5 w-3.5" />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  activity: { label: 'Activity', icon: <Footprints className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  transit: { label: 'Transit', icon: <Bus className="h-3.5 w-3.5" />, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  rest: { label: 'Rest', icon: <Coffee className="h-3.5 w-3.5" />, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
};

type DayGroup = { dayNumber: number; activities: Activity[] };

const EMPTY_ACTIVITY: Omit<Activity, 'id' | 'trip_id' | 'created_at'> = {
  day_number: 1,
  title: '',
  location: '',
  start_time: '',
  category: 'activity',
  notes: '',
  sort_order: 0,
};

export default function ItineraryPage({ trip, onBack }: ItineraryPageProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [tuneAdjustment, setTuneAdjustment] = useState('');
  const [tuneError, setTuneError] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState(false);
  const [tripNotes, setTripNotes] = useState(trip.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('trip_id', trip.id)
      .order('day_number')
      .order('sort_order')
      .order('start_time');
    if (!error && data) setActivities(data as Activity[]);
    setLoading(false);
  }, [trip.id]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  useEffect(() => {
    const grouped: Record<number, Activity[]> = {};
    for (const act of activities) {
      if (!grouped[act.day_number]) grouped[act.day_number] = [];
      grouped[act.day_number].push(act);
    }
    const sorted = Object.entries(grouped)
      .map(([d, acts]) => ({ dayNumber: Number(d), activities: acts }))
      .sort((a, b) => a.dayNumber - b.dayNumber);
    setDays(sorted);
  }, [activities]);

  const toggleDay = (dayNum: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      next.has(dayNum) ? next.delete(dayNum) : next.add(dayNum);
      return next;
    });
  };

  const dayLabel = (dayNum: number) => {
    if (!trip.start_date) return `Day ${dayNum}`;
    const d = new Date(trip.start_date);
    d.setDate(d.getDate() + dayNum - 1);
    return `Day ${dayNum} — ${format(d, 'EEE, MMM d')}`;
  };

  const openEdit = (act: Activity) => setEditActivity({ ...act });
  const openAdd = (dayNumber: number) => {
    const dayActs = activities.filter((a) => a.day_number === dayNumber);
    const maxOrder = dayActs.reduce((m, a) => Math.max(m, a.sort_order), 0);
    setEditActivity({
      ...EMPTY_ACTIVITY,
      id: '',
      trip_id: trip.id,
      created_at: '',
      day_number: dayNumber,
      sort_order: maxOrder + 1,
    });
    setAddingDay(dayNumber);
  };

  const handleSaveActivity = async () => {
    if (!editActivity || !editActivity.title.trim()) return;
    setSaving(true);
    if (addingDay !== null) {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          trip_id: trip.id,
          day_number: editActivity.day_number,
          title: editActivity.title,
          location: editActivity.location,
          start_time: editActivity.start_time,
          category: editActivity.category,
          notes: editActivity.notes,
          sort_order: editActivity.sort_order,
        })
        .select()
        .single();
      if (!error && data) {
        setActivities((prev) => [...prev, data as Activity]);
      }
      setAddingDay(null);
    } else {
      const { error } = await supabase
        .from('activities')
        .update({
          title: editActivity.title,
          location: editActivity.location,
          start_time: editActivity.start_time,
          category: editActivity.category,
          notes: editActivity.notes,
          sort_order: editActivity.sort_order,
          day_number: editActivity.day_number,
        })
        .eq('id', editActivity.id);
      if (!error) {
        setActivities((prev) =>
          prev.map((a) => (a.id === editActivity.id ? { ...a, ...editActivity } : a))
        );
      }
    }
    setSaving(false);
    setEditActivity(null);
  };

  const handleDeleteActivity = async (act: Activity) => {
    await supabase.from('activities').delete().eq('id', act.id);
    setActivities((prev) => prev.filter((a) => a.id !== act.id));
    setDeleteTarget(null);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await supabase.from('trips').update({ notes: tripNotes }).eq('id', trip.id);
    setSavingNotes(false);
    setEditNotes(false);
  };

  const handleTune = async () => {
    if (!tuneAdjustment.trim()) return;
    setTuneError(null);
    setTuning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-itinerary`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tripId: trip.id,
            destination: trip.destination,
            startDate: trip.start_date,
            endDate: trip.end_date,
            budget: 'mid',
            pace: 'balanced',
            interests: [tuneAdjustment.trim()],
            tuneNote: tuneAdjustment.trim(),
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed (${response.status})`);
      }
      await fetchActivities();
      setTuneOpen(false);
      setTuneAdjustment('');
    } catch (err: unknown) {
      setTuneError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setTuning(false);
    }
  };

  const formatDate = (d: string | null) => d ? format(parseISO(d), 'MMM d, yyyy') : null;
  const totalDays = days.length;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="font-semibold text-stone-800 truncate">{trip.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTuneOpen(true)}
              className="gap-1.5 text-stone-600 border-stone-200 hidden sm:flex"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tune my trip
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Trip meta */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">{trip.title}</h1>
              <div className="flex items-center gap-1.5 text-stone-500 text-sm mb-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{trip.destination}</span>
              </div>
              {(trip.start_date || trip.end_date) && (
                <div className="flex items-center gap-1.5 text-stone-500 text-sm">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(trip.start_date)}
                    {trip.end_date && ` – ${formatDate(trip.end_date)}`}
                  </span>
                  {totalDays > 0 && (
                    <span className="ml-2 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-100">
                      {totalDays} {totalDays === 1 ? 'day' : 'days'}
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Book buttons */}
            <div className="flex gap-2 flex-wrap">
              <a
                href={`https://www.google.com/flights?q=flights+to+${encodeURIComponent(trip.destination)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <Plane className="h-3.5 w-3.5" />
                Flights
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
              <a
                href={`https://www.booking.com/search.html?ss=${encodeURIComponent(trip.destination)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Hotels
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Trip notes</span>
              {!editNotes && (
                <button
                  type="button"
                  onClick={() => setEditNotes(true)}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={tripNotes}
                  onChange={(e) => setTripNotes(e.target.value)}
                  placeholder="Any notes about your trip..."
                  rows={3}
                  className="text-sm resize-none bg-stone-50"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-600">
                {tripNotes || <span className="text-stone-400 italic">No notes yet</span>}
              </p>
            )}
          </div>
        </div>

        {/* Mobile tune button */}
        <Button
          variant="outline"
          onClick={() => setTuneOpen(true)}
          className="w-full mb-6 gap-2 text-stone-600 border-stone-200 sm:hidden"
        >
          <RefreshCw className="h-4 w-4" />
          Tune my trip
        </Button>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        )}

        {/* Empty state */}
        {!loading && days.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
            <Sparkles className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <h3 className="font-semibold text-stone-800 mb-1">No activities yet</h3>
            <p className="text-stone-500 text-sm">Go back and generate your itinerary, or add activities manually.</p>
          </div>
        )}

        {/* Day groups */}
        {!loading && days.map(({ dayNumber, activities: dayActs }) => (
          <div key={dayNumber} className="mb-4">
            {/* Day header */}
            <button
              type="button"
              onClick={() => toggleDay(dayNumber)}
              className="w-full flex items-center justify-between px-4 py-3 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors mb-2"
            >
              <span className="font-semibold text-stone-700 text-sm">{dayLabel(dayNumber)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">{dayActs.length} stop{dayActs.length !== 1 ? 's' : ''}</span>
                {collapsedDays.has(dayNumber)
                  ? <ChevronDown className="h-4 w-4 text-stone-400" />
                  : <ChevronUp className="h-4 w-4 text-stone-400" />}
              </div>
            </button>

            {!collapsedDays.has(dayNumber) && (
              <div className="space-y-2 pl-4 border-l-2 border-amber-200 ml-2">
                {dayActs.map((act) => {
                  const meta = CATEGORY_META[act.category];
                  return (
                    <div
                      key={act.id}
                      className="bg-white rounded-xl border border-stone-200 p-4 group hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                          {act.start_time && (
                            <span className="text-xs font-mono text-stone-400 w-12 text-center">
                              {act.start_time}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color} ${meta.bg}`}>
                              {meta.icon}
                              {meta.label}
                            </span>
                          </div>
                          <p className="font-semibold text-stone-800 text-sm">{act.title}</p>
                          {act.location && (
                            <div className="flex items-center gap-1 text-stone-500 text-xs mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span>{act.location}</span>
                            </div>
                          )}
                          {act.notes && (
                            <p className="text-stone-500 text-xs mt-1.5 leading-relaxed">{act.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => openEdit(act)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(act)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add activity button */}
                <button
                  type="button"
                  onClick={() => openAdd(dayNumber)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-400 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-all text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add activity to Day {dayNumber}
                </button>
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Edit / Add activity dialog */}
      <Dialog
        open={!!editActivity}
        onOpenChange={(open) => { if (!open) { setEditActivity(null); setAddingDay(null); } }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{addingDay !== null ? 'Add Activity' : 'Edit Activity'}</DialogTitle>
          </DialogHeader>
          {editActivity && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-stone-700">Title</Label>
                <Input
                  value={editActivity.title}
                  onChange={(e) => setEditActivity({ ...editActivity, title: e.target.value })}
                  placeholder="e.g. Breakfast at Tsukiji Market"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-stone-700">Category</Label>
                  <Select
                    value={editActivity.category}
                    onValueChange={(v) => setEditActivity({ ...editActivity, category: v as ActivityCategory })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-stone-700">Start time</Label>
                  <Input
                    type="time"
                    value={editActivity.start_time ?? ''}
                    onChange={(e) => setEditActivity({ ...editActivity, start_time: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label className="text-stone-700">Location / Venue</Label>
                <Input
                  value={editActivity.location ?? ''}
                  onChange={(e) => setEditActivity({ ...editActivity, location: e.target.value })}
                  placeholder="e.g. Tsukiji Outer Market, Tokyo"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-stone-700">Notes</Label>
                <Textarea
                  value={editActivity.notes ?? ''}
                  onChange={(e) => setEditActivity({ ...editActivity, notes: e.target.value })}
                  placeholder="Tips, details, or reminders..."
                  rows={3}
                  className="mt-1.5 resize-none"
                />
              </div>
              {addingDay !== null && (
                <div>
                  <Label className="text-stone-700">Day</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editActivity.day_number}
                    onChange={(e) => setEditActivity({ ...editActivity, day_number: Number(e.target.value) })}
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditActivity(null); setAddingDay(null); }}>Cancel</Button>
            <Button
              onClick={handleSaveActivity}
              disabled={saving || !editActivity?.title.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {addingDay !== null ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete activity confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed from your itinerary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDeleteActivity(deleteTarget)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tune my trip dialog */}
      <Dialog open={tuneOpen} onOpenChange={(o) => { setTuneOpen(o); if (!o) setTuneError(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-600" />
              Tune my trip
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-stone-600">
              Tell us one adjustment and we'll regenerate the full itinerary around it.
              Your existing activities will be replaced.
            </p>
            <div>
              <Label className="text-stone-700">Adjustment</Label>
              <Textarea
                value={tuneAdjustment}
                onChange={(e) => setTuneAdjustment(e.target.value)}
                placeholder="e.g. Make it more relaxed, focus more on street food, cut the budget..."
                rows={3}
                className="mt-1.5 resize-none"
              />
            </div>
            {tuneError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {tuneError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTuneOpen(false)} disabled={tuning}>Cancel</Button>
            <Button
              onClick={handleTune}
              disabled={tuning || !tuneAdjustment.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {tuning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {tuning ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
