const BASE_URL = 'http://127.0.0.1:8000/api';

export const mockApi = {
  getDestinations: async () => {
    const res = await fetch(`${BASE_URL}/destinations`);
    if (!res.ok) throw new Error("Failed to fetch destinations");
    return res.json();
  },

  searchDestinations: async (q) => {
    const res = await fetch(`${BASE_URL}/destinations/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Failed to search destinations");
    return res.json();
  },

  getDestination: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}`);
    if (!res.ok) throw new Error("Destination not found");
    return res.json();
  },

  getDestinationHotels: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/hotels`);
    if (!res.ok) throw new Error("Failed to fetch hotels");
    return res.json();
  },

  getDestinationAttractions: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/attractions`);
    if (!res.ok) throw new Error("Failed to fetch attractions");
    return res.json();
  },

  getDestinationShopping: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/shopping`);
    if (!res.ok) throw new Error("Failed to fetch shopping");
    return res.json();
  },

  getDestinationTransport: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/transport`);
    if (!res.ok) throw new Error("Failed to fetch transport");
    return res.json();
  },

  getDestinationCityInfo: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/city-info`);
    if (!res.ok) throw new Error("Failed to fetch city info");
    return res.json();
  },

  getDestinationHeritage: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/heritage`);
    if (!res.ok) throw new Error("Failed to fetch heritage");
    return res.json();
  },

  getDestinationStreetFood: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/street-food`);
    if (!res.ok) throw new Error("Failed to fetch street food");
    return res.json();
  },

  getDestinationAshrams: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/ashrams`);
    if (!res.ok) throw new Error("Failed to fetch ashrams");
    return res.json();
  },

  getDestinationTextiles: async (id) => {
    const res = await fetch(`${BASE_URL}/destinations/${id}/textiles`);
    if (!res.ok) throw new Error("Failed to fetch textiles");
    return res.json();
  },

  createTrip: async (tripData) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/trips`, {
      method: 'POST',
      headers,
      body: JSON.stringify(tripData)
    });
    if (!res.ok) throw new Error("Failed to create trip");
    return res.json();
  },

  joinTrip: async ({ invite_code, member_name }) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/trips/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ invite_code, member_name })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to join trip");
    }
    return res.json();
  },

  getTrip: async (id) => {
    const res = await fetch(`${BASE_URL}/trips/${id}`);
    if (!res.ok) throw new Error("Trip not found");
    return res.json();
  },

  getTripByCode: async (code) => {
    const res = await fetch(`${BASE_URL}/trips/code/${code}`);
    if (!res.ok) throw new Error("Trip not found");
    return res.json();
  },

  voteOnItem: async ({ trip_id, voter_name, item_type, item_id }) => {
    const res = await fetch(`${BASE_URL}/trips/${trip_id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id, voter_name, item_type, item_id })
    });
    if (!res.ok) throw new Error("Failed to record vote");
    return res.json();
  },

  getVotingResults: async (trip_id) => {
    const res = await fetch(`${BASE_URL}/trips/${trip_id}/results`);
    if (!res.ok) throw new Error("Failed to fetch voting results");
    return res.json();
  },

  finalizeTrip: async (trip_id) => {
    const res = await fetch(`${BASE_URL}/trips/${trip_id}/finalize`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error("Failed to finalize trip");
    return res.json();
  },

  compareItems: async ({ item_type, item_ids, destination_id }) => {
    const res = await fetch(`${BASE_URL}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_type, item_ids, destination_id })
    });
    if (!res.ok) throw new Error("Failed to compare items");
    return res.json();
  },

  getReviews: async (destinationId) => {
    const res = await fetch(`${BASE_URL}/destinations/${destinationId}/reviews`);
    if (!res.ok) throw new Error("Failed to fetch reviews");
    return res.json();
  },

  createReview: async (destinationId, reviewData) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/destinations/${destinationId}/reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify(reviewData)
    });
    if (!res.ok) throw new Error("Failed to submit review");
    return res.json();
  },

  getFavorites: async (memberName) => {
    const res = await fetch(`${BASE_URL}/favorites/${encodeURIComponent(memberName)}`);
    if (!res.ok) throw new Error("Failed to fetch favorites");
    return res.json();
  },

  addFavorite: async (memberName, destinationId) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/favorites`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ member_name: memberName, destination_id: destinationId })
    });
    if (!res.ok) throw new Error("Failed to add favorite");
    return res.json();
  },

  removeFavorite: async (memberName, destinationId) => {
    const res = await fetch(`${BASE_URL}/favorites?member_name=${encodeURIComponent(memberName)}&destination_id=${encodeURIComponent(destinationId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error("Failed to remove favorite");
    return res.json();
  },

  getTripsHistory: async (memberName) => {
    const res = await fetch(`${BASE_URL}/trips/history/${encodeURIComponent(memberName)}`);
    if (!res.ok) throw new Error("Failed to fetch trip history");
    return res.json();
  },

  getNotifications: async (memberName) => {
    const res = await fetch(`${BASE_URL}/notifications/${encodeURIComponent(memberName)}`);
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },

  markNotificationRead: async (notificationId) => {
    const res = await fetch(`${BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error("Failed to mark notification as read");
    return res.json();
  },

  getDestinationWeather: async (destinationId) => {
    const res = await fetch(`${BASE_URL}/destinations/${destinationId}/weather`);
    if (!res.ok) throw new Error("Failed to fetch weather");
    return res.json();
  },

  getDestinationNearby: async (destinationId) => {
    const res = await fetch(`${BASE_URL}/destinations/${destinationId}/nearby`);
    if (!res.ok) throw new Error("Failed to fetch nearby places");
    return res.json();
  },

  getDestinationExpenseEstimate: async (destinationId, groupSize = 1, durationDays = 1) => {
    const res = await fetch(`${BASE_URL}/destinations/${destinationId}/expense-estimate?group_size=${groupSize}&duration_days=${durationDays}`);
    if (!res.ok) throw new Error("Failed to fetch expense estimate");
    return res.json();
  },

  getTripItinerary: async (tripId) => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/itinerary`);
    if (!res.ok) throw new Error("Failed to fetch trip itinerary");
    return res.json();
  },

  saveTripItinerary: async (tripId, itineraryDays) => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itinerary_days: itineraryDays })
    });
    if (!res.ok) throw new Error("Failed to save trip itinerary");
    return res.json();
  },

  generateTripItinerary: async (tripId) => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/generate-itinerary`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to generate AI itinerary");
    return res.json();
  },

  register: async (name, email, password) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Registration failed");
    }
    return res.json();
  },

  login: async (email, password) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Login failed");
    }
    return res.json();
  },

  forgotPassword: async (email) => {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Forgot password request failed");
    }
    return res.json();
  },

  resetPassword: async (token, newPassword) => {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Reset password failed");
    }
    return res.json();
  },

  getUserProfile: async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/users/me`, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to fetch profile");
    }
    return res.json();
  },

  updateUserProfile: async (profileData) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/users/me`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to update profile");
    }
    return res.json();
  },

  approveMember: async (tripId, name) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/trips/${tripId}/approve-member`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to approve member");
    }
    return res.json();
  },

  rejectMember: async (tripId, name) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_URL}/trips/${tripId}/reject-member`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to reject member");
    }
    return res.json();
  },

  getTripMessages: async (tripId) => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/messages`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to fetch trip messages");
    }
    return res.json();
  }
};
