import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Search, MapPin, Star, Clock, IndianRupee, Plane, Train, Bus, Phone,
  Navigation, Building2, ShoppingBag, Camera, Info,
  ChevronRight, Calendar, Users, Heart, ArrowLeft, Loader2, Sparkles,
  Vote, UserPlus, Share2, Check, Crown, Home, Compass, PlusCircle,
  BarChart3, Scale, Copy, X, Map, ArrowRight, Briefcase, Bell, CloudSun, Eye, EyeOff, MessageSquare, Send, Video
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { mockApi } from "./services/mockApi";
import { GeminiKeyInput, useGeminiKey } from "./components/GeminiKeyInput";
import emergencyContacts from "./data/emergencyContacts.json";

const callGemini = async (prompt, apiKey) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
};

const getWebSocketUrl = (path) => {
  if (process.env.REACT_APP_WS_URL) {
    return `${process.env.REACT_APP_WS_URL}${path}`;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `ws://127.0.0.1:8000${path}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
  }
  return `ws://127.0.0.1:8000${path}`;
};

// Unregister service worker to prevent stale cache bugs
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

// ============== COMPONENTS ==============

const Navbar = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('user_name');
    return token ? { name } : null;
  });

  useEffect(() => {
    const fetchNotificationsAndFavs = () => {
      const name = localStorage.getItem('member_name');
      if (name) {
        mockApi.getNotifications(name)
          .then(setNotifications)
          .catch(err => console.error("Failed to fetch notifications", err));
      } else {
        setNotifications([]);
      }
    };

    // Initial fetch
    fetchNotificationsAndFavs();

    const name = localStorage.getItem('member_name');
    if (name) {
      // Sync favorites cache
      mockApi.getFavorites(name)
        .then(favs => {
          const ids = favs.map(f => f.id);
          localStorage.setItem('favorites_cache', JSON.stringify(ids));
        })
        .catch(err => console.error("Failed to sync favorites cache", err));
    }

    const handleAuthUpdate = () => {
      const token = localStorage.getItem('token');
      const name = localStorage.getItem('user_name');
      setUser(token ? { name } : null);
      fetchNotificationsAndFavs();
    };

    // Poll every 10 seconds
    const interval = setInterval(fetchNotificationsAndFavs, 10000);
    
    window.addEventListener('auth-updated', handleAuthUpdate);
    window.addEventListener('storage', handleAuthUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('auth-updated', handleAuthUpdate);
      window.removeEventListener('storage', handleAuthUpdate);
    };
  }, []);

  const handleTogglePanel = async () => {
    const nextShow = !showPanel;
    setShowPanel(nextShow);
    
    if (nextShow) {
      const unreads = notifications.filter(n => !n.read);
      if (unreads.length > 0) {
        try {
          await Promise.all(unreads.map(n => mockApi.markNotificationRead(n.id)));
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
          console.error("Failed to mark notifications as read", err);
        }
      }
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200" data-testid="navbar">
      <div className="section-container">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
            <Vote className="w-7 h-7 text-[#FF9933]" />
            <span className="text-xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
              Pack<span className="text-[#FF9933]">Vote</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-stone-600 hover:text-[#FF9933]"
              onClick={() => navigate('/')}
              data-testid="home-btn"
            >
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
            <Button
              variant="ghost"
              className="text-stone-600 hover:text-[#FF9933]"
              onClick={() => navigate('/explore')}
              data-testid="explore-btn"
            >
              <Compass className="w-4 h-4 mr-1" /> Explore
            </Button>
            <Button
              variant="ghost"
              className="text-stone-600 hover:text-[#FF9933]"
              onClick={() => navigate('/routes')}
              data-testid="routes-btn"
            >
              <Map className="w-4 h-4 mr-1" /> Route Planner
            </Button>
            <Button
              variant="ghost"
              className="text-stone-600 hover:text-[#FF9933]"
              onClick={() => navigate('/favorites')}
              data-testid="favorites-btn"
            >
              <Heart className="w-4 h-4 mr-1 text-red-500" /> Favorites
            </Button>
            <Button
              variant="ghost"
              className="text-stone-600 hover:text-[#FF9933]"
              onClick={() => navigate('/my-trips')}
              data-testid="my-trips-btn"
            >
              <Briefcase className="w-4 h-4 mr-1 text-[#008080]" /> My Trips
            </Button>

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="text-stone-600 hover:text-[#FF9933] relative"
                onClick={handleTogglePanel}
                data-testid="notifications-bell"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse"
                    data-testid="unread-count"
                  >
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </Button>

              {showPanel && (
                <div 
                  className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden z-50 animate-fade-in"
                  data-testid="notifications-panel"
                >
                  <div className="p-3 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
                    <span className="font-bold text-xs text-stone-700">Notifications</span>
                    {notifications.length > 0 && (
                      <span className="text-[10px] text-stone-400 font-medium">
                        {notifications.filter(n => !n.read).length} unread
                      </span>
                    )}
                  </div>
                  
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-stone-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-stone-400 italic text-xs">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 text-xs text-left transition-colors hover:bg-stone-50 ${!n.read ? 'bg-stone-50/50 font-medium' : ''}`}
                          data-testid="notification-item"
                        >
                          <p className="text-stone-700 leading-relaxed">{n.message}</p>
                          <span className="text-[9px] text-stone-400 block mt-1">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              className="btn-primary"
              onClick={() => navigate('/create-trip')}
              data-testid="create-trip-btn"
            >
              <PlusCircle className="w-4 h-4 mr-1" /> Create Trip
            </Button>

            {user ? (
              <div className="flex items-center gap-2">
                <span 
                  onClick={() => navigate('/profile')}
                  className="text-sm font-medium text-stone-600 bg-stone-100 px-3 py-1.5 rounded-full cursor-pointer hover:bg-stone-200 transition-colors" 
                  data-testid="user-display-name"
                >
                  Hi, {user.name}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user_name');
                    localStorage.removeItem('user_email');
                    window.dispatchEvent(new Event('auth-updated'));
                    window.dispatchEvent(new Event('favorites-updated'));
                    navigate('/');
                  }}
                  data-testid="logout-btn"
                  className="border-stone-200 text-stone-600 hover:text-red-600 hover:border-red-200"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
                data-testid="login-btn"
                className="border-stone-200 text-stone-600 hover:text-[#FF9933] hover:border-[#FF9933]"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const BottomNav = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 md:hidden" data-testid="bottom-nav">
      <div className="flex items-center justify-around py-2">
        <button onClick={() => navigate('/')} className="flex flex-col items-center p-2 text-stone-600 hover:text-[#FF9933]">
          <Home className="w-5 h-5" />
          <span className="text-xs mt-1">Home</span>
        </button>
        <button onClick={() => navigate('/explore')} className="flex flex-col items-center p-2 text-stone-600 hover:text-[#FF9933]">
          <Compass className="w-5 h-5" />
          <span className="text-xs mt-1">Explore</span>
        </button>
        <button onClick={() => navigate('/routes')} className="flex flex-col items-center p-2 text-stone-600 hover:text-[#FF9933]">
          <Map className="w-5 h-5" />
          <span className="text-xs mt-1">Routes</span>
        </button>
        <button onClick={() => navigate('/create-trip')} className="flex flex-col items-center p-2 text-[#FF9933]">
          <PlusCircle className="w-6 h-6" />
          <span className="text-xs mt-1">New Trip</span>
        </button>
        <button onClick={() => navigate('/compare')} className="flex flex-col items-center p-2 text-stone-600 hover:text-[#FF9933]">
          <Scale className="w-5 h-5" />
          <span className="text-xs mt-1">Compare</span>
        </button>
      </div>
    </div>
  );
};


const HeroSection = ({ onSearch, searchQuery, setSearchQuery, searchResults, isSearching }) => {
  const navigate = useNavigate();

  return (
    <section className="hero-section" data-testid="hero-section">
      <img
        src="https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1920&q=80"
        alt="Group Travel Planning"
        className="hero-image"
      />
      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="flex items-center gap-3 mb-4 animate-fade-in-up">
          <Vote className="w-12 h-12 text-[#FF9933]" />
          <h1 className="text-5xl md:text-7xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="hero-title">
            Pack<span className="text-[#FF9933]">Vote</span>
          </h1>
        </div>

        <p className="text-xl md:text-2xl text-white/90 mb-4 animate-fade-in-up delay-100" data-testid="hero-subtitle">
          Plan trips together. Vote. Travel!
        </p>
        <p className="text-lg text-white/70 mb-8 max-w-2xl animate-fade-in-up delay-100">
          Perfect for friends, families & corporate teams exploring Gujarat
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-200">
          <Button
            className="btn-primary text-lg px-8 py-6"
            onClick={() => navigate('/create-trip')}
            data-testid="start-planning-btn"
          >
            <Users className="w-5 h-5 mr-2" /> Start Group Planning
          </Button>
          <Button
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-lg px-8 py-6"
            onClick={() => navigate('/join-trip')}
            data-testid="join-trip-btn"
          >
            <UserPlus className="w-5 h-5 mr-2" /> Join a Trip
          </Button>
        </div>

        <div className="relative w-full max-w-xl mt-12 animate-fade-in-up delay-300 z-40">
          <div className="search-container flex items-center relative z-40">
            <Search className="w-5 h-5 text-stone-400 ml-4" />
            <Input
              type="text"
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch(e.target.value);
              }}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-lg placeholder:text-stone-400"
              data-testid="search-input"
            />
            <Button className="btn-primary" onClick={() => onSearch(searchQuery)} data-testid="search-button">
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
            </Button>
          </div>

          {searchQuery.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden z-50 search-results-dropdown" data-testid="search-results">
              {isSearching ? (
                <div className="flex items-center justify-center p-8 gap-2 text-stone-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((dest) => (
                  <button
                    key={dest.id}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/destination/${dest.id}`); setSearchQuery(''); }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors text-left relative z-50"
                    data-testid={`search-result-${dest.id}`}
                  >
                    <img src={dest.image_url} alt={dest.name} className="w-16 h-16 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-semibold text-stone-800">{dest.name}</h4>
                      <p className="text-sm text-stone-500">{dest.state}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-400 ml-auto" />
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-stone-500" data-testid="no-destinations">
                  No destinations found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const FeatureCards = () => {
  const navigate = useNavigate();
  const features = [
    { icon: <Sparkles className="w-8 h-8" />, title: "AI Suggestions", desc: "Get personalized destination recommendations", color: "bg-purple-500", link: "/ai-suggest" },
    { icon: <Scale className="w-8 h-8" />, title: "Compare", desc: "Compare destinations, hotels & budgets", color: "bg-blue-500", link: "/compare" },
    { icon: <Vote className="w-8 h-8" />, title: "Group Voting", desc: "Vote together to finalize your trip", color: "bg-green-500", link: "/create-trip" },
    { icon: <BarChart3 className="w-8 h-8" />, title: "Budget Tracker", desc: "Track expenses for your group", color: "bg-orange-500", link: "/explore" },
  ];

  return (
    <section className="py-16 bg-white" data-testid="features-section">
      <div className="section-container">
        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-8 text-center" style={{ fontFamily: 'Playfair Display, serif' }}>
          Why PackVote?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
              onClick={() => navigate(f.link)}
              data-testid={`feature-card-${i}`}
            >
              <CardContent className="pt-6">
                <div className={`w-16 h-16 ${f.color} rounded-2xl flex items-center justify-center text-white mb-4`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-stone-500 text-sm">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

const DestinationCard = ({ destination, selectable = false, selected = false, onSelect }) => {
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(() => {
    const cached = JSON.parse(localStorage.getItem('favorites_cache') || '[]');
    return cached.includes(destination.id);
  });

  useEffect(() => {
    const handleUpdate = () => {
      const cached = JSON.parse(localStorage.getItem('favorites_cache') || '[]');
      setIsFav(cached.includes(destination.id));
    };
    window.addEventListener('favorites-updated', handleUpdate);
    return () => window.removeEventListener('favorites-updated', handleUpdate);
  }, [destination.id]);

  const handleFavoriteClick = async (e) => {
    e.stopPropagation();
    let name = localStorage.getItem('member_name');
    if (!name) {
      name = prompt("Enter your display name to start favoriting destinations:");
      if (!name || !name.trim()) return;
      name = name.trim();
      localStorage.setItem('member_name', name);
    }

    const cached = JSON.parse(localStorage.getItem('favorites_cache') || '[]');
    if (isFav) {
      try {
        await mockApi.removeFavorite(name, destination.id);
        const updated = cached.filter(id => id !== destination.id);
        localStorage.setItem('favorites_cache', JSON.stringify(updated));
        window.dispatchEvent(new Event('favorites-updated'));
        toast.success(`Removed ${destination.name} from favorites`);
      } catch (err) {
        toast.error("Failed to remove favorite");
      }
    } else {
      try {
        await mockApi.addFavorite(name, destination.id);
        const updated = [...cached, destination.id];
        localStorage.setItem('favorites_cache', JSON.stringify(updated));
        window.dispatchEvent(new Event('favorites-updated'));
        toast.success(`Added ${destination.name} to favorites`);
      } catch (err) {
        toast.error("Failed to add favorite");
      }
    }
  };

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(destination.id);
    } else {
      navigate(`/destination/${destination.id}`);
    }
  };

  return (
    <div
      className={`destination-card group aspect-[4/5] ${selected ? 'ring-4 ring-[#FF9933]' : ''}`}
      onClick={handleClick}
      data-testid={`destination-card-${destination.id}`}
    >
      <img src={destination.image_url} alt={destination.name} className="absolute inset-0 w-full h-full object-cover" />
      <div className="destination-card-overlay" />

      <button 
        onClick={handleFavoriteClick}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow transition-all duration-300 transform hover:scale-110"
        data-testid={`favorite-btn-${destination.id}`}
      >
        <Heart className={`w-5 h-5 ${isFav ? 'text-red-500 fill-current' : 'text-stone-600'}`} />
      </button>

      {selectable && (
        <div className="absolute top-4 left-4">
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-[#FF9933] border-[#FF9933]' : 'border-white bg-white/20'}`}>
            {selected && <Check className="w-5 h-5 text-white" />}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-[#FF9933]" />
          <span className="text-sm opacity-90">{destination.state}</span>
        </div>
        <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>{destination.name}</h3>
        <p className="text-sm opacity-80 line-clamp-2 mb-3">{destination.short_description}</p>
        {destination.budget_per_day && (
          <Badge className="bg-[#FF9933] text-white">
            <IndianRupee className="w-3 h-3 mr-1" />
            {destination.budget_per_day}/day
          </Badge>
        )}
      </div>
    </div>
  );
};

const FeaturedDestinations = ({ destinations, loading, isSearchActive }) => {
  if (loading) {
    return (
      <section className="py-20 bg-[#FAF9F6]" data-testid="featured-destinations">
        <div className="section-container">
          <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>Popular Destinations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-[#FAF9F6]" data-testid="featured-destinations">
      <div className="section-container">
        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>
          {isSearchActive ? "Search Results" : "Popular Destinations"}
        </h2>
        {destinations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {isSearchActive 
              ? destinations.map((dest) => <DestinationCard key={dest.id} destination={dest} />)
              : destinations.slice(0, 8).map((dest) => <DestinationCard key={dest.id} destination={dest} />)
            }
          </div>
        ) : (
          <div className="text-center py-12" data-testid="no-destinations">
            <p className="text-xl text-stone-500">No destinations found.</p>
          </div>
        )}
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="bg-[#1A1A2E] text-white py-16 mb-16 md:mb-0" data-testid="footer">
    <div className="section-container">
      <div className="flex items-center gap-2 mb-4">
        <Vote className="w-6 h-6 text-[#FF9933]" />
        <span className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>Pack<span className="text-[#FF9933]">Vote</span></span>
      </div>
      <p className="text-stone-400 max-w-md mb-8">
        Plan group trips to Gujarat with AI suggestions, compare options, and vote together to finalize your perfect adventure.
      </p>
      <div className="border-t border-stone-800 pt-8 text-center text-stone-500">
        <p>© 2026 PackVote. Made for travelers, by travelers.</p>
      </div>
    </div>
  </footer>
);

// ============== PAGES ==============

const HomePage = () => {
  const [destinations, setDestinations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const data = await mockApi.getDestinations();
      setDestinations(data);
    } catch (error) {
      console.error('Error fetching destinations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const data = await mockApi.searchDestinations(query);
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div data-testid="home-page">
      <Navbar />
      <HeroSection onSearch={handleSearch} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} isSearching={isSearching} />
      <FeatureCards />
      <FeaturedDestinations destinations={destinations} loading={loading} />
      <Footer />
      <BottomNav />
    </div>
  );
};

const CreateTripPage = () => {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tripData, setTripData] = useState({
    name: '',
    creator_name: '',
    group_type: 'friends',
    budget_per_person: '',
  });
  const [createdTrip, setCreatedTrip] = useState(null);

  useEffect(() => {
    mockApi.getDestinations().then(data => { setDestinations(data); setLoading(false); });
  }, []);

  const handleCreate = async () => {
    if (!tripData.name || !tripData.creator_name) {
      toast.error('Please fill in trip name and your name');
      return;
    }

    setCreating(true);
    try {
      const response = await mockApi.createTrip({
        ...tripData,
        budget_per_person: tripData.budget_per_person ? parseInt(tripData.budget_per_person) : null
      });
      setCreatedTrip(response);
      toast.success('Trip created! Share the code with your group.');
    } catch (error) {
      toast.error('Failed to create trip');
    } finally {
      setCreating(false);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(createdTrip.invite_code);
    toast.success('Invite code copied!');
  };

  if (createdTrip) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] pt-20" data-testid="trip-created-page">
        <Navbar />
        <div className="section-container py-12">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="pt-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Trip Created!</h2>
              <p className="text-stone-500 mb-6">Share this code with your group to start planning together</p>

              <div className="bg-stone-100 rounded-xl p-6 mb-6">
                <p className="text-sm text-stone-500 mb-2">Invite Code</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-bold tracking-widest text-[#FF9933]" data-testid="invite-code">{createdTrip.invite_code}</span>
                  <Button size="icon" variant="ghost" onClick={copyInviteCode} data-testid="copy-code-btn">
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <Button className="btn-primary w-full" onClick={() => navigate(`/trip/${createdTrip.trip_id}`)} data-testid="go-to-trip-btn">
                Go to Trip Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20" data-testid="create-trip-page">
      <Navbar />
      <div className="section-container py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Create a Trip</h1>
          <p className="text-stone-500 mb-8">Start planning your group adventure to Gujarat</p>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Trip Name *</label>
                <Input
                  placeholder="e.g., Kutch Desert Trip 2026"
                  value={tripData.name}
                  onChange={(e) => setTripData({ ...tripData, name: e.target.value })}
                  data-testid="trip-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Your Name *</label>
                <Input
                  placeholder="e.g., Rahul"
                  value={tripData.creator_name}
                  onChange={(e) => setTripData({ ...tripData, creator_name: e.target.value })}
                  data-testid="creator-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Group Type</label>
                <Select value={tripData.group_type} onValueChange={(v) => setTripData({ ...tripData, group_type: v })}>
                  <SelectTrigger data-testid="group-type-select">
                    <SelectValue placeholder="Select group type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friends">Friends</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="corporate">Corporate Team</SelectItem>
                    <SelectItem value="couple">Couple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Budget per Person (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g., 15000"
                  value={tripData.budget_per_person}
                  onChange={(e) => setTripData({ ...tripData, budget_per_person: e.target.value })}
                  data-testid="budget-input"
                />
              </div>

              <Button className="btn-primary w-full" onClick={handleCreate} disabled={creating} data-testid="create-trip-submit-btn">
                {creating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Users className="w-5 h-5 mr-2" />}
                Create Trip & Get Invite Code
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

const JoinTripPage = () => {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode || !memberName) {
      toast.error('Please enter invite code and your name');
      return;
    }

    setJoining(true);
    try {
      const response = await mockApi.joinTrip({
        invite_code: inviteCode.toUpperCase(),
        member_name: memberName
      });
      localStorage.setItem('member_name', memberName);
      toast.success(response.message);
      if (response.pending) {
        navigate('/my-trips');
      } else {
        navigate(`/trip/${response.trip_id}`);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to join trip');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20" data-testid="join-trip-page">
      <Navbar />
      <div className="section-container py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Join a Trip</CardTitle>
            <CardDescription>Enter the invite code shared by your group</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Invite Code</label>
              <Input
                placeholder="e.g., ABC123"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="text-center text-2xl tracking-widest"
                maxLength={6}
                data-testid="invite-code-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Your Name</label>
              <Input
                placeholder="e.g., Priya"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                data-testid="member-name-input"
              />
            </div>

            <Button className="btn-primary w-full" onClick={handleJoin} disabled={joining} data-testid="join-trip-submit-btn">
              {joining ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
              Join Trip
            </Button>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

const TripDashboard = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voterName, setVoterName] = useState(() => localStorage.getItem('member_name') || '');
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('destinations');
  
  // Itinerary states
  const [itineraryDays, setItineraryDays] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState('');
  const [editingActivityIdx, setEditingActivityIdx] = useState(null);
  const [activityForm, setActivityForm] = useState({
    time: '09:00',
    title: '',
    notes: ''
  });
  const [generatingAI, setGeneratingAI] = useState(false);

  // Group Chat States & Refs
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const chatSocketRef = useRef(null);
  const chatEndRef = useRef(null);

  // Jitsi Voice/Video Calling States & Refs
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [jitsiError, setJitsiError] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  useEffect(() => {
    const scriptId = "jitsi-meet-external-api";
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => {
        setJitsiLoaded(true);
      };
      script.onerror = () => {
        setJitsiError(true);
      };
      document.body.appendChild(script);
    } else {
      setJitsiLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'discuss') {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
      setIsInCall(false);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tripId) return;

    // Fetch initial chat messages history
    mockApi.getTripMessages(tripId)
      .then(data => {
        setMessages(data || []);
      })
      .catch(err => {
        console.error("Failed to load message history:", err);
      });

    // Establish Chat WebSocket connection
    let chatWs;
    const timer = setTimeout(() => {
      chatWs = new WebSocket(getWebSocketUrl(`/ws/trips/${tripId}/chat`));
      chatSocketRef.current = chatWs;

      chatWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log("Chat WebSocket received message:", msg);
          setMessages(prev => {
            if (prev.some(m => m.message_id === msg.message_id)) return prev;
            return [...prev, msg];
          });
        } catch (err) {
          console.error("Failed to parse chat message payload:", err);
        }
      };

      chatWs.onerror = (err) => {
        console.error("Chat WebSocket error:", err);
      };

      chatWs.onclose = () => {
        console.log("Chat WebSocket disconnected");
      };
    }, 200);

    return () => {
      clearTimeout(timer);
      if (chatWs) {
        chatWs.onmessage = null;
        chatWs.onerror = null;
        chatWs.onclose = null;
        chatWs.close();
      }
      chatSocketRef.current = null;
    };
  }, [tripId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !voterName) return;

    const payload = {
      sender_name: voterName,
      text: newMessageText.trim()
    };

    if (chatSocketRef.current && chatSocketRef.current.readyState === WebSocket.OPEN) {
      chatSocketRef.current.send(JSON.stringify(payload));
      setNewMessageText("");
    } else {
      toast.error("Chat connection is offline. Please try again.");
    }
  };

  const handleStartCall = () => {
    if (!jitsiLoaded || jitsiError || !window.JitsiMeetExternalAPI) {
      toast.error("Call service unavailable at the moment.");
      return;
    }

    setIsInCall(true);

    setTimeout(() => {
      if (!jitsiContainerRef.current) return;

      const domain = "meet.jit.si";
      const options = {
        roomName: `PackVote-${tripId}`,
        width: "100%",
        height: 450,
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: voterName || "Guest"
        },
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: true
        }
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = api;

      api.addEventListener("videoConferenceLeft", () => {
        handleEndCall();
      });
    }, 100);
  };

  const handleEndCall = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    setIsInCall(false);
  };

  const fetchData = useCallback(async () => {
    try {
      const [tripRes, destRes] = await Promise.all([
        mockApi.getTrip(tripId),
        mockApi.getDestinations()
      ]);
      setTrip(tripRes);
      setDestinations(destRes);

      // Get results
      const resultsRes = await mockApi.getVotingResults(tripId);
      setResults(resultsRes);
    } catch (error) {
      toast.error('Failed to load trip');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [tripId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!tripId) return;

    let ws;
    const timer = setTimeout(() => {
      ws = new WebSocket(getWebSocketUrl(`/ws/trips/${tripId}`));

      ws.onmessage = (event) => {
        try {
          const updatedResults = JSON.parse(event.data);
          console.log("Live voting update received:", updatedResults);
          setResults(updatedResults);
        } catch (err) {
          console.error("Failed to parse live voting WebSocket payload:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("Live voting WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("Live voting WebSocket disconnected");
      };
    }, 200);

    return () => {
      clearTimeout(timer);
      if (ws) {
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    };
  }, [tripId]);

  useEffect(() => {
    if (trip && trip.status === 'finalized') {
      mockApi.getTripItinerary(tripId)
        .then(res => {
          setItineraryDays(res.itinerary_days || []);
        })
        .catch(err => {
          console.error("Failed to load itinerary:", err);
        });
    }
  }, [trip, tripId]);

  const getTripDays = (start, end) => {
    if (!start || !end) {
      const today = new Date();
      const dates = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      return dates;
    }
    const dates = [];
    let current = new Date(start);
    const last = new Date(end);
    let count = 0;
    while (current <= last && count < 30) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  };

  const tripDates = getTripDays(trip?.start_date, trip?.end_date);
  
  const getFullItinerary = () => {
    return tripDates.map(date => {
      const existing = itineraryDays.find(d => d.date === date);
      return existing || { date, activities: [] };
    });
  };
  
  const fullItinerary = getFullItinerary();

  const isCreator = !!(voterName && trip?.members?.some(
    m => m.name?.toLowerCase() === voterName?.toLowerCase() && m.is_creator
  ));

  const openAddActivity = (date) => {
    setSelectedDayDate(date);
    setEditingActivityIdx(null);
    setActivityForm({ time: '09:00', title: '', notes: '' });
    setIsDialogOpen(true);
  };

  const openEditActivity = (date, activity, idx) => {
    setSelectedDayDate(date);
    setEditingActivityIdx(idx);
    setActivityForm({
      time: activity.time,
      title: activity.title,
      notes: activity.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!activityForm.title || !activityForm.time) {
      toast.error("Please fill in time and title");
      return;
    }

    const currentItinerary = [...fullItinerary];
    let dayObj = currentItinerary.find(d => d.date === selectedDayDate);
    if (!dayObj) {
      dayObj = { date: selectedDayDate, activities: [] };
      currentItinerary.push(dayObj);
    } else {
      dayObj.activities = [...dayObj.activities];
    }

    const activityData = {
      time: activityForm.time,
      title: activityForm.title,
      notes: activityForm.notes
    };

    if (editingActivityIdx === null) {
      dayObj.activities.push(activityData);
    } else {
      dayObj.activities[editingActivityIdx] = activityData;
    }

    dayObj.activities.sort((a, b) => a.time.localeCompare(b.time));

    try {
      const res = await mockApi.saveTripItinerary(tripId, currentItinerary);
      setItineraryDays(res.itinerary_days || []);
      toast.success(editingActivityIdx === null ? "Activity added!" : "Activity updated!");
      setIsDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save itinerary");
    }
  };

  const handleDeleteActivity = async (date, idx) => {
    const currentItinerary = [...fullItinerary];
    const dayObj = currentItinerary.find(d => d.date === date);
    if (dayObj) {
      dayObj.activities = [...dayObj.activities];
      dayObj.activities.splice(idx, 1);
      try {
        const res = await mockApi.saveTripItinerary(tripId, currentItinerary);
        setItineraryDays(res.itinerary_days || []);
        toast.success("Activity deleted!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete activity");
      }
    }
  };

  const handleGenerateAIItinerary = async () => {
    setGeneratingAI(true);
    try {
      const res = await mockApi.generateTripItinerary(tripId);
      setItineraryDays(res.itinerary_days || []);
      toast.success("AI Itinerary generated and saved!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to generate AI itinerary");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleVote = async (itemType, itemId) => {
    if (!voterName) {
      toast.error('Please enter your name first');
      return;
    }

    try {
      await mockApi.voteOnItem({
        trip_id: tripId,
        voter_name: voterName,
        item_type: itemType,
        item_id: itemId
      });
      toast.success('Vote recorded!');
      fetchData();
    } catch (error) {
      toast.error('Failed to vote');
    }
  };

  const handleFinalize = async () => {
    try {
      await mockApi.finalizeTrip(tripId);
      toast.success('Trip finalized!');
      fetchData();
    } catch (error) {
      toast.error('Failed to finalize');
    }
  };

  const handleApproveMember = async (name) => {
    try {
      await mockApi.approveMember(tripId, name);
      toast.success(`Approved ${name}!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to approve member');
    }
  };

  const handleRejectMember = async (name) => {
    try {
      await mockApi.rejectMember(tripId, name);
      toast.success(`Rejected ${name}!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to reject member');
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(trip.invite_code);
    toast.success('Invite code copied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] pt-20">
        <Navbar />
        <div className="section-container py-12">
          <Skeleton className="h-48 w-full rounded-xl mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const isMember = trip && (
    trip.creator_name.toLowerCase() === voterName.toLowerCase() ||
    trip.members.some(m => m.name.toLowerCase() === voterName.toLowerCase())
  );

  const isPending = trip && trip.pending_members && trip.pending_members.some(m => m.name.toLowerCase() === voterName.toLowerCase());

  if (trip && !isMember) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20 px-4 flex items-center justify-center">
        <Navbar />
        <Card className="max-w-md w-full border border-stone-200 shadow-lg rounded-2xl bg-white p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FF9933]/15 flex items-center justify-center text-[#FF9933] text-2xl font-bold mx-auto mb-4">
            ?
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            {isPending ? "Approval Pending" : "Access Denied"}
          </h2>
          <p className="text-stone-600 mb-6">
            {isPending 
              ? "Your request to join this trip is pending approval from the creator." 
              : "You are not a member of this trip. Please request to join using the invite code."}
          </p>
          <Button className="btn-primary w-full" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20 pb-20" data-testid="trip-dashboard">
      <Navbar />
      <div className="section-container py-8">
        {/* Trip Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${trip.group_type === 'corporate' ? 'bg-blue-500' : trip.group_type === 'family' ? 'bg-green-500' : 'bg-purple-500'}`}>
                    {trip.group_type}
                  </Badge>
                  {trip.status === 'finalized' && <Badge className="bg-[#FF9933]">Finalized</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="trip-title">
                  {trip.name}
                </h1>
                <p className="text-stone-500 mt-1">Created by {trip.creator_name} • {trip.members?.length || 1} members</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-stone-100 rounded-xl px-4 py-2">
                  <p className="text-xs text-stone-500">Invite Code</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#FF9933]" data-testid="trip-invite-code">{trip.invite_code}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyInviteCode}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium text-stone-700 mb-3">Members</p>
              <div className="flex flex-wrap gap-2">
                {trip.members?.map((m, i) => (
                  <Badge key={i} variant="secondary" className="py-1">
                    {m.is_creator && <Crown className="w-3 h-3 mr-1 text-[#FF9933]" />}
                    {m.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Voter Name Input */}
            <div className="mt-6 pt-6 border-t">
              <label className="text-sm font-medium text-stone-700">Your Name (for voting)</label>
              <Input
                placeholder="Enter your name to vote"
                value={voterName}
                onChange={(e) => {
                  const val = e.target.value;
                  setVoterName(val);
                  localStorage.setItem('member_name', val);
                  window.dispatchEvent(new Event('favorites-updated'));
                }}
                className="mt-2 max-w-xs"
                data-testid="voter-name-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Voting Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="destinations" data-testid="tab-destinations">
              <MapPin className="w-4 h-4 mr-2" /> Destinations
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              <BarChart3 className="w-4 h-4 mr-2" /> Results
            </TabsTrigger>
            <TabsTrigger value="discuss" data-testid="tab-discuss">
              <MessageSquare className="w-4 h-4 mr-2" /> Discuss
            </TabsTrigger>
            {trip?.status === 'finalized' && (
              <TabsTrigger value="schedule" data-testid="tab-schedule">
                <Calendar className="w-4 h-4 mr-2" /> Schedule
              </TabsTrigger>
            )}
            {isCreator && (
              <TabsTrigger value="admin" data-testid="tab-admin">
                <Crown className="w-4 h-4 mr-2 text-[#FF9933]" /> Admin
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="destinations">
            <h2 className="text-xl font-bold mb-4">Vote for Destination</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {destinations.map((dest) => (
                <div key={dest.id} className="relative">
                  <DestinationCard destination={dest} />
                  <div className="absolute bottom-4 left-4 right-4">
                    <Button
                      className="w-full bg-white/90 hover:bg-white text-stone-800"
                      onClick={() => handleVote('destination', dest.id)}
                      data-testid={`vote-dest-${dest.id}`}
                    >
                      <Vote className="w-4 h-4 mr-2" /> Vote
                      {results?.destination_votes?.[dest.id] && (
                        <Badge className="ml-2 bg-[#FF9933]">{results.destination_votes[dest.id]}</Badge>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="discuss" data-testid="tab-discuss-content">
            {isInCall && (
              <Card className="border border-stone-200 shadow-md rounded-2xl bg-white overflow-hidden mb-6">
                <CardHeader className="py-3 px-6 flex flex-row justify-between items-center bg-stone-50 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-[#008080] animate-pulse" />
                    <span className="font-semibold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>Live Video Conference</span>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleEndCall}
                    data-testid="end-call-btn"
                  >
                    End Call
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {jitsiError ? (
                    <div className="p-12 text-center text-red-500 font-medium">
                      Call service unavailable
                    </div>
                  ) : (
                    <div ref={jitsiContainerRef} className="w-full bg-stone-900" style={{ height: "450px" }} />
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border border-stone-200 shadow-lg rounded-2xl bg-white overflow-hidden flex flex-col h-[500px]">
              <CardHeader className="border-b border-stone-100 bg-stone-50/50 py-4 px-6 flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Group Discussion
                  </CardTitle>
                  <CardDescription>Chat live with other group members</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {voterName && (
                     <Badge variant="secondary" className="bg-stone-100 text-stone-600 font-medium h-8 flex items-center">
                       Chatting as: {voterName}
                     </Badge>
                  )}
                  {jitsiError ? (
                    <span className="text-xs text-red-500 italic">Call service unavailable</span>
                  ) : (
                    !isInCall && (
                      <Button
                        size="sm"
                        onClick={handleStartCall}
                        className="bg-[#008080] hover:bg-[#006666] text-white flex items-center gap-1.5 h-8 px-3"
                        data-testid="start-call-btn"
                      >
                        <Video className="w-3.5 h-3.5" /> Start Call
                      </Button>
                    )
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-stone-400 italic text-sm">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_name.toLowerCase() === voterName.toLowerCase();
                    return (
                      <div
                        key={msg.message_id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-xs font-bold text-stone-600">{msg.sender_name}</span>
                          <span className="text-[10px] text-stone-400">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isMe
                              ? 'bg-[#008080] text-white rounded-tr-none'
                              : 'bg-stone-100 text-stone-800 rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </CardContent>
              
              <div className="p-4 border-t border-stone-100 bg-white">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    id="chat-message-input"
                    name="chat_message"
                    aria-label="Chat message"
                    placeholder={voterName ? "Type a message..." : "Please enter your name first to chat"}
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    disabled={!voterName}
                    data-testid="chat-message-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!voterName || !newMessageText.trim()}
                    data-testid="chat-send-btn"
                    className="bg-[#008080] hover:bg-[#006666] text-white p-3 rounded-lg flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Voting Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Destination Votes</h3>
                    {results?.destination_votes && Object.keys(results.destination_votes).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(results.destination_votes)
                          .sort((a, b) => b[1] - a[1])
                          .map(([destId, votes]) => {
                            const dest = destinations.find(d => d.id === destId);
                            return (
                              <div key={destId} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                                {dest && <img src={dest.image_url} alt={dest.name} className="w-12 h-12 rounded-lg object-cover" />}
                                <div className="flex-1">
                                  <p className="font-medium">{dest?.name || destId}</p>
                                </div>
                                <Badge className="bg-[#FF9933]">{votes} votes</Badge>
                                {destId === results.winning_destination && <Crown className="w-5 h-5 text-[#FF9933]" />}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-stone-500">No votes yet</p>
                    )}
                  </div>

                  {trip.status !== 'finalized' && results?.winning_destination && (
                    <Button className="btn-primary w-full" onClick={handleFinalize} data-testid="finalize-btn">
                      Finalize Trip with Winner
                    </Button>
                  )}

                  {trip.status === 'finalized' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">Trip Finalized!</p>
                      <p className="text-green-600">Destination: {trip.selected_destination}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>Trip Schedule</h2>
                <p className="text-sm text-stone-500">Plan and coordinate day-by-day activities</p>
              </div>
              <Button 
                onClick={handleGenerateAIItinerary}
                disabled={generatingAI}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-200"
                data-testid="generate-ai-itinerary-btn"
              >
                {generatingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate AI Itinerary
                  </>
                )}
              </Button>
            </div>

            <div className="flex gap-6 items-start overflow-x-auto pb-4 max-w-full">
              {fullItinerary.map((day) => (
                <Card key={day.date} className="border-stone-200 shadow-sm min-w-[280px] max-w-[320px] flex-shrink-0">
                  <CardHeader className="bg-stone-50 border-b border-stone-100 py-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-stone-800">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </CardTitle>
                      <CardDescription className="text-[10px]">{day.date}</CardDescription>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                      onClick={() => openAddActivity(day.date)}
                      data-testid={`add-activity-${day.date}`}
                    >
                      <PlusCircle className="w-5 h-5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 max-h-[450px] overflow-y-auto">
                    {day.activities.length === 0 ? (
                      <div className="text-center py-6 text-stone-400 text-xs font-medium">
                        No activities planned
                      </div>
                    ) : (
                      day.activities.map((act, idx) => (
                        <div 
                          key={idx} 
                          className="group relative p-3 rounded-lg border border-stone-100 bg-white hover:shadow-sm hover:border-stone-200 transition-all duration-200"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                              {act.time}
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-stone-500 hover:text-stone-700"
                                onClick={() => openEditActivity(day.date, act, idx)}
                              >
                                <Info className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-red-500 hover:text-red-700"
                                onClick={() => handleDeleteActivity(day.date, idx)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <h4 className="text-sm font-semibold text-stone-800 pr-12">{act.title}</h4>
                          {act.notes && (
                            <p className="text-xs text-stone-500 mt-1 italic line-clamp-2">
                              {act.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'Playfair Display, serif' }} className="text-stone-800">
                    {editingActivityIdx === null ? "Add Activity" : "Edit Activity"}
                  </DialogTitle>
                  <DialogDescription>
                    Schedule an event for {selectedDayDate && new Date(selectedDayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveActivity} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-medium">Time</label>
                    <Input 
                      type="time" 
                      value={activityForm.time}
                      onChange={(e) => setActivityForm({ ...activityForm, time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-medium">Title</label>
                    <Input 
                      placeholder="e.g. Visit Hawa Mahal"
                      value={activityForm.title}
                      onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-medium">Notes (Optional)</label>
                    <Input 
                      placeholder="e.g. Group entry tickets booked"
                      value={activityForm.notes}
                      onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="btn-primary">
                      Save Activity
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {isCreator && (
            <TabsContent value="admin">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Join Requests */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Pending Join Requests
                    </CardTitle>
                    <CardDescription>Review and approve group requests to join this trip</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!trip.pending_members || trip.pending_members.length === 0 ? (
                      <p className="text-sm text-stone-500 italic">No pending join requests.</p>
                    ) : (
                      <div className="divide-y divide-stone-100">
                        {trip.pending_members.map((pending, i) => (
                          <div key={i} className="py-3 flex justify-between items-center text-sm">
                            <div>
                              <span className="font-semibold text-stone-800">{pending.name}</span>
                              <p className="text-xs text-stone-400 mt-0.5">
                                Requested: {pending.requested_at ? new Date(pending.requested_at).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-[#008080] hover:bg-[#006666] text-white"
                                onClick={() => handleApproveMember(pending.name)}
                                data-testid={`approve-btn-${pending.name.toLowerCase()}`}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleRejectMember(pending.name)}
                                data-testid={`reject-btn-${pending.name.toLowerCase()}`}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Member List with Join Time */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Members & Join Details
                    </CardTitle>
                    <CardDescription>Manage and view all group participants</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="divide-y divide-stone-100">
                      {trip.members?.map((member, i) => (
                        <div key={i} className="py-3 flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            {member.is_creator && <Crown className="w-4 h-4 text-[#FF9933]" />}
                            <span className="font-semibold text-stone-800">{member.name}</span>
                            {member.is_creator && (
                              <Badge className="bg-[#FF9933] text-white text-[10px]">Creator / Admin</Badge>
                            )}
                          </div>
                          <span className="text-xs text-stone-400">
                            Joined: {member.joined_at ? new Date(member.joined_at).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Vote Counts Summary & Finalization */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Voting Status & Controls
                    </CardTitle>
                    <CardDescription>Review all cast votes and finalize trip results</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Destination Votes */}
                    <div>
                      <h3 className="font-semibold text-sm text-stone-700 mb-3 uppercase tracking-wider">Destination Vote Counts</h3>
                      {results?.destination_votes && Object.keys(results.destination_votes).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(results.destination_votes)
                            .sort((a, b) => b[1] - a[1])
                            .map(([destId, votes]) => {
                              const dest = destinations.find(d => d.id === destId);
                              return (
                                <div key={destId} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-lg text-sm">
                                  <span className="font-medium text-stone-800">{dest?.name || destId}</span>
                                  <Badge className="bg-[#FF9933]">{votes} {votes === 1 ? 'vote' : 'votes'}</Badge>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500 italic">No destination votes registered yet.</p>
                      )}
                    </div>

                    {/* Hotel Votes */}
                    <div>
                      <h3 className="font-semibold text-sm text-stone-700 mb-3 uppercase tracking-wider">Hotel Vote Counts</h3>
                      {results?.hotel_votes && Object.keys(results.hotel_votes).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(results.hotel_votes)
                            .sort((a, b) => b[1] - a[1])
                            .map(([hotelId, votes]) => {
                              const hotelObj = hotels.find(h => h.id === hotelId);
                              return (
                                <div key={hotelId} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-lg text-sm">
                                  <span className="font-medium text-stone-800">{hotelObj?.name || hotelId}</span>
                                  <Badge className="bg-teal-600">{votes} {votes === 1 ? 'vote' : 'votes'}</Badge>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500 italic">No hotel votes registered yet.</p>
                      )}
                    </div>

                    {/* Finalize Button */}
                    <div className="pt-4 border-t border-stone-100">
                      {trip.status !== 'finalized' ? (
                        <Button 
                          className="w-full btn-primary py-5 text-base font-semibold"
                          onClick={handleFinalize}
                          data-testid="admin-finalize-btn"
                        >
                          <Check className="w-5 h-5 mr-2" /> Finalize Trip with Current Winners
                        </Button>
                      ) : (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                          <Check className="w-6 h-6 text-green-600 mx-auto mb-1.5" />
                          <p className="font-bold text-green-800 text-sm">Trip Finalized</p>
                          <p className="text-xs text-green-600 mt-0.5">
                            Winner: {trip.selected_destination} &bull; Hotel: {trip.selected_hotel || 'None'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

const ComparePage = () => {
  const [destinations, setDestinations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    mockApi.getDestinations().then(data => { setDestinations(data); setLoading(false); });
  }, []);

  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else if (selected.length < 4) {
      setSelected([...selected, id]);
    } else {
      toast.error('Maximum 4 destinations can be compared');
    }
  };

  const handleCompare = async () => {
    if (selected.length < 2) {
      toast.error('Select at least 2 destinations to compare');
      return;
    }

    setComparing(true);
    try {
      const response = await mockApi.compareItems({
        item_type: 'destinations',
        item_ids: selected
      });
      setComparison(response);
    } catch (error) {
      toast.error('Failed to compare');
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20 pb-20" data-testid="compare-page">
      <Navbar />
      <div className="section-container py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Compare Destinations</h1>
        <p className="text-stone-500 mb-8">Select up to 4 destinations to compare budgets, hotels, and more</p>

        {!comparison ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {destinations.map((dest) => (
                <DestinationCard
                  key={dest.id}
                  destination={dest}
                  selectable
                  selected={selected.includes(dest.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>

            {selected.length > 0 && (
              <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t md:relative md:bottom-0 md:border-0 md:bg-transparent md:p-0">
                <Button className="btn-primary w-full md:w-auto" onClick={handleCompare} disabled={comparing} data-testid="compare-btn">
                  {comparing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Scale className="w-5 h-5 mr-2" />}
                  Compare {selected.length} Destinations
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" className="mb-6" onClick={() => setComparison(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Selection
            </Button>

            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl shadow-sm" data-testid="comparison-table">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left text-stone-500 font-medium">Attribute</th>
                    {comparison.items.map((item) => (
                      <th key={item.id} className="p-4 text-center">
                        <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-lg object-cover mx-auto mb-2" />
                        <span className="font-bold text-stone-800">{item.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4 text-stone-600">State</td>
                    {comparison.items.map((item) => (
                      <td key={item.id} className="p-4 text-center font-medium">{item.state}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 text-stone-600">Best Time</td>
                    {comparison.items.map((item) => (
                      <td key={item.id} className="p-4 text-center">{item.best_time_to_visit}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 text-stone-600">Daily Budget</td>
                    {comparison.items.map((item) => (
                      <td key={item.id} className="p-4 text-center">
                        <Badge className="bg-[#FF9933]">₹{item.budget_per_day}</Badge>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 text-stone-600">Avg Hotel Price</td>
                    {comparison.items.map((item) => (
                      <td key={item.id} className="p-4 text-center">₹{item.avg_hotel_price}/night</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 text-stone-600">Popular For</td>
                    {comparison.items.map((item) => (
                      <td key={item.id} className="p-4 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {item.popular_for?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

const AISuggestPage = () => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [formData, setFormData] = useState({
    group_type: 'friends',
    budget_per_person: '',
    duration_days: '',
    group_size: '',
    interests: []
  });

  const interests = ['Beaches', 'Mountains', 'History', 'Wildlife', 'Spirituality', 'Adventure', 'Food', 'Culture'];

  const handleSubmit = async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      toast.error('Please enter your Gemini API key first');
      return;
    }

    setLoading(true);
    try {
      const prompt = `You are a travel expert. Suggest 3 ideal travel destinations in India for someone with these preferences: 
   Budget: ₹${formData.budget_per_person}, Group/Style: ${formData.group_type}, Interests: ${formData.interests.join(',')}, Duration: ${formData.duration_days} days, Group size: ${formData.group_size}.
   For each destination give: name, state/country, why it matches, best time to go, estimated cost, top 3 activities. Give me a clear text response.`;

      const response = await callGemini(prompt, apiKey);
      setSuggestions({ suggestions: response });
    } catch (error) {
      toast.error('Failed to get AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20 pb-20" data-testid="ai-suggest-page">
      <Navbar />
      <div className="section-container py-8">
        <GeminiKeyInput />
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-[#FF9933]" />
          <h1 className="text-3xl md:text-4xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>AI Travel Suggestions</h1>
        </div>
        <p className="text-stone-500 mb-8">Let AI recommend the perfect destination for your group</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Tell us about your group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Group Type</label>
                <Select value={formData.group_type} onValueChange={(v) => setFormData({ ...formData, group_type: v })}>
                  <SelectTrigger data-testid="ai-group-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friends">Friends</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="corporate">Corporate Team</SelectItem>
                    <SelectItem value="couple">Couple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Budget per Person (₹)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 15000"
                    value={formData.budget_per_person}
                    onChange={(e) => setFormData({ ...formData, budget_per_person: e.target.value })}
                    data-testid="ai-budget"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Duration (days)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                    data-testid="ai-duration"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Group Size</label>
                <Input
                  type="number"
                  placeholder="e.g., 6"
                  value={formData.group_size}
                  onChange={(e) => setFormData({ ...formData, group_size: e.target.value })}
                  data-testid="ai-group-size"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant={formData.interests.includes(interest) ? "default" : "secondary"}
                      className={`cursor-pointer ${formData.interests.includes(interest) ? 'bg-[#FF9933]' : ''}`}
                      onClick={() => {
                        if (formData.interests.includes(interest)) {
                          setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) });
                        } else {
                          setFormData({ ...formData, interests: [...formData.interests, interest] });
                        }
                      }}
                      data-testid={`interest-${interest.toLowerCase()}`}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button className="btn-primary w-full" onClick={handleSubmit} disabled={loading} data-testid="get-suggestions-btn">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                Get AI Suggestions
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FF9933]" />
                </div>
              ) : suggestions ? (
                <div className="prose prose-stone" data-testid="ai-suggestions-result">
                  <p className="whitespace-pre-line">{suggestions.suggestions}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400">
                  <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                  <p>Fill in your preferences and click "Get AI Suggestions"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

const ChangeMapBounds = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
};

const RoutePlannerPage = () => {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [intermediateStops, setIntermediateStops] = useState([]);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    mockApi.getDestinations().then(data => {
      setDestinations(data);
      setLoading(false);
      const vadodara = data.find(d => d.id === 'vadodara');
      const ahmedabad = data.find(d => d.id === 'ahmedabad');
      if (vadodara && ahmedabad) {
        setStartId('vadodara');
        setEndId('ahmedabad');
      } else if (data.length > 1) {
        setStartId(data[0].id);
        setEndId(data[1].id);
      }
    });
  }, []);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findStopsAlongRoute = (coords, allDestinations, start, end) => {
    const stops = [];
    const thresholdKm = 30; // 30 km threshold
    
    const step = Math.max(1, Math.floor(coords.length / 50));
    const sampledCoords = [];
    for (let i = 0; i < coords.length; i += step) {
      sampledCoords.push(coords[i]);
    }
    sampledCoords.push(coords[coords.length - 1]);
    
    for (const dest of allDestinations) {
      if (dest.id === start || dest.id === end) continue;
      
      let minDistance = Infinity;
      for (const p of sampledCoords) {
        const d = getDistance(dest.latitude, dest.longitude, p[0], p[1]);
        if (d < minDistance) {
          minDistance = d;
        }
        if (d < thresholdKm) break;
      }
      
      if (minDistance < thresholdKm) {
        stops.push(dest);
      }
    }
    return stops;
  };

  const handleCalculateRoute = async () => {
    if (!startId || !endId) return;
    if (startId === endId) {
      toast.error("Please select two different cities.");
      return;
    }
    
    setCalculating(true);
    setRouteCoords(null);
    setIntermediateStops([]);
    
    try {
      const startCity = destinations.find(d => d.id === startId);
      const endCity = destinations.find(d => d.id === endId);
      if (!startCity || !endCity) return;
      
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startCity.longitude},${startCity.latitude};${endCity.longitude},${endCity.latitude}?overview=full&geometries=geojson`);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRouteCoords(coords);
        
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationHrs = route.duration / 3600;
        let durationStr = "";
        if (durationHrs >= 1) {
          const hrs = Math.floor(durationHrs);
          const mins = Math.round((durationHrs - hrs) * 60);
          durationStr = `${hrs} hr ${mins} mins`;
        } else {
          durationStr = `${Math.round(durationHrs * 60)} mins`;
        }
        
        setRouteDetails({
          distance: distanceKm,
          duration: durationStr,
          durationRaw: route.duration
        });
        
        const stops = findStopsAlongRoute(coords, destinations, startId, endId);
        setIntermediateStops(stops);
      } else {
        throw new Error("OSRM failed");
      }
    } catch (err) {
      console.error(err);
      const startCity = destinations.find(d => d.id === startId);
      const endCity = destinations.find(d => d.id === endId);
      if (startCity && endCity) {
        const fallbackCoords = [
          [startCity.latitude, startCity.longitude],
          [endCity.latitude, endCity.longitude]
        ];
        setRouteCoords(fallbackCoords);
        const distanceKm = getDistance(startCity.latitude, startCity.longitude, endCity.latitude, endCity.longitude).toFixed(1);
        const durationHrs = distanceKm / 60;
        const hrs = Math.floor(durationHrs);
        const mins = Math.round((durationHrs - hrs) * 60);
        
        setRouteDetails({
          distance: distanceKm,
          duration: hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`,
          durationRaw: durationHrs * 3600
        });
        
        const stops = findStopsAlongRoute(fallbackCoords, destinations, startId, endId);
        setIntermediateStops(stops);
        toast.info("Showing straight-line estimation.");
      }
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (startId && endId && startId !== endId) {
      handleCalculateRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startId, endId]);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] pt-20">
        <Navbar />
        <div className="section-container py-12">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-[400px] lg:col-span-1 rounded-xl" />
            <Skeleton className="h-[500px] lg:col-span-2 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const startCity = destinations.find(d => d.id === startId);
  const endCity = destinations.find(d => d.id === endId);

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20 pb-20" data-testid="route-planner-page">
      <Navbar />
      <div className="section-container py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Route Planner</h1>
          <p className="text-stone-500">Plan your journey and explore attractions, hotels, and transport routes between cities</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6 lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>Choose Route</CardTitle>
                <CardDescription>Select start and destination cities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-500">Starting City</label>
                  <Select value={startId} onValueChange={setStartId}>
                    <SelectTrigger data-testid="start-city-select">
                      <SelectValue placeholder="Select starting point" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-500">Destination City</label>
                  <Select value={endId} onValueChange={setEndId}>
                    <SelectTrigger data-testid="end-city-select">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full btn-primary mt-2" 
                  onClick={handleCalculateRoute} 
                  disabled={calculating || startId === endId}
                  data-testid="calculate-route-btn"
                >
                  {calculating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating...</>
                  ) : (
                    <><Navigation className="w-4 h-4 mr-2" /> Find Route</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {routeDetails && (
              <Card className="border-[#008080]/20 bg-white" data-testid="route-stats-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    <Map className="w-5 h-5 text-[#008080]" /> Journey Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 bg-[#FAF9F6] p-4 rounded-xl">
                    <div>
                      <p className="text-xs text-stone-400">Total Distance</p>
                      <p className="text-2xl font-bold text-stone-800">{routeDetails.distance} km</p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-400">Est. Travel Time</p>
                      <p className="text-2xl font-bold text-stone-800">{routeDetails.duration}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-stone-700">Recommended Travel Options</h4>
                    
                    <div className="flex items-center justify-between p-3 border rounded-xl hover:border-[#FF9933]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Navigation className="w-5 h-5" /></div>
                        <div>
                          <p className="font-medium text-sm">Car / Cab</p>
                          <p className="text-xs text-stone-400">Door-to-door convenience</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-[#FF9933]"><IndianRupee className="w-3 h-3 inline" />{(routeDetails.distance * 11).toFixed(0).toLocaleString()}+</p>
                        <p className="text-xs text-stone-400">{routeDetails.duration}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-xl hover:border-[#FF9933]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Train className="w-5 h-5" /></div>
                        <div>
                          <p className="font-medium text-sm">Train Journey</p>
                          <p className="text-xs text-stone-400">Scenic & economical</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-[#FF9933]"><IndianRupee className="w-3 h-3 inline" />{Math.round(routeDetails.distance * 1.5)} - {Math.round(routeDetails.distance * 4)}</p>
                        <p className="text-xs text-stone-400">{Math.round(routeDetails.distance / 50 * 60)} mins</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-xl hover:border-[#FF9933]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600"><Bus className="w-5 h-5" /></div>
                        <div>
                          <p className="font-medium text-sm">Intercity Bus</p>
                          <p className="text-xs text-stone-400">Frequent scheduled departures</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-[#FF9933]"><IndianRupee className="w-3 h-3 inline" />{Math.round(routeDetails.distance * 2.5)} - {Math.round(routeDetails.distance * 4)}</p>
                        <p className="text-xs text-stone-400">{Math.round(routeDetails.distance / 45 * 60)} mins</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden" data-testid="route-map-card">
              <CardContent className="p-0">
                <div className="h-[450px] w-full relative">
                  <MapContainer center={startCity ? [startCity.latitude, startCity.longitude] : [22.3, 72.0]} zoom={8} className="h-full w-full">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    
                    {startCity && (
                      <Marker position={[startCity.latitude, startCity.longitude]}>
                        <Popup>
                          <strong>Start: {startCity.name}</strong><br />
                          {startCity.state}
                        </Popup>
                      </Marker>
                    )}
                    
                    {endCity && (
                      <Marker position={[endCity.latitude, endCity.longitude]}>
                        <Popup>
                          <strong>Destination: {endCity.name}</strong><br />
                          {endCity.state}
                        </Popup>
                      </Marker>
                    )}

                    {intermediateStops.map(stop => (
                      <Marker key={stop.id} position={[stop.latitude, stop.longitude]}>
                        <Popup>
                          <strong>Stop: {stop.name}</strong><br />
                          {stop.short_description}<br />
                          <button onClick={() => navigate(`/destination/${stop.id}`)} className="text-[#FF9933] hover:underline font-semibold mt-1">View Details</button>
                        </Popup>
                      </Marker>
                    ))}

                    {routeCoords && (
                      <Polyline positions={routeCoords} color="#008080" weight={5} opacity={0.8} />
                    )}

                    {routeCoords && <ChangeMapBounds coords={routeCoords} />}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {routeDetails && (
              <div>
                <h3 className="text-2xl font-bold text-stone-800 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Recommended Stops Along the Way</h3>
                {intermediateStops.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {intermediateStops.map(stop => (
                      <Card key={stop.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col md:flex-row h-44" onClick={() => navigate(`/destination/${stop.id}`)} data-testid={`stop-card-${stop.id}`}>
                        <div className="md:w-2/5 h-2/5 md:h-full relative">
                          <img src={stop.image_url} alt={stop.name} className="w-full h-full object-cover" />
                        </div>
                        <CardContent className="md:w-3/5 p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1 mb-1 text-[#FF9933]">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="text-xs font-semibold">{stop.state}</span>
                            </div>
                            <h4 className="font-bold text-lg text-stone-800 leading-tight mb-1">{stop.name}</h4>
                            <p className="text-stone-500 text-xs line-clamp-2">{stop.short_description}</p>
                          </div>
                          <div className="flex items-center justify-between text-xs text-stone-400">
                            <span>Daily: ₹{stop.budget_per_day}</span>
                            <span className="text-[#FF9933] font-semibold flex items-center gap-0.5">Explore <ArrowRight className="w-3 h-3" /></span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-[#FAF9F6] border-dashed border-2 flex items-center justify-center p-8 text-center">
                    <div>
                      <MapPin className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-stone-400 italic">No registered destinations are directly along this route line. Select other cities to explore intermediate stops.</p>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ExplorePage = () => {

  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockApi.getDestinations().then(data => { setDestinations(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-20 pb-20" data-testid="explore-page">
      <Navbar />
      <div className="section-container py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Explore Gujarat</h1>
        <p className="text-stone-500 mb-8">Discover amazing destinations across the state</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)
          ) : (
            destinations.map((dest) => <DestinationCard key={dest.id} destination={dest} />)
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const createDivIcon = (color, emoji) => {
  return L.divIcon({
    html: `<div class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-md text-base" style="background-color: ${color}; cursor: pointer; display: flex; align-items: center; justify-content: center;">
             <span style="font-size: 14px; line-height: 1;">${emoji}</span>
           </div>`,
    className: "custom-leaflet-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const createClusterIcon = (count) => {
  return L.divIcon({
    html: `<div class="flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-lg text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 transition-all transform hover:scale-105" style="cursor: pointer; display: flex; align-items: center; justify-content: center;">
             <span>${count}</span>
           </div>`,
    className: "custom-leaflet-cluster",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

const ChangeMapView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, 12);
    }
  }, [center, map]);
  return null;
};

const ClusterMapContent = ({ destination, hotels, attractions, shopping, transport, selectedNearbyPlace }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map]);

  const destLat = destination.latitude;
  const destLng = destination.longitude;

  useEffect(() => {
    if (selectedNearbyPlace && selectedNearbyPlace.latitude && selectedNearbyPlace.longitude) {
      map.flyTo([selectedNearbyPlace.latitude, selectedNearbyPlace.longitude], 16, {
        animate: true,
        duration: 1.5
      });
    }
  }, [selectedNearbyPlace, map]);

  const rawPlaces = [];

  hotels.forEach(h => {
    if (h.latitude && h.longitude) {
      rawPlaces.push({
        id: h.id,
        type: 'hotel',
        name: h.name,
        description: h.description,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        emoji: '🏨',
        color: '#2563EB'
      });
    }
  });

  attractions.forEach(a => {
    if (a.latitude && a.longitude) {
      rawPlaces.push({
        id: a.id,
        type: 'attraction',
        name: a.name,
        description: a.description,
        address: `Located in ${destination.name}`,
        latitude: a.latitude,
        longitude: a.longitude,
        emoji: '📷',
        color: '#10B981'
      });
    }
  });

  shopping.forEach(s => {
    if (s.latitude && s.longitude) {
      rawPlaces.push({
        id: s.id,
        type: 'shopping',
        name: s.name,
        description: s.description,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        emoji: '🛍️',
        color: '#F59E0B'
      });
    }
  });

  transport.forEach(t => {
    if (t.latitude && t.longitude) {
      const emoji = t.type === 'flight' ? '✈️' : t.type === 'train' ? '🚆' : t.type === 'bus' ? '🚌' : '🚕';
      rawPlaces.push({
        id: t.id,
        type: 'transport',
        name: t.name,
        description: t.description,
        address: t.address || `Located in ${destination.name}`,
        latitude: t.latitude,
        longitude: t.longitude,
        emoji: emoji,
        color: '#8B5CF6'
      });
    }
  });

  const nearbyPlaces = rawPlaces.filter(place => {
    const dist = calculateDistance(destLat, destLng, place.latitude, place.longitude);
    place.distanceFromCenter = dist;
    return dist <= 30;
  });

  let clusteredItems = [];
  if (zoom >= 14) {
    clusteredItems = nearbyPlaces.map(p => ({ ...p, isCluster: false }));
  } else {
    const threshold = 0.015 / Math.pow(1.8, Math.max(0, zoom - 10));
    const processed = new Set();

    nearbyPlaces.forEach((place, idx) => {
      if (processed.has(place.id)) return;

      const cluster = {
        isCluster: true,
        latitude: place.latitude,
        longitude: place.longitude,
        emoji: place.emoji,
        color: place.color,
        markers: [place]
      };
      processed.add(place.id);

      for (let j = idx + 1; j < nearbyPlaces.length; j++) {
        const other = nearbyPlaces[j];
        if (processed.has(other.id)) continue;

        const dist = Math.sqrt(
          Math.pow(place.latitude - other.latitude, 2) +
          Math.pow(place.longitude - other.longitude, 2)
        );

        if (dist < threshold) {
          cluster.markers.push(other);
          processed.add(other.id);
        }
      }

      if (cluster.markers.length === 1) {
        clusteredItems.push({ ...cluster.markers[0], isCluster: false });
      } else {
        const count = cluster.markers.length;
        cluster.latitude = cluster.markers.reduce((sum, m) => sum + m.latitude, 0) / count;
        cluster.longitude = cluster.markers.reduce((sum, m) => sum + m.longitude, 0) / count;
        clusteredItems.push(cluster);
      }
    });
  }

  return (
    <>
      <Marker 
        position={[destLat, destLng]} 
        icon={createDivIcon('#DC2626', '⭐')}
      >
        <Popup>
          <div className="p-2 space-y-2 text-stone-700 min-w-[200px]">
            <h4 className="font-bold text-sm text-stone-800 flex items-center gap-1">
              ⭐ {destination.name}
            </h4>
            <p className="text-xs text-stone-500 font-medium">{destination.state}</p>
            <p className="text-xs text-stone-600 leading-relaxed border-t pt-1.5">{destination.short_description}</p>
            <div className="flex gap-2 pt-2 border-t mt-1.5">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full text-[10px] h-7 bg-stone-700 hover:bg-stone-800 text-white rounded">
                  Open Maps
                </Button>
              </a>
              <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full text-[10px] h-7 bg-[#FF007F] hover:bg-[#E60072] text-white rounded">
                  Directions
                </Button>
              </a>
            </div>
          </div>
        </Popup>
      </Marker>

      {selectedNearbyPlace && selectedNearbyPlace.latitude && selectedNearbyPlace.longitude && (
        <>
          <Marker
            position={[selectedNearbyPlace.latitude, selectedNearbyPlace.longitude]}
            icon={createDivIcon('#E11D48', selectedNearbyPlace.amenity === 'restaurant' ? '🍔' : selectedNearbyPlace.amenity === 'atm' ? '🏪' : '💊')}
          />
          <Popup position={[selectedNearbyPlace.latitude, selectedNearbyPlace.longitude]}>
            <div className="p-2 space-y-1 text-stone-700 min-w-[150px]">
              <h4 className="font-bold text-sm text-stone-800">
                {selectedNearbyPlace.name}
              </h4>
              <p className="text-xs text-stone-500 font-medium capitalize">
                Category: {selectedNearbyPlace.amenity}
              </p>
              <p className="text-xs text-stone-500">
                Distance: {selectedNearbyPlace.distance} km
              </p>
            </div>
          </Popup>
        </>
      )}

      {clusteredItems.map((item, idx) => {
        if (item.isCluster) {
          return (
            <Marker 
              key={`cluster-${idx}`} 
              position={[item.latitude, item.longitude]}
              icon={createClusterIcon(item.markers.length)}
              eventHandlers={{
                click: () => {
                  map.setView([item.latitude, item.longitude], Math.min(18, map.getZoom() + 2));
                }
              }}
            />
          );
        }

        return (
          <Marker 
            key={item.id} 
            position={[item.latitude, item.longitude]} 
            icon={createDivIcon(item.color, item.emoji)}
          >
            <Popup>
              <div className="p-2 space-y-2 text-stone-700 min-w-[220px]">
                <h4 className="font-bold text-sm text-stone-800 flex items-center gap-1.5">
                  <span className="text-base">{item.emoji}</span>
                  <span className="truncate max-w-[160px]">{item.name}</span>
                </h4>
                <p className="text-[10px] font-semibold text-stone-500 capitalize">{item.type} &bull; {item.distanceFromCenter.toFixed(1)} km away</p>
                <p className="text-xs text-stone-500 italic mt-0.5 max-w-[200px] truncate">{item.address}</p>
                <p className="text-xs text-stone-600 leading-normal border-t pt-1.5 max-w-[200px] line-clamp-2">{item.description}</p>
                <div className="flex gap-2 pt-2 border-t mt-1.5">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full text-[10px] h-7 bg-stone-700 hover:bg-stone-800 text-white rounded">
                      Open Maps
                    </Button>
                  </a>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full text-[10px] h-7 bg-[#FF007F] hover:bg-[#E60072] text-white rounded">
                      Directions
                    </Button>
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

const DestinationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [weather, setWeather] = useState(null);
  const [nearbyData, setNearbyData] = useState(null);
  const [selectedNearbyPlace, setSelectedNearbyPlace] = useState(null);
  const [calcGroupSize, setCalcGroupSize] = useState(1);
  const [calcDuration, setCalcDuration] = useState(3);
  const [expenseEstimate, setExpenseEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [transport, setTransport] = useState([]);
  const [isFav, setIsFav] = useState(() => {
    const cached = JSON.parse(localStorage.getItem('favorites_cache') || '[]');
    return cached.includes(id);
  });

  useEffect(() => {
    const handleUpdate = () => {
      const cached = JSON.parse(localStorage.getItem('favorites_cache') || '[]');
      setIsFav(cached.includes(id));
    };
    window.addEventListener('favorites-updated', handleUpdate);
    return () => window.removeEventListener('favorites-updated', handleUpdate);
  }, [id]);

  const handlePageFavoriteToggle = async () => {
    let name = localStorage.getItem('member_name');
    if (!name) {
      name = prompt("Enter your display name to start favoriting destinations:");
      if (!name || !name.trim()) return;
      name = name.trim();
      localStorage.setItem('member_name', name);
    }

    const cached = JSON.parse(localStorage.getItem('favorites_cache') || '[]');
    if (isFav) {
      try {
        await mockApi.removeFavorite(name, id);
        const updated = cached.filter(item => item !== id);
        localStorage.setItem('favorites_cache', JSON.stringify(updated));
        window.dispatchEvent(new Event('favorites-updated'));
        toast.success(`Removed ${destination.name} from favorites`);
      } catch (err) {
        toast.error("Failed to remove favorite");
      }
    } else {
      try {
        await mockApi.addFavorite(name, id);
        const updated = [...cached, id];
        localStorage.setItem('favorites_cache', JSON.stringify(updated));
        window.dispatchEvent(new Event('favorites-updated'));
        toast.success(`Added ${destination.name} to favorites`);
      } catch (err) {
        toast.error("Failed to add favorite");
      }
    }
  };
  const [loading, setLoading] = useState(true);
  const [aiDescription, setAiDescription] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedAttraction, setSelectedAttraction] = useState(null);
  const [selectedShopping, setSelectedShopping] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cityInfo, setCityInfo] = useState(null);
  const [heritage, setHeritage] = useState([]);
  const [streetFood, setStreetFood] = useState([]);
  const [ashrams, setAshrams] = useState([]);
  const [textiles, setTextiles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ member_name: "", rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [
          destRes, hotelsRes, attractionsRes, shoppingRes, transportRes,
          cityInfoRes, heritageRes, streetFoodRes, ashramsRes, textilesRes,
          reviewsRes
        ] = await Promise.all([
          mockApi.getDestination(id),
          mockApi.getDestinationHotels(id),
          mockApi.getDestinationAttractions(id),
          mockApi.getDestinationShopping(id),
          mockApi.getDestinationTransport(id),
          mockApi.getDestinationCityInfo(id),
          mockApi.getDestinationHeritage(id),
          mockApi.getDestinationStreetFood(id),
          mockApi.getDestinationAshrams(id),
          mockApi.getDestinationTextiles(id),
          mockApi.getReviews(id)
        ]);

        setDestination(destRes);
        setHotels(hotelsRes);
        setAttractions(attractionsRes);
        setShopping(shoppingRes);
        setTransport(transportRes);
        setCityInfo(cityInfoRes);
        setHeritage(heritageRes);
        setStreetFood(streetFoodRes);
        setAshrams(ashramsRes);
        setTextiles(textilesRes);
        setReviews(reviewsRes);

        mockApi.getDestinationWeather(id)
          .then(setWeather)
          .catch(err => {
            console.error("Failed to load weather data gracefully caught:", err);
            setWeather(null);
          });

        mockApi.getDestinationNearby(id)
          .then(setNearbyData)
          .catch(err => {
            console.error("Failed to load nearby places gracefully caught:", err);
            setNearbyData({ error: true });
          });
      } catch (error) {
        toast.error('Failed to load destination');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    const groupSizeNum = Math.max(1, Number(calcGroupSize) || 1);
    const durationDaysNum = Math.max(1, Number(calcDuration) || 1);
    setLoadingEstimate(true);
    mockApi.getDestinationExpenseEstimate(id, groupSizeNum, durationDaysNum)
      .then(setExpenseEstimate)
      .catch(err => {
        console.error("Failed to load expense estimate:", err);
      })
      .finally(() => {
        setLoadingEstimate(false);
      });
  }, [id, calcGroupSize, calcDuration]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.member_name || !newReview.comment) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmittingReview(true);
    try {
      const savedReview = await mockApi.createReview(id, {
        member_name: newReview.member_name,
        rating: Number(newReview.rating),
        comment: newReview.comment
      });
      setReviews([savedReview, ...reviews]);
      setNewReview({ member_name: "", rating: 5, comment: "" });
      toast.success("Review submitted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "N/A";

  const fetchAIDescription = async (topic) => {
    if (!destination) return;

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      toast.error('Please configure your Gemini API key first to use AI features.');
      return;
    }

    setLoadingAI(true);
    try {
      const responseData = await mockApi.getAIDescription(destination.name, topic);

      console.log("Raw response object received from the AI description endpoint:", responseData);

      setAiDescription(responseData.description || "No response");
      toast.success('AI description generated!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate AI description');
    } finally {
      setLoadingAI(false);
    }
  };

  if (loading || !destination) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] pt-20">
        <Navbar />
        <Skeleton className="h-[50vh] w-full" />
        <div className="section-container py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const getTransportIcon = (type) => {
    switch (type) {
      case 'flight': return <Plane className="w-5 h-5" />;
      case 'train': return <Train className="w-5 h-5" />;
      case 'bus': return <Bus className="w-5 h-5" />;
      default: return <Navigation className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-20" data-testid="destination-page">
      <Navbar />

      <div className="relative h-[50vh] pt-16">
        <img src={destination.image_url} alt={destination.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="section-container">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white mb-4" data-testid="back-button">
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-5 h-5 text-[#FF9933]" />
              <span className="text-white/90">{destination.state}</span>
            </div>
            <div className="flex justify-between items-center gap-4 mb-4">
              <h1 className="text-4xl md:text-6xl font-bold text-white animate-fade-in" style={{ fontFamily: 'Playfair Display, serif' }} data-testid="destination-title">
                {destination.name}
              </h1>
              <button
                onClick={handlePageFavoriteToggle}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 flex items-center justify-center transition-all duration-300 text-white shadow-lg transform hover:scale-105"
                data-testid="favorite-toggle-btn"
              >
                <Heart className={`w-6 h-6 ${isFav ? 'text-red-500 fill-current animate-pulse' : ''}`} />
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {destination.popular_for?.map((tag) => {
                const tabValue = tag.toLowerCase().replace(" ", "");
                const isActive = activeTab === tabValue;
                return (
                  <Badge 
                    key={tag} 
                    onClick={() => setActiveTab(tabValue)}
                    className={`cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? "bg-[#FF9933] text-white border-[#FF9933] shadow-md scale-105" 
                        : "bg-white/20 text-white hover:bg-white/30 border-transparent"
                    }`}
                  >
                    {tag}
                  </Badge>
                );
              })}
              <Badge className="bg-[#FF9933] text-white"><Calendar className="w-3 h-3 mr-1" /> Best: {destination.best_time_to_visit}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="section-container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-white rounded-xl p-1 mb-8 overflow-x-auto">
            <TabsTrigger value="overview" className="tab-trigger" data-testid="tab-overview"><Info className="w-4 h-4 mr-2" /> Overview</TabsTrigger>
            <TabsTrigger value="hotels" className="tab-trigger" data-testid="tab-hotels"><Building2 className="w-4 h-4 mr-2" /> Hotels</TabsTrigger>
            <TabsTrigger value="attractions" className="tab-trigger" data-testid="tab-attractions"><Camera className="w-4 h-4 mr-2" /> Attractions</TabsTrigger>
            <TabsTrigger value="shopping" className="tab-trigger" data-testid="tab-shopping"><ShoppingBag className="w-4 h-4 mr-2" /> Shopping</TabsTrigger>
            <TabsTrigger value="transport" className="tab-trigger" data-testid="tab-transport"><Plane className="w-4 h-4 mr-2" /> Transport</TabsTrigger>
            <TabsTrigger value="map" className="tab-trigger" data-testid="tab-map"><MapPin className="w-4 h-4 mr-2" /> Map</TabsTrigger>
            <TabsTrigger value="weather" className="tab-trigger" data-testid="tab-weather"><CloudSun className="w-4 h-4 mr-2" /> Weather</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="mb-6">
                  <CardHeader><CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>About {destination.name}</CardTitle></CardHeader>
                  <CardContent><p className="text-stone-600 leading-relaxed">{destination.description}</p></CardContent>
                </Card>

                <GeminiKeyInput />
                <Card className="border-[#008080]/20">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}><Sparkles className="w-5 h-5 text-[#FF9933]" /> AI Travel Guide</CardTitle>
                    <div className="flex gap-2">
                      {['overview', 'culture', 'food', 'tips'].map((topic) => (
                        <Button key={topic} variant="outline" size="sm" onClick={() => fetchAIDescription(topic)} disabled={loadingAI} className="capitalize" data-testid={`ai-btn-${topic}`}>{topic}</Button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingAI ? (
                      <div className="flex items-center gap-3 text-stone-500"><Loader2 className="w-5 h-5 animate-spin" /> Generating...</div>
                    ) : aiDescription ? (
                      <p className="text-stone-600 leading-relaxed whitespace-pre-line" data-testid="ai-description">{aiDescription}</p>
                    ) : (
                      <p className="text-stone-400 italic">Click a topic above to generate AI-powered travel insights</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="mt-6 border-stone-200" data-testid="reviews-section">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                      <Users className="w-5 h-5 text-[#008080]" /> Member Reviews
                    </CardTitle>
                    <div className="flex items-center gap-1.5 bg-[#FF9933]/10 text-[#FF9933] px-3 py-1 rounded-full text-sm font-semibold" data-testid="average-rating">
                      <Star className="w-4 h-4 fill-current" /> Avg Rating: {avgRating}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Review Form */}
                    <form onSubmit={handleReviewSubmit} className="bg-stone-50 p-4 rounded-xl border border-stone-100 space-y-4" data-testid="review-form">
                      <h4 className="font-bold text-stone-800 text-sm">Write a Review</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-stone-500 font-medium block mb-1">Your Name</label>
                          <Input 
                            type="text" 
                            placeholder="Enter your name"
                            value={newReview.member_name}
                            onChange={(e) => setNewReview({ ...newReview, member_name: e.target.value })}
                            className="bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs text-stone-500 font-medium block mb-1">Rating</label>
                          <Select 
                            value={String(newReview.rating)}
                            onValueChange={(val) => setNewReview({ ...newReview, rating: Number(val) })}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((r) => (
                                <SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 font-medium block mb-1">Comment</label>
                        <textarea
                          placeholder="Share your experience..."
                          value={newReview.comment}
                          onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                          className="w-full min-h-[80px] rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          required
                        />
                      </div>
                      <Button type="submit" disabled={submittingReview} className="bg-[#008080] hover:bg-[#006666] text-white">
                        {submittingReview ? "Submitting..." : "Submit Review"}
                      </Button>
                    </form>

                    {/* Reviews List */}
                    <div className="space-y-4" data-testid="reviews-list">
                      {reviews.length === 0 ? (
                        <p className="text-stone-400 italic text-center py-4">No reviews yet. Be the first to share your thoughts!</p>
                      ) : (
                        reviews.map((rev) => (
                          <div key={rev.id || rev.created_at} className="border-b border-stone-100 pb-4 last:border-0 last:pb-0" data-testid="review-item">
                            <div className="flex justify-between items-start mb-1.5">
                              <div>
                                <span className="font-bold text-stone-800 text-sm">{rev.member_name}</span>
                                <span className="text-[10px] text-stone-400 block">{new Date(rev.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-0.5 text-[#FF9933]">
                                {Array.from({ length: rev.rating }).map((_, i) => (
                                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                ))}
                              </div>
                            </div>
                            <p className="text-stone-600 text-sm leading-relaxed">{rev.comment}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="mb-6">
                  <CardHeader><CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Quick Info</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#FF9933]/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-[#FF9933]" /></div>
                      <div><p className="text-sm text-stone-500">Best Time</p><p className="font-medium">{destination.best_time_to_visit}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#008080]/10 flex items-center justify-center"><IndianRupee className="w-5 h-5 text-[#008080]" /></div>
                      <div><p className="text-sm text-stone-500">Daily Budget</p><p className="font-medium">₹{destination.budget_per_day || 3000}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#FF007F]/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-[#FF007F]" /></div>
                      <div><p className="text-sm text-stone-500">Hotels</p><p className="font-medium">{hotels.length} options</p></div>
                    </div>
                    {weather && (
                      <div className="flex items-center gap-3 animate-fade-in" data-testid="weather-row">
                        <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center shadow-sm">
                          {weather.icon ? (
                            <img
                              src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
                              alt={weather.condition}
                              className="w-6 h-6 object-contain"
                              data-testid="weather-icon-small"
                            />
                          ) : (
                            <Compass className="w-5 h-5 text-sky-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-stone-500">Weather</p>
                          <p className="font-medium">{Math.round(weather.temp)}°C, <span className="capitalize">{weather.condition}</span></p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="mb-6 border-red-100 bg-red-50/10" data-testid="emergency-contacts-card">
                  <CardHeader className="pb-3"><CardTitle style={{ fontFamily: 'Playfair Display, serif' }} className="flex items-center gap-2 text-red-600"><Phone className="w-5 h-5 text-red-500 animate-pulse" /> Emergency Contacts</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {emergencyContacts.map((contact) => (
                      <div key={contact.label} className="flex justify-between items-center text-sm border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                        <span className="text-stone-600 font-medium">{contact.label}</span>
                        <span className="font-bold text-[#008080]">
                          {contact.numbers.map((num, i) => (
                            <span key={num}>
                              {i > 0 && <span className="text-stone-400 font-normal mx-1">/</span>}
                              <a href={`tel:${num}`} className="hover:text-red-500 hover:underline transition-colors">{num}</a>
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="mb-6 border-teal-100 bg-teal-50/5" data-testid="expense-calculator-card">
                  <CardHeader className="pb-3">
                    <CardTitle style={{ fontFamily: 'Playfair Display, serif' }} className="flex items-center gap-2 text-teal-800">
                      <IndianRupee className="w-5 h-5 text-teal-600" /> Expense Calculator
                    </CardTitle>
                    <CardDescription>Estimate your travel budget breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-stone-500 font-medium block mb-1">Group Size</label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={calcGroupSize} 
                          onChange={(e) => setCalcGroupSize(e.target.value)}
                          className="h-9 border-stone-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 font-medium block mb-1">Duration (Days)</label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={calcDuration} 
                          onChange={(e) => setCalcDuration(e.target.value)}
                          className="h-9 border-stone-200"
                        />
                      </div>
                    </div>

                    {loadingEstimate ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      </div>
                    ) : expenseEstimate ? (
                      <div className="space-y-3 pt-2 border-t border-stone-100">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-stone-600">🏨 Accommodation (40%)</span>
                          <span className="font-semibold text-stone-800">₹{expenseEstimate.total_accommodation_hotel.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-stone-600">🍔 Food & Dining (30%)</span>
                          <span className="font-semibold text-stone-800">₹{expenseEstimate.total_food.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-stone-600">✈️ Transportation (20%)</span>
                          <span className="font-semibold text-stone-800">₹{expenseEstimate.total_transport.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-stone-600">🛍️ Miscellaneous (10%)</span>
                          <span className="font-semibold text-stone-800">₹{expenseEstimate.total_misc.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-stone-200 font-bold text-teal-800 bg-teal-50/20 p-1.5 rounded">
                          <span>Grand Total</span>
                          <span>₹{expenseEstimate.grand_total.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hotels">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotels.map((hotel) => (
                <Card 
                  key={hotel.id} 
                  className="hotel-card overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1" 
                  onClick={() => setSelectedHotel(hotel)}
                  data-testid={`hotel-card-${hotel.id}`}
                >
                  <div className="relative h-48">
                    <img src={hotel.image_url} alt={hotel.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 price-tag"><IndianRupee className="w-4 h-4 inline" />{hotel.price_per_night.toLocaleString()}/night</div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-stone-800">{hotel.name}</h3>
                      <div className="flex items-center gap-1 text-[#FF9933]"><Star className="w-4 h-4 fill-current" /><span className="font-medium">{hotel.rating}</span></div>
                    </div>
                    <p className="text-stone-500 text-sm mb-3 line-clamp-2">{hotel.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {hotel.amenities?.slice(0, 4).map((a) => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="attractions">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attractions.map((attr) => (
                <Card 
                  key={attr.id} 
                  className="hotel-card overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1" 
                  onClick={() => setSelectedAttraction(attr)}
                  data-testid={`attraction-card-${attr.id}`}
                >
                  <div className="relative h-48">
                    <img src={attr.image_url} alt={attr.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3"><Badge className="bg-[#008080] text-white">{attr.category}</Badge></div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg text-stone-800 mb-2">{attr.name}</h3>
                    <p className="text-stone-500 text-sm mb-3 line-clamp-2">{attr.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-stone-500"><Clock className="w-4 h-4" />{attr.timings}</div>
                      <div className="flex items-center gap-1 text-[#FF9933] font-medium"><IndianRupee className="w-4 h-4" />{attr.entry_fee === 0 ? 'Free' : attr.entry_fee}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shopping">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shopping.map((shop) => (
                <Card 
                  key={shop.id} 
                  className="hotel-card overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1" 
                  onClick={() => setSelectedShopping(shop)}
                  data-testid={`shopping-card-${shop.id}`}
                >
                  <div className="relative h-48"><img src={shop.image_url} alt={shop.name} className="w-full h-full object-cover" /></div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg text-stone-800 mb-2">{shop.name}</h3>
                    <p className="text-stone-500 text-sm mb-3 line-clamp-2">{shop.description}</p>
                    <div className="flex items-center gap-2 text-stone-400 text-sm"><MapPin className="w-4 h-4" />{shop.address}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transport">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {transport.map((item) => (
                <Card 
                  key={item.id} 
                  className="transport-card cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1" 
                  onClick={() => setSelectedTransport(item)}
                  data-testid={`transport-card-${item.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === 'flight' ? 'bg-blue-100 text-blue-600' : item.type === 'train' ? 'bg-green-100 text-green-600' : item.type === 'bus' ? 'bg-yellow-100 text-yellow-600' : 'bg-purple-100 text-purple-600'}`}>
                      {getTransportIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <Badge variant="outline" className="capitalize mb-1">{item.type}</Badge>
                      <h3 className="font-bold text-lg text-stone-800 mb-1">{item.name}</h3>
                      <p className="text-stone-500 text-sm mb-3">{item.description}</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-stone-400">From</p><p className="font-medium">{item.from_location}</p></div>
                        <div><p className="text-stone-400">Duration</p><p className="font-medium">{item.duration}</p></div>
                      </div>
                      <div className="mt-4 pt-4 border-t flex items-center justify-between">
                        <span className="text-stone-500">Price Range</span>
                        <span className="text-lg font-bold text-[#FF9933]">{item.price_range}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="map">
            <Card className={isFullscreen ? "fixed inset-0 z-[9999] h-screen w-screen rounded-none p-4 bg-white flex flex-col overflow-hidden" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle style={{ fontFamily: 'Playfair Display, serif' }} className="text-2xl font-bold">Explore {destination.name}</CardTitle>
                  <CardDescription>Interactive map displaying nearby hotels, attractions, shopping spots, and transport hubs</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex items-center gap-1.5 border-stone-200 text-stone-700 hover:bg-stone-50"
                  >
                    {isFullscreen ? <X className="w-4 h-4" /> : <Map className="w-4 h-4" />}
                    {isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative">
                <div className="w-full h-full min-h-[400px]" style={{ height: isFullscreen ? "calc(100vh - 120px)" : "500px" }}>
                  <MapContainer 
                    key={`${destination.id}-${isFullscreen}`}
                    center={[destination.latitude, destination.longitude]} 
                    zoom={12} 
                    className="h-full w-full rounded-b-xl border border-stone-100 shadow-sm"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <ChangeMapView center={[destination.latitude, destination.longitude]} />
                    <ClusterMapContent 
                      destination={destination}
                      hotels={hotels}
                      attractions={attractions}
                      shopping={shopping}
                      transport={transport}
                      selectedNearbyPlace={selectedNearbyPlace}
                    />
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {!isFullscreen && (
              <Card className="mt-6 border-stone-200" data-testid="nearby-places-section">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                    <MapPin className="w-5 h-5 text-[#008080]" /> Nearby Places (Within 5km)
                  </CardTitle>
                  <CardDescription>Local amenities from OpenStreetMap (Overpass API)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!nearbyData ? (
                    <div className="flex items-center gap-3 text-stone-500 py-4 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" /> Loading nearby places...
                    </div>
                  ) : nearbyData.error ? (
                    <div className="text-stone-500 text-sm py-4 text-center">
                      Nearby places unavailable
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Restaurants */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-stone-800 border-b pb-2 flex items-center gap-2">
                          🍔 Restaurants
                        </h4>
                        {nearbyData.restaurants && nearbyData.restaurants.length > 0 ? (
                          <ul className="space-y-2 text-sm text-stone-600">
                            {nearbyData.restaurants.map((place, idx) => {
                              const isSel = selectedNearbyPlace && selectedNearbyPlace.name === place.name && selectedNearbyPlace.latitude === place.latitude;
                              return (
                                <li 
                                  key={idx} 
                                  className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors duration-150 ${
                                    isSel
                                      ? "bg-teal-50 border-teal-200 text-teal-900 font-semibold shadow-sm"
                                      : "bg-stone-50 border-stone-100/60 hover:bg-stone-100/80 text-stone-600"
                                  }`}
                                  onClick={() => setSelectedNearbyPlace(place)}
                                >
                                  <span className="truncate max-w-[150px]" title={place.name}>{place.name}</span>
                                  <span className="text-xs text-stone-400 font-semibold shrink-0">{place.distance} km</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-stone-400 italic">No restaurants found within 5km</p>
                        )}
                      </div>

                      {/* ATMs */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-stone-800 border-b pb-2 flex items-center gap-2">
                          🏪 ATMs
                        </h4>
                        {nearbyData.atms && nearbyData.atms.length > 0 ? (
                          <ul className="space-y-2 text-sm text-stone-600">
                            {nearbyData.atms.map((place, idx) => {
                              const isSel = selectedNearbyPlace && selectedNearbyPlace.name === place.name && selectedNearbyPlace.latitude === place.latitude;
                              return (
                                <li 
                                  key={idx} 
                                  className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors duration-150 ${
                                    isSel
                                      ? "bg-teal-50 border-teal-200 text-teal-900 font-semibold shadow-sm"
                                      : "bg-stone-50 border-stone-100/60 hover:bg-stone-100/80 text-stone-600"
                                  }`}
                                  onClick={() => setSelectedNearbyPlace(place)}
                                >
                                  <span className="truncate max-w-[150px]" title={place.name}>{place.name}</span>
                                  <span className="text-xs text-stone-400 font-semibold shrink-0">{place.distance} km</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-stone-400 italic">No ATMs found within 5km</p>
                        )}
                      </div>

                      {/* Pharmacies */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-stone-800 border-b pb-2 flex items-center gap-2">
                          💊 Pharmacies
                        </h4>
                        {nearbyData.pharmacies && nearbyData.pharmacies.length > 0 ? (
                          <ul className="space-y-2 text-sm text-stone-600">
                            {nearbyData.pharmacies.map((place, idx) => {
                              const isSel = selectedNearbyPlace && selectedNearbyPlace.name === place.name && selectedNearbyPlace.latitude === place.latitude;
                              return (
                                <li 
                                  key={idx} 
                                  className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors duration-150 ${
                                    isSel
                                      ? "bg-teal-50 border-teal-200 text-teal-900 font-semibold shadow-sm"
                                      : "bg-stone-50 border-stone-100/60 hover:bg-stone-100/80 text-stone-600"
                                  }`}
                                  onClick={() => setSelectedNearbyPlace(place)}
                                >
                                  <span className="truncate max-w-[150px]" title={place.name}>{place.name}</span>
                                  <span className="text-xs text-stone-400 font-semibold shrink-0">{place.distance} km</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-stone-400 italic">No pharmacies found within 5km</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="city">
            {cityInfo && (
              <Card className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="h-96 md:h-full relative min-h-[300px]">
                    <img src={cityInfo.image_url} alt={destination.name} className="w-full h-full object-cover" />
                  </div>
                  <CardContent className="p-8 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div>
                        <Badge className="bg-[#FF9933] text-white mb-2">{cityInfo.state}</Badge>
                        <h2 className="text-3xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>{destination.name} Overview</h2>
                      </div>
                      <p className="text-stone-600 leading-relaxed text-sm">{cityInfo.overview}</p>
                      
                      <div className="grid grid-cols-2 gap-6 border-t pt-6 text-sm text-stone-700">
                        <div>
                          <p className="text-stone-400 font-medium">District</p>
                          <p className="font-semibold text-stone-800 mt-0.5">{cityInfo.district}</p>
                        </div>
                        <div>
                          <p className="text-stone-400 font-medium">Population</p>
                          <p className="font-semibold text-stone-800 mt-0.5">{cityInfo.population}</p>
                        </div>
                        <div>
                          <p className="text-stone-400 font-medium">Famous For</p>
                          <p className="font-semibold text-stone-800 mt-0.5">{cityInfo.famous_for}</p>
                        </div>
                        <div>
                          <p className="text-stone-400 font-medium">Best Time to Visit</p>
                          <p className="font-semibold text-[#FF9933] mt-0.5">{cityInfo.best_time_to_visit}</p>
                        </div>
                        <div>
                          <p className="text-stone-400 font-medium">Languages Spoken</p>
                          <p className="font-semibold text-stone-800 mt-0.5">{cityInfo.languages}</p>
                        </div>
                        <div>
                          <p className="text-stone-400 font-medium">Climate</p>
                          <p className="font-semibold text-stone-800 mt-0.5">{cityInfo.climate}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="heritage">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {heritage.map((item) => (
                <Card key={item.id} className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="h-64 relative">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      {item.unesco_status && item.unesco_status.toLowerCase().includes('yes') && (
                        <Badge className="absolute top-4 right-4 bg-emerald-600 text-white">UNESCO Heritage</Badge>
                      )}
                    </div>
                    <CardContent className="p-6 space-y-4">
                      <h3 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>{item.name}</h3>
                      <p className="text-stone-600 text-sm leading-relaxed">{item.description}</p>
                      
                      <div className="border-t pt-4 space-y-3 text-xs text-stone-700">
                        <div>
                          <span className="font-bold text-stone-800 block mb-1">History</span>
                          <p className="text-stone-500 leading-normal">{item.history}</p>
                        </div>
                        <div>
                          <span className="font-bold text-stone-800 block mb-1">Cultural Importance</span>
                          <p className="text-stone-500 leading-normal">{item.importance}</p>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="streetfood">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {streetFood.map((food) => (
                <Card key={food.id} className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="h-56 relative">
                      <img src={food.image_url} alt={food.name} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-bold text-lg text-stone-800">{food.name}</h3>
                      <p className="text-stone-500 text-sm leading-relaxed line-clamp-3">{food.description}</p>
                    </CardContent>
                  </div>
                  <div className="px-5 pb-5 pt-4 border-t flex items-center justify-between text-xs text-stone-500">
                    <span>Famous Market:</span>
                    <span className="font-semibold text-stone-700">{food.famous_food_market}</span>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ashram">
            {ashrams.length === 0 || (ashrams.length === 1 && ashrams[0].name.includes("No famous Ashram")) ? (
              <Card className="p-12 text-center text-stone-500 font-medium border-dashed border-2 flex flex-col items-center justify-center bg-stone-50">
                <Heart className="w-12 h-12 text-stone-300 mb-4" />
                <p className="text-lg">No famous Ashram available for this destination.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ashrams.map((ashram) => (
                  <Card key={ashram.id} className="overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="h-64 relative">
                        <img src={ashram.image_url} alt={ashram.name} className="w-full h-full object-cover" />
                      </div>
                      <CardContent className="p-6 space-y-4">
                        <h3 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>{ashram.name}</h3>
                        <p className="text-stone-600 text-sm leading-relaxed">{ashram.description}</p>
                        
                        <div className="border-t pt-4 text-xs text-stone-700 space-y-2">
                          <p className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-stone-400" /> <span className="font-medium text-stone-600">{ashram.address}</span></p>
                        </div>
                      </CardContent>
                    </div>
                    {ashram.google_maps && ashram.google_maps !== "N/A" && (
                      <div className="px-6 pb-6 pt-0">
                        <a href={ashram.google_maps} target="_blank" rel="noopener noreferrer">
                          <Button className="w-full bg-[#FF9933] hover:bg-[#e68a2e] text-white flex items-center justify-center gap-2">
                            <Navigation className="w-4 h-4" /> Get Directions (Google Maps)
                          </Button>
                        </a>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="textiles">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {textiles.map((item) => (
                <Card key={item.id} className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="h-64 relative">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-6 space-y-3">
                      <h3 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>{item.name}</h3>
                      <p className="text-stone-600 text-sm leading-relaxed">{item.description}</p>
                    </CardContent>
                  </div>
                  <div className="px-6 pb-6 pt-4 border-t flex items-center justify-between text-xs text-stone-500">
                    <span>Famous Shopping Area:</span>
                    <span className="font-semibold text-stone-700">{item.famous_shopping_area}</span>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="weather" data-testid="weather-tab-content">
            <Card className="max-w-md mx-auto overflow-hidden bg-gradient-to-br from-sky-50 to-blue-50/50 border-blue-100 shadow-lg p-6 animate-fade-in">
              <CardHeader className="p-0 pb-4 text-center">
                <CardTitle className="text-xl font-bold text-stone-700 flex items-center justify-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  <CloudSun className="w-5 h-5 text-sky-500" /> Current Weather in {destination.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-center">
                {weather ? (
                  weather.error ? (
                    <div className="py-8 text-red-500 text-sm font-medium" data-testid="weather-error">
                      Weather error: {weather.reason}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-4">
                        {weather.icon && (
                          <div className="w-20 h-20 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/60 shadow-md">
                            <img
                              src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                              alt={weather.condition}
                              className="w-16 h-16 object-contain animate-pulse"
                              data-testid="weather-tab-icon"
                            />
                          </div>
                        )}
                        <div className="text-left">
                          <p className="text-5xl font-extrabold text-stone-800 tracking-tight">
                            {Math.round(weather.temp)}°C
                          </p>
                          <p className="text-lg font-semibold text-stone-700 mt-1 capitalize">
                            {weather.condition}
                          </p>
                          <p className="text-sm text-stone-500 capitalize">
                            {weather.description}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-stone-200/60 pt-4 grid grid-cols-2 gap-4 text-xs text-stone-500">
                        <div>
                          <span className="font-semibold text-stone-700 block">Latitude</span>
                          {destination.latitude}
                        </div>
                        <div>
                          <span className="font-semibold text-stone-700 block">Longitude</span>
                          {destination.longitude}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="py-8 text-stone-500 text-sm font-medium">
                    Weather data unavailable
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedHotel && (
          <Dialog open={!!selectedHotel} onOpenChange={(open) => !open && setSelectedHotel(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6" data-testid="hotel-details-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-stone-800 flex items-center justify-between">
                  <span>{selectedHotel.name}</span>
                  <span className="text-[#FF9933] text-lg font-semibold flex items-center gap-1">
                    <Star className="w-5 h-5 fill-current" />
                    {selectedHotel.rating}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-stone-500 font-medium">{selectedHotel.category} Hotel &bull; {selectedHotel.distance}</DialogDescription>
              </DialogHeader>

              {/* Image Gallery */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="col-span-3 h-64 rounded-xl overflow-hidden shadow-sm">
                  <img src={selectedHotel.image_url} alt={selectedHotel.name} className="w-full h-full object-cover" />
                </div>
                {selectedHotel.gallery?.map((img, idx) => (
                  <div key={idx} className="h-24 rounded-lg overflow-hidden shadow-sm">
                    <img src={img} alt={`${selectedHotel.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Information & Details */}
              <div className="space-y-4 text-stone-700">
                <div>
                  <h4 className="font-bold text-stone-800">About</h4>
                  <p className="text-stone-600 text-sm mt-1">{selectedHotel.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-[#FAF9F6] p-4 rounded-xl border border-stone-100 shadow-inner">
                  <div>
                    <p className="text-stone-400">Price</p>
                    <p className="font-bold text-[#FF9933] text-lg"><IndianRupee className="w-4 h-4 inline" />{selectedHotel.price_per_night.toLocaleString()} / night</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Availability</p>
                    <p className="font-semibold text-green-600">{selectedHotel.booking_availability}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-stone-400">Address</p>
                    <p className="font-medium text-stone-700 flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-[#FF007F] inline" /> {selectedHotel.address}
                    </p>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="font-bold text-stone-800 mb-2">Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedHotel.amenities?.map((a) => (
                      <Badge key={a} variant="secondary" className="px-3 py-1 text-sm font-medium">{a}</Badge>
                    ))}
                  </div>
                </div>

                {/* Nearby Attractions */}
                {attractions.length > 0 && (
                  <div>
                    <h4 className="font-bold text-stone-800 mb-2">Nearby Attractions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {attractions.slice(0, 3).map((attr) => (
                        <div key={attr.id} className="flex items-center gap-3 p-2 bg-stone-50 rounded-lg border border-stone-100 text-xs">
                          <img src={attr.image_url} alt={attr.name} className="w-10 h-10 object-cover rounded-md flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-stone-800 truncate">{attr.name}</p>
                            <p className="text-stone-400 capitalize truncate">{attr.category}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact details */}
                <div className="border-t pt-4">
                  <h4 className="font-bold text-stone-800 mb-2">Contact Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-stone-600">
                    <div><strong>Phone:</strong> {selectedHotel.contact_phone}</div>
                    <div><strong>Email:</strong> {selectedHotel.contact_email}</div>
                    <div className="md:col-span-2">
                      <strong>Website:</strong> <a href={`https://${selectedHotel.contact_website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{selectedHotel.contact_website}</a>
                    </div>
                  </div>
                </div>

                {/* Actions / Maps */}
                <div className="border-t pt-4 flex gap-4">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHotel.latitude},${selectedHotel.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-[#FF007F] hover:bg-[#E60072] text-white flex items-center justify-center gap-2">
                      <Navigation className="w-4 h-4" /> Get Directions (Google Maps)
                    </Button>
                  </a>
                  <Button variant="outline" onClick={() => setSelectedHotel(null)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedAttraction && (
          <Dialog open={!!selectedAttraction} onOpenChange={(open) => !open && setSelectedAttraction(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6" data-testid="attraction-details-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-stone-800 flex items-center justify-between">
                  <span>{selectedAttraction.name}</span>
                  <Badge className="bg-[#008080] text-white text-sm px-3 py-1">{selectedAttraction.category}</Badge>
                </DialogTitle>
                <DialogDescription className="text-stone-500 font-medium">{selectedAttraction.distance} &bull; Estimated Visit: {selectedAttraction.estimated_visiting_time}</DialogDescription>
              </DialogHeader>

              {/* Image Gallery */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="col-span-3 h-64 rounded-xl overflow-hidden shadow-sm">
                  <img src={selectedAttraction.image_url} alt={selectedAttraction.name} className="w-full h-full object-cover" />
                </div>
                {selectedAttraction.gallery?.map((img, idx) => (
                  <div key={idx} className="h-24 rounded-lg overflow-hidden shadow-sm">
                    <img src={img} alt={`${selectedAttraction.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Information & Details */}
              <div className="space-y-4 text-stone-700">
                <div>
                  <h4 className="font-bold text-stone-800">Description</h4>
                  <p className="text-stone-600 text-sm mt-1">{selectedAttraction.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-[#FAF9F6] p-4 rounded-xl border border-stone-100 shadow-inner">
                  <div>
                    <p className="text-stone-400">Timings</p>
                    <p className="font-semibold text-stone-800 flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4 text-stone-500" /> {selectedAttraction.timings}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400">Entry Fee</p>
                    <p className="font-bold text-[#FF9933] text-lg flex items-center gap-0.5 mt-0.5">
                      <IndianRupee className="w-4 h-4" /> {selectedAttraction.entry_fee === 0 ? 'Free' : `${selectedAttraction.entry_fee}`}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-stone-400">Location Details</p>
                    <p className="font-medium text-stone-700 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4 text-[#FF007F]" /> Located {selectedAttraction.distance}
                    </p>
                  </div>
                </div>

                {/* Nearby Places */}
                {attractions.length > 1 && (
                  <div>
                    <h4 className="font-bold text-stone-800 mb-2">Nearby Attractions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {attractions
                        .filter((a) => a.id !== selectedAttraction.id)
                        .slice(0, 3)
                        .map((attr) => (
                          <div 
                            key={attr.id} 
                            className="flex items-center gap-3 p-2 bg-stone-50 rounded-lg border border-stone-100 text-xs cursor-pointer hover:bg-stone-100 transition-colors" 
                            onClick={() => setSelectedAttraction(attr)}
                          >
                            <img src={attr.image_url} alt={attr.name} className="w-10 h-10 object-cover rounded-md flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-stone-800 truncate">{attr.name}</p>
                              <p className="text-stone-400 capitalize truncate">{attr.category}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions / Maps */}
                <div className="border-t pt-4 flex gap-4">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedAttraction.latitude},${selectedAttraction.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-[#008080] hover:bg-[#006666] text-white flex items-center justify-center gap-2">
                      <Navigation className="w-4 h-4" /> Get Directions (Google Maps)
                    </Button>
                  </a>
                  <Button variant="outline" onClick={() => setSelectedAttraction(null)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedShopping && (
          <Dialog open={!!selectedShopping} onOpenChange={(open) => !open && setSelectedShopping(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6" data-testid="shopping-details-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-stone-800 flex items-center justify-between">
                  <span>{selectedShopping.name}</span>
                  <Badge className="bg-[#FF9933] text-white text-sm px-3 py-1">Shopping Market</Badge>
                </DialogTitle>
                <DialogDescription className="text-stone-500 font-medium">Bustling shopping area &bull; {selectedShopping.timings}</DialogDescription>
              </DialogHeader>

              {/* Image Gallery */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="col-span-3 h-64 rounded-xl overflow-hidden shadow-sm">
                  <img src={selectedShopping.image_url} alt={selectedShopping.name} className="w-full h-full object-cover" />
                </div>
                {selectedShopping.gallery?.map((img, idx) => (
                  <div key={idx} className="h-24 rounded-lg overflow-hidden shadow-sm">
                    <img src={img} alt={`${selectedShopping.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Information & Details */}
              <div className="space-y-4 text-stone-700">
                <div>
                  <h4 className="font-bold text-stone-800">About the Market</h4>
                  <p className="text-stone-600 text-sm mt-1">{selectedShopping.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-[#FAF9F6] p-4 rounded-xl border border-stone-100 shadow-inner">
                  <div>
                    <p className="text-stone-400">Opening Hours</p>
                    <p className="font-semibold text-stone-800 flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4 text-stone-500" /> {selectedShopping.timings}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400">Famous Products</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedShopping.famous_products?.map((p) => (
                        <Badge key={p} className="bg-stone-200 text-stone-700 hover:bg-stone-200 text-xs px-2 py-0.5">{p}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-stone-400">Address</p>
                    <p className="font-medium text-stone-700 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4 text-[#FF007F]" /> {selectedShopping.address}
                    </p>
                  </div>
                </div>

                {/* Nearby Markets */}
                {shopping.length > 1 && (
                  <div>
                    <h4 className="font-bold text-stone-800 mb-2">Nearby Markets</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {shopping
                        .filter((s) => s.id !== selectedShopping.id)
                        .slice(0, 3)
                        .map((shop) => (
                          <div 
                            key={shop.id} 
                            className="flex items-center gap-3 p-2 bg-stone-50 rounded-lg border border-stone-100 text-xs cursor-pointer hover:bg-stone-100 transition-colors" 
                            onClick={() => setSelectedShopping(shop)}
                          >
                            <img src={shop.image_url} alt={shop.name} className="w-10 h-10 object-cover rounded-md flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-stone-800 truncate">{shop.name}</p>
                              <p className="text-stone-400 truncate flex flex-wrap gap-0.5 mt-0.5">
                                {shop.famous_products?.slice(0, 2).join(", ")}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions / Maps */}
                <div className="border-t pt-4 flex gap-4">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedShopping.latitude},${selectedShopping.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-[#FF9933] hover:bg-[#e68a2e] text-white flex items-center justify-center gap-2">
                      <Navigation className="w-4 h-4" /> Get Directions (Google Maps)
                    </Button>
                  </a>
                  <Button variant="outline" onClick={() => setSelectedShopping(null)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedTransport && (
          <Dialog open={!!selectedTransport} onOpenChange={(open) => !open && setSelectedTransport(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6" data-testid="transport-details-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-stone-800 flex items-center justify-between">
                  <span>{selectedTransport.name}</span>
                  <Badge variant="outline" className="capitalize text-sm px-3 py-1">{selectedTransport.type}</Badge>
                </DialogTitle>
                <DialogDescription className="text-stone-500 font-medium">Nearest transport facility &bull; {selectedTransport.distance}</DialogDescription>
              </DialogHeader>

              {/* Image Gallery */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="col-span-3 h-64 rounded-xl overflow-hidden shadow-sm">
                  <img src={selectedTransport.image_url} alt={selectedTransport.name} className="w-full h-full object-cover" />
                </div>
                {selectedTransport.gallery?.map((img, idx) => (
                  <div key={idx} className="h-24 rounded-lg overflow-hidden shadow-sm">
                    <img src={img} alt={`${selectedTransport.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Information & Details */}
              <div className="space-y-4 text-stone-700">
                <div>
                  <h4 className="font-bold text-stone-800">Transport Hub Information</h4>
                  <p className="text-stone-600 text-sm mt-1">{selectedTransport.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-[#FAF9F6] p-4 rounded-xl border border-stone-100 shadow-inner">
                  <div>
                    <p className="text-stone-400">Timings & Operating Hours</p>
                    <p className="font-semibold text-stone-800 flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4 text-stone-500" /> {selectedTransport.timings}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-400">Price Range</p>
                    <p className="font-bold text-[#FF9933] text-lg mt-0.5">{selectedTransport.price_range}</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Travel Frequency</p>
                    <p className="font-semibold text-stone-800 mt-1">{selectedTransport.frequency}</p>
                  </div>
                  <div>
                    <p className="text-stone-400">Typical Duration</p>
                    <p className="font-semibold text-stone-800 mt-1">{selectedTransport.duration}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-stone-400">Address Location</p>
                    <p className="font-medium text-stone-700 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4 text-[#FF007F]" /> {selectedTransport.address}
                    </p>
                  </div>
                </div>

                {/* Nearby Transport Options */}
                {transport.length > 1 && (
                  <div>
                    <h4 className="font-bold text-stone-800 mb-2">Nearby Transport Facilities</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {transport
                        .filter((t) => t.id !== selectedTransport.id)
                        .slice(0, 3)
                        .map((item) => (
                          <div 
                            key={item.id} 
                            className="flex items-center gap-3 p-2 bg-stone-50 rounded-lg border border-stone-100 text-xs cursor-pointer hover:bg-stone-100 transition-colors" 
                            onClick={() => setSelectedTransport(item)}
                          >
                            <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded-md flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-stone-800 truncate">{item.name}</p>
                              <p className="text-stone-400 capitalize truncate mt-0.5">{item.type} &bull; {item.distance}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions / Maps */}
                <div className="border-t pt-4 flex gap-4">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTransport.latitude},${selectedTransport.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-[#6a4bc2] hover:bg-[#5839ad] text-white flex items-center justify-center gap-2">
                      <Navigation className="w-4 h-4" /> Get Directions (Google Maps)
                    </Button>
                  </a>
                  <Button variant="outline" onClick={() => setSelectedTransport(null)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

// ============== MY FAVORITES PAGE ==============

const FavoritesPage = () => {
  const navigate = useNavigate();
  const [memberName, setMemberName] = useState(() => localStorage.getItem('member_name') || '');
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputName, setInputName] = useState('');

  const fetchFavorites = useCallback(async (name) => {
    setLoading(true);
    try {
      const data = await mockApi.getFavorites(name);
      setFavorites(data);
      const ids = data.map(d => d.id);
      localStorage.setItem('favorites_cache', JSON.stringify(ids));
      window.dispatchEvent(new Event('favorites-updated'));
    } catch (err) {
      toast.error("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (memberName) {
      fetchFavorites(memberName);
    }
    const handleUpdate = () => {
      const currentName = localStorage.getItem('member_name');
      if (currentName) {
        fetchFavorites(currentName);
      }
    };
    window.addEventListener('favorites-updated', handleUpdate);
    return () => window.removeEventListener('favorites-updated', handleUpdate);
  }, [memberName, fetchFavorites]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    const name = inputName.trim();
    localStorage.setItem('member_name', name);
    setMemberName(name);
  };

  const handleClearName = () => {
    localStorage.removeItem('member_name');
    localStorage.removeItem('favorites_cache');
    setMemberName('');
    setFavorites([]);
    setInputName('');
    window.dispatchEvent(new Event('favorites-updated'));
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20" data-testid="favorites-page">
      <Navbar />

      <div className="section-container">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
              My Favorites
            </h1>
            <p className="text-stone-500 mt-1">Saved destinations for your group planning</p>
          </div>
          
          {memberName && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-stone-200">
              <span className="text-sm text-stone-600">Showing favorites for: <strong className="text-[#008080]">{memberName}</strong></span>
              <Button variant="outline" size="sm" onClick={handleClearName} className="text-stone-500 hover:text-red-500">
                Change User
              </Button>
            </div>
          )}
        </div>

        {!memberName ? (
          <Card className="max-w-md mx-auto mt-12 border-stone-200">
            <CardHeader>
              <CardTitle className="text-center" style={{ fontFamily: 'Playfair Display, serif' }}>Enter Your Name</CardTitle>
              <CardDescription className="text-center">To save and view your favorite destinations, please enter your display name.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <Input 
                  type="text" 
                  placeholder="Display name" 
                  value={inputName} 
                  onChange={(e) => setInputName(e.target.value)} 
                  required 
                />
                <Button type="submit" className="w-full bg-[#008080] hover:bg-[#006666] text-white">
                  View My Favorites
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-200 max-w-lg mx-auto">
            <Heart className="w-12 h-12 text-stone-300 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-stone-700 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>No Favorites Yet</h3>
            <p className="text-stone-400 max-w-sm mx-auto mb-6 text-sm">Destinations you bookmark or heart will show up here.</p>
            <Button onClick={() => navigate('/explore')} className="bg-[#008080] hover:bg-[#006666] text-white">
              Explore Destinations
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {favorites.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============== MY TRIPS PAGE ==============

const MyTripsPage = () => {
  const navigate = useNavigate();
  const [memberName, setMemberName] = useState(() => localStorage.getItem('member_name') || '');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputName, setInputName] = useState('');

  const fetchTrips = useCallback(async (name) => {
    setLoading(true);
    try {
      const data = await mockApi.getTripsHistory(name);
      setTrips(data);
    } catch (err) {
      toast.error("Failed to load trips history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (memberName) {
      fetchTrips(memberName);
    }
  }, [memberName, fetchTrips]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    const name = inputName.trim();
    localStorage.setItem('member_name', name);
    setMemberName(name);
  };

  const handleClearName = () => {
    localStorage.removeItem('member_name');
    localStorage.removeItem('favorites_cache');
    setMemberName('');
    setTrips([]);
    setInputName('');
    window.dispatchEvent(new Event('favorites-updated'));
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20" data-testid="my-trips-page">
      <Navbar />

      <div className="section-container">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
              My Trips
            </h1>
            <p className="text-stone-500 mt-1">Your created and joined travel plans</p>
          </div>
          
          {memberName && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-stone-200">
              <span className="text-sm text-stone-600">Showing trips for: <strong className="text-[#008080]">{memberName}</strong></span>
              <Button variant="outline" size="sm" onClick={handleClearName} className="text-stone-500 hover:text-red-500">
                Change User
              </Button>
            </div>
          )}
        </div>

        {!memberName ? (
          <Card className="max-w-md mx-auto mt-12 border-stone-200">
            <CardHeader>
              <CardTitle className="text-center" style={{ fontFamily: 'Playfair Display, serif' }}>Enter Your Name</CardTitle>
              <CardDescription className="text-center">To view your created or joined trips, please enter your display name.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <Input 
                  type="text" 
                  placeholder="Display name" 
                  value={inputName} 
                  onChange={(e) => setInputName(e.target.value)} 
                  required 
                />
                <Button type="submit" className="w-full bg-[#008080] hover:bg-[#006666] text-white">
                  View My Trips
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-200 max-w-lg mx-auto">
            <Briefcase className="w-12 h-12 text-stone-300 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-stone-700 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>No Trips Yet</h3>
            <p className="text-stone-400 max-w-sm mx-auto mb-6 text-sm">You haven't created or joined any travel groups yet.</p>
            <Button onClick={() => navigate('/create-trip')} className="bg-[#008080] hover:bg-[#006666] text-white">
              Create a Trip
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => {
              const isCreator = !!(trip.creator_name && memberName && trip.creator_name.toLowerCase() === memberName.toLowerCase());
              const isActive = trip.status !== 'finalized';
              return (
                <Card 
                  key={trip.id} 
                  onClick={() => navigate(`/trip/${trip.id}`)}
                  className="hover:shadow-md cursor-pointer transition-all border-stone-200 group"
                  data-testid={`trip-card-${trip.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <Badge className={isActive ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"}>
                        {isActive ? "Active" : "Finalized"}
                      </Badge>
                      <Badge variant="outline" className={isCreator ? "border-amber-500 text-amber-600 bg-amber-50" : "border-stone-200 text-stone-500 bg-stone-50"}>
                        {isCreator ? "Creator" : "Member"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg group-hover:text-[#FF9933] transition-colors" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {trip.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {trip.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-stone-500 space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-stone-400" />
                      <span>{trip.group_type.charAt(0).toUpperCase() + trip.group_type.slice(1)} Group • {trip.members.length} members</span>
                    </div>
                    {trip.start_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        <span>{trip.start_date} to {trip.end_date || "TBD"}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const AuthPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await mockApi.login(loginForm.email, loginForm.password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_name', data.name);
      localStorage.setItem('user_email', data.email);
      // Auto-set member_name to user's name for seamless integration with existing display-name flows
      localStorage.setItem('member_name', data.name);
      window.dispatchEvent(new Event('auth-updated'));
      window.dispatchEvent(new Event('favorites-updated'));
      toast.success("Successfully logged in!");
      navigate('/my-trips');
    } catch (err) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await mockApi.register(registerForm.name, registerForm.email, registerForm.password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_name', data.name);
      localStorage.setItem('user_email', data.email);
      // Auto-set member_name to user's name for seamless integration with existing display-name flows
      localStorage.setItem('member_name', data.name);
      window.dispatchEvent(new Event('auth-updated'));
      window.dispatchEvent(new Event('favorites-updated'));
      toast.success("Registration successful!");
      navigate('/my-trips');
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20 flex items-center justify-center px-4" data-testid="auth-page">
      <Navbar />
      
      <Card className="w-full max-w-md border border-stone-200 shadow-xl rounded-2xl bg-white overflow-hidden transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-[#FF9933]/5 to-[#008080]/5 pb-6 pt-8 text-center border-b border-stone-100">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-[#008080]/10 rounded-2xl">
              <Users className="w-8 h-8 text-[#008080]" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
            Welcome to PackVote
          </CardTitle>
          <CardDescription className="text-stone-500 mt-1">
            Access your collaborative travel planner
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6 bg-stone-100 p-1 rounded-xl">
              <TabsTrigger value="login" data-testid="login-tab" className="rounded-lg py-2 font-medium">
                Login
              </TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab" className="rounded-lg py-2 font-medium">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-xs font-semibold text-stone-600">Email Address</label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="Enter email (e.g. user@example.com)"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                    data-testid="login-email-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-xs font-semibold text-stone-600">Password</label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      name="password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                      data-testid="login-password-input"
                      className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                      data-testid="login-password-toggle"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs mt-1">
                  <span />
                  <Link 
                    to="/forgot-password" 
                    className="text-[#008080] hover:text-[#006666] font-medium"
                    data-testid="forgot-password-link"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  data-testid="login-submit-btn"
                  className="w-full bg-[#008080] hover:bg-[#006666] text-white py-6 rounded-xl font-semibold shadow-md transition-all duration-200 mt-2"
                >
                  {loading ? "Logging in..." : "Login to Account"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="register-name" className="text-xs font-semibold text-stone-600">Full Name</label>
                  <Input
                    id="register-name"
                    name="name"
                    type="text"
                    placeholder="Enter full name"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    required
                    data-testid="register-name-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="register-email" className="text-xs font-semibold text-stone-600">Email Address</label>
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required
                    data-testid="register-email-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="register-password" className="text-xs font-semibold text-stone-600">Password</label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      name="password"
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Choose secure password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                      data-testid="register-password-input"
                      className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                      data-testid="register-password-toggle"
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  data-testid="register-submit-btn"
                  className="w-full bg-[#FF9933] hover:bg-[#e08020] text-white py-6 rounded-xl font-semibold shadow-md transition-all duration-200 mt-2"
                >
                  {loading ? "Registering..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [debugLink, setDebugLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDebugLink('');
    try {
      const res = await mockApi.forgotPassword(email);
      setSuccess(true);
      if (res.debug_link) {
        setDebugLink(res.debug_link);
      }
      toast.success("Password reset request processed!");
    } catch (err) {
      toast.error(err.message || "Failed to process reset request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20 flex items-center justify-center px-4" data-testid="forgot-password-page">
      <Navbar />
      
      <Card className="w-full max-w-md border border-stone-200 shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#FF9933]/5 to-[#008080]/5 pb-6 pt-8 text-center border-b border-stone-100">
          <CardTitle className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
            Forgot Password
          </CardTitle>
          <CardDescription className="text-stone-500 mt-1">
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 px-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl inline-block">
                <Check className="w-8 h-8 mx-auto" />
              </div>
              <p className="text-sm text-stone-600 font-medium">
                We've processed your password reset request for <strong className="text-stone-800">{email}</strong>.
              </p>
              {debugLink && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                  <p className="text-xs font-semibold text-amber-800 mb-1">🛠️ Developer / Offline Test Mode:</p>
                  <p className="text-xs text-amber-700 mb-2">Since the Gmail SMTP variables are not configured, you can use the generated link below to reset the password:</p>
                  <a href={debugLink} className="text-xs text-[#008080] hover:underline break-all font-mono font-medium block">
                    {debugLink}
                  </a>
                </div>
              )}
              <div className="pt-2">
                <Link to="/login" className="text-[#008080] hover:text-[#006666] text-sm font-semibold">
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="text-xs font-semibold text-stone-600">Email Address</label>
                <Input
                  id="forgot-email"
                  name="email"
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="forgot-email-input"
                  className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="forgot-submit-btn"
                className="w-full bg-[#008080] hover:bg-[#006666] text-white py-6 rounded-xl font-semibold shadow-md transition-all duration-200"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-stone-400 hover:text-stone-600 text-xs font-semibold">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!token) {
      toast.error("Reset token is missing");
      return;
    }

    setLoading(true);
    try {
      await mockApi.resetPassword(token, password);
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20 flex items-center justify-center px-4" data-testid="reset-password-page">
      <Navbar />
      
      <Card className="w-full max-w-md border border-stone-200 shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#FF9933]/5 to-[#008080]/5 pb-6 pt-8 text-center border-b border-stone-100">
          <CardTitle className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
            Reset Password
          </CardTitle>
          <CardDescription className="text-stone-500 mt-1">
            Choose a new secure password
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 px-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl inline-block">
                <Check className="w-8 h-8 mx-auto" />
              </div>
              <p className="text-sm text-stone-600 font-medium">
                Your password has been successfully reset! Redirecting to login...
              </p>
            </div>
          ) : !token ? (
            <div className="text-center py-6 space-y-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl inline-block">
                <X className="w-8 h-8 mx-auto" />
              </div>
              <p className="text-sm text-stone-600 font-medium">
                Invalid or missing password reset token. Please request a new link.
              </p>
              <div className="pt-2">
                <Link to="/forgot-password" className="text-[#008080] hover:text-[#006666] text-sm font-semibold">
                  Go to Forgot Password
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-new-password" className="text-xs font-semibold text-stone-600">New Password</label>
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    name="new_password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="reset-password-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    data-testid="reset-password-toggle"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm-password" className="text-xs font-semibold text-stone-600">Confirm Password</label>
                <div className="relative">
                  <Input
                    id="reset-confirm-password"
                    name="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="reset-confirm-password-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    data-testid="reset-confirm-password-toggle"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="reset-submit-btn"
                className="w-full bg-[#008080] hover:bg-[#006666] text-white py-6 rounded-xl font-semibold shadow-md transition-all duration-200"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    created_at: '',
    phone_number: '',
    avatar_url: '',
    home_city: '',
    preferred_interests: [],
    default_budget_range: '',
    personal_emergency_contact_name: '',
    personal_emergency_contact_number: ''
  });

  const interestTags = ["Beaches", "Adventure", "Heritage", "Wildlife", "Spiritual", "Nightlife", "Shopping", "Nature", "Food"];

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const data = await mockApi.getUserProfile();
        setProfile({
          ...data,
          preferred_interests: data.preferred_interests || []
        });
      } catch (err) {
        toast.error(err.message || "Failed to load profile");
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  const handleInterestToggle = (tag) => {
    const current = profile.preferred_interests || [];
    const updated = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    setProfile({ ...profile, preferred_interests: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await mockApi.updateUserProfile(profile);
      setProfile({
        ...data,
        preferred_interests: data.preferred_interests || []
      });
      // Sync local storage display name and navigation caches
      localStorage.setItem('user_name', data.name);
      localStorage.setItem('member_name', data.name);
      window.dispatchEvent(new Event('favorites-updated'));
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#008080] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] pt-24 pb-20 px-4" data-testid="profile-page">
      <Navbar />
      
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </Button>
          <h1 className="text-3xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
            My Profile
          </h1>
        </div>

        <Card className="border border-stone-200 shadow-lg rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#FF9933]/5 to-[#008080]/5 pb-6 pt-8 border-b border-stone-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#008080]/15 flex items-center justify-center text-[#008080] text-2xl font-bold">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-stone-800">
                  {profile.name}
                </CardTitle>
                <CardDescription className="text-stone-500">
                  Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 px-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Account details section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="profile-email" className="text-xs font-semibold text-stone-600">Email Address</label>
                  <Input
                    id="profile-email"
                    name="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="bg-stone-50 border-stone-200 text-stone-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profile-name" className="text-xs font-semibold text-stone-600">Display Name</label>
                  <Input
                    id="profile-name"
                    name="name"
                    type="text"
                    placeholder="Enter your display name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    data-testid="profile-name-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
              </div>

              {/* Personal Info section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="profile-phone" className="text-xs font-semibold text-stone-600">Phone Number</label>
                  <Input
                    id="profile-phone"
                    name="phone_number"
                    type="text"
                    placeholder="Enter phone number"
                    value={profile.phone_number || ''}
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                    data-testid="profile-phone-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profile-home-city" className="text-xs font-semibold text-stone-600">Home City</label>
                  <Input
                    id="profile-home-city"
                    name="home_city"
                    type="text"
                    placeholder="Enter home city"
                    value={profile.home_city || ''}
                    onChange={(e) => setProfile({ ...profile, home_city: e.target.value })}
                    data-testid="profile-home-city-input"
                    className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                  />
                </div>
              </div>

              {/* Budget Range section */}
              <div className="space-y-1.5">
                <label htmlFor="profile-budget" className="text-xs font-semibold text-stone-600">Preferred Budget Range</label>
                <select
                  id="profile-budget"
                  name="default_budget_range"
                  value={profile.default_budget_range || ''}
                  onChange={(e) => setProfile({ ...profile, default_budget_range: e.target.value })}
                  data-testid="profile-budget-select"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] bg-white transition-all duration-200"
                >
                  <option value="">Not Specified</option>
                  <option value="Budget (₹)">Budget (₹)</option>
                  <option value="Mid-Range (₹₹)">Mid-Range (₹₹)</option>
                  <option value="Luxury (₹₹₹)">Luxury (₹₹₹)</option>
                </select>
              </div>

              {/* Preferred Interests multi-select tags */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-600">Preferred Interests</label>
                <div className="flex flex-wrap gap-2">
                  {interestTags.map(tag => {
                    const isSelected = (profile.preferred_interests || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInterestToggle(tag)}
                        data-testid={`interest-tag-${tag.toLowerCase()}`}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                          isSelected 
                            ? 'bg-[#008080] text-white border-[#008080] shadow-sm' 
                            : 'bg-white text-stone-600 border-stone-200 hover:border-[#008080]/30'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emergency contact details section */}
              <div className="border-t border-stone-100 pt-5">
                <h3 className="text-sm font-bold text-stone-700 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Personal Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="profile-emergency-name" className="text-xs font-semibold text-stone-600">Contact Name</label>
                    <Input
                      id="profile-emergency-name"
                      name="personal_emergency_contact_name"
                      type="text"
                      placeholder="Contact person's name"
                      value={profile.personal_emergency_contact_name || ''}
                      onChange={(e) => setProfile({ ...profile, personal_emergency_contact_name: e.target.value })}
                      data-testid="profile-emergency-name-input"
                      className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profile-emergency-phone" className="text-xs font-semibold text-stone-600">Contact Phone</label>
                    <Input
                      id="profile-emergency-phone"
                      name="personal_emergency_contact_number"
                      type="text"
                      placeholder="Contact person's phone"
                      value={profile.personal_emergency_contact_number || ''}
                      onChange={(e) => setProfile({ ...profile, personal_emergency_contact_number: e.target.value })}
                      data-testid="profile-emergency-phone-input"
                      className="border-stone-200 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                    />
                  </div>
                </div>
              </div>

              {/* Bio section */}
              <div className="space-y-1.5">
                <label htmlFor="profile-bio" className="text-xs font-semibold text-stone-600">Short Bio</label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  placeholder="Tell us a bit about your travel style..."
                  value={profile.bio || ''}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  data-testid="profile-bio-input"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080] resize-none transition-all"
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                data-testid="profile-save-btn"
                className="w-full bg-[#008080] hover:bg-[#006666] text-white py-6 rounded-xl font-semibold shadow-md transition-all duration-200"
              >
                {saving ? "Saving Changes..." : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ============== APP ==============

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/routes" element={<RoutePlannerPage />} />
          <Route path="/destination/:id" element={<DestinationPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/my-trips" element={<MyTripsPage />} />

          <Route path="/create-trip" element={<CreateTripPage />} />
          <Route path="/join-trip" element={<JoinTripPage />} />
          <Route path="/trip/:tripId" element={<TripDashboard />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/ai-suggest" element={<AISuggestPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
