import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Trip } from '../lib/database.types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Globe, ArrowLeft, Loader2, Sparkles, MapPin, Calendar, Wallet, Zap, Heart
} from 'lucide-react';

interface NewTripPageProps {
  onBack: () => void;
  onTripCreated: (trip: Trip) => void;
}

type Budget = 'low' | 'mid' | 'high';
type Pace = 'relaxed' | 'balanced' | 'packed';

const INTEREST_TAGS = [
  'Art & Museums', 'Food & Drink', 'Nature & Hiking',
  'Architecture', 'Local Culture', 'Nightlife',
  'Shopping', 'Beaches', 'History', 'Photography',
  'Street Food', 'Wellness & Spa',
];

export default function NewTripPage({ onBack, onTripCreated }: NewTripPageProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState<Budget>('mid');
  const [pace, setPace] = useState<Pace>('balanced');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;
    setError(null);
    setGenerating(true);
    setProgress('Creating your trip...');

    try {
      // 1. Create the trip row first
      const { data: tripRow, error: tripErr } = await supabase
        .from('trips')
        .insert({
          title: `${destination} Trip`,
          destination: destination.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          notes: '',
        })
        .select()
        .single();

      if (tripErr || !tripRow) throw tripErr ?? new Error('Failed to create trip');

      setProgress('Asking your AI travel advisor...');

      // 2. Call the Edge Function
      const interests = [
        ...selectedInterests,
        ...(customInterests.trim() ? [customInterests.trim()] : []),
      ];

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
            tripId: tripRow.id,
            destination: destination.trim(),
            startDate: startDate || null,
            endDate: endDate || null,
            budget,
            pace,
            interests,
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Generation failed (${response.status})`);
      }

      const result = await response.json();
      if (!result.trip) throw new Error('Invalid response from AI');

      setProgress('Saving your itinerary...');

      // 3. Update trip title with AI-suggested one
      if (result.trip.trip_title) {
        await supabase
          .from('trips')
          .update({ title: result.trip.trip_title })
          .eq('id', tripRow.id);
      }

      // 4. Navigate to itinerary
      const finalTrip: Trip = {
        ...tripRow as Trip,
        title: result.trip.trip_title || tripRow.title,
      };
      onTripCreated(finalTrip);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setGenerating(false);
    }
  };

  const budgetOptions: { value: Budget; label: string; desc: string }[] = [
    { value: 'low', label: 'Budget', desc: 'Hostels, street food, free sights' },
    { value: 'mid', label: 'Mid-range', desc: 'Hotels, local restaurants, paid attractions' },
    { value: 'high', label: 'Luxury', desc: 'Fine dining, premium hotels, private tours' },
  ];

  const paceOptions: { value: Pace; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'relaxed', label: 'Relaxed', desc: '2–3 things / day, lots of breathing room', icon: <Heart className="h-4 w-4" /> },
    { value: 'balanced', label: 'Balanced', desc: '4–5 things / day, a good mix', icon: <Zap className="h-4 w-4" /> },
    { value: 'packed', label: 'Packed', desc: '6+ things / day, see everything', icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={generating}
            className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-stone-800">Plan a New Trip</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Where are you headed?</h1>
          <p className="text-stone-500">
            Tell us the basics and our AI advisor will build a full itinerary tailored to you.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-8">
          {/* Destination */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-stone-800">Destination</h2>
            </div>
            <div>
              <Label htmlFor="destination" className="text-stone-600 text-sm">City or region</Label>
              <Input
                id="destination"
                type="text"
                placeholder="e.g. Kyoto, Japan"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                className="mt-1.5 bg-stone-50 border-stone-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-stone-600 text-sm">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5 bg-stone-50 border-stone-200"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-stone-600 text-sm">End date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1.5 bg-stone-50 border-stone-200"
                />
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-stone-800">Budget</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {budgetOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBudget(opt.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    budget === opt.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-stone-200 hover:border-stone-300 bg-stone-50'
                  }`}
                >
                  <div className={`font-semibold text-sm ${budget === opt.value ? 'text-amber-700' : 'text-stone-700'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Pace */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-stone-800">Travel pace</h2>
            </div>
            <div className="space-y-2">
              {paceOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPace(opt.value)}
                  className={`w-full p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                    pace === opt.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-stone-200 hover:border-stone-300 bg-stone-50'
                  }`}
                >
                  <span className={pace === opt.value ? 'text-amber-600' : 'text-stone-400'}>
                    {opt.icon}
                  </span>
                  <div>
                    <div className={`font-semibold text-sm ${pace === opt.value ? 'text-amber-700' : 'text-stone-700'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-stone-500">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-stone-800">Interests</h2>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {INTEREST_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedInterests.includes(tag)
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-stone-200 text-stone-600 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="customInterests" className="text-stone-600 text-sm">
                Anything else? (optional)
              </Label>
              <Textarea
                id="customInterests"
                placeholder="e.g. I love jazz clubs, vintage bookshops, and hidden neighborhood gems..."
                value={customInterests}
                onChange={(e) => setCustomInterests(e.target.value)}
                rows={3}
                className="mt-1.5 bg-stone-50 border-stone-200 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={generating || !destination.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold h-14 text-base gap-2 rounded-xl shadow-sm"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {progress || 'Generating...'}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate My Itinerary
              </>
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
