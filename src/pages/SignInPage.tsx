import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { MapPin, Loader2, Globe } from 'lucide-react';

export default function SignInPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            display_name: displayName || email.split('@')[0],
          });
        }
        setSuccess('Account created! You are now signed in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80"
          alt="Travel"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900/70 via-stone-800/50 to-amber-900/40" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="flex items-center gap-2 mb-8">
            <Globe className="h-7 w-7 text-amber-300" />
            <span className="text-2xl font-bold tracking-tight">Voyagora</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Your personal<br />AI travel advisor
          </h1>
          <p className="text-lg text-white/80 max-w-sm">
            Turn your destination and dates into a beautiful,
            opinionated day-by-day itinerary in seconds.
          </p>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-stone-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Globe className="h-6 w-6 text-amber-600" />
            <span className="text-xl font-bold text-stone-800">Voyagora</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-stone-900">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-stone-500 mt-1">
              {mode === 'signin'
                ? 'Sign in to see your trips'
                : 'Start planning your next adventure'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-stone-700">Your name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Alex Wanderer"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white border-stone-200"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-stone-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-stone-700">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-stone-200"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                {success}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium h-11"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-sm text-stone-400">or</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <p className="mt-6 text-center text-sm text-stone-500">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
              className="text-amber-600 font-medium hover:text-amber-700 bg-transparent border-0 p-0 cursor-pointer"
            >
              {mode === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          <div className="mt-8 flex items-center gap-1.5 justify-center text-stone-400">
            <MapPin className="h-3.5 w-3.5" />
            <span className="text-xs">Plan smarter. Travel better.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
