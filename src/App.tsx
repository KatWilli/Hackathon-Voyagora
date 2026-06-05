import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignInPage from './pages/SignInPage';
import DashboardPage from './pages/DashboardPage';
import NewTripPage from './pages/NewTripPage';
import ItineraryPage from './pages/ItineraryPage';
import type { Trip } from './lib/database.types';
import { Loader2 } from 'lucide-react';

type Screen = 'dashboard' | 'new-trip' | 'itinerary';

function AppShell() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  if (screen === 'new-trip') {
    return (
      <NewTripPage
        onBack={() => setScreen('dashboard')}
        onTripCreated={(trip) => {
          setActiveTrip(trip);
          setScreen('itinerary');
        }}
      />
    );
  }

  if (screen === 'itinerary' && activeTrip) {
    return (
      <ItineraryPage
        trip={activeTrip}
        onBack={() => setScreen('dashboard')}
      />
    );
  }

  return (
    <DashboardPage
      onNewTrip={() => setScreen('new-trip')}
      onOpenTrip={(trip) => {
        setActiveTrip(trip);
        setScreen('itinerary');
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
