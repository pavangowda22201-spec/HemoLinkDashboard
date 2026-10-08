import {
    Activity,
  Bot,
  MessageCircle,
  Send,
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Droplets,
  Hospital,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import "./App.css";
import HemoMap from "./HemoMap.jsx";
import HospitalLocationPicker from "./HospitalLocationPicker.jsx";

const API = import.meta.env.VITE_API_BASE_URL || "https://hemolink-api-tm3c.onrender.com";

function formatDate(value) {
  if (!value) return "—";

  const raw = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatCard({ icon: Icon, label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={19} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() =>
    localStorage.getItem("hemolink_hospital_token")
  );

  const [page, setPage] = useState("dashboard");

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");

  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acceptances, setAcceptances] = useState([]);
  const [liveDonorLocations, setLiveDonorLocations] = useState({});
  const [trackingConnected, setTrackingConnected] = useState(false);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
    const [botOpen, setBotOpen] = useState(false);
  const [botInput, setBotInput] = useState("");
  const [botMessages, setBotMessages] = useState([
    {
      role: "bot",
      text: "Hi, I'm HemoBot. I can help you check blood requests, donor responses, and emergency activity.",
    },
  ]);

  const [form, setForm] = useState({
    hospital_name: "HemoLink Hospital",
    blood_group_needed: "O+",
    units_needed: 1,
    urgency: "critical",
    latitude: "12.9716",
    longitude: "77.5946",
    eta_window_minutes: 60,
    notes: "",
  });

  /*
   * ---------------------------------------------------------
   * LOGIN
   * ---------------------------------------------------------
   */

  const login = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const field = emailOrPhone.includes("@") ? "email" : "phone";

      const params = new URLSearchParams({
        [field]: emailOrPhone.trim(),
        password,
      });

      const response = await fetch(
        `${API}/auth/login?${params.toString()}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      if (data.user_type !== "hospital") {
        throw new Error("This account is not a hospital account.");
      }

      localStorage.setItem(
        "hemolink_hospital_token",
        data.access_token
      );

      setToken(data.access_token);
      setPage("dashboard");
      setPassword("");
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * API HELPER
   * ---------------------------------------------------------
   */

  const apiFetch = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(`${API}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem("hemolink_hospital_token");
      setToken(null);
      setSelectedRequest(null);
      setAcceptances([]);
      throw new Error("Your session has expired. Please sign in again.");
    }

    return response;
  };

  /*
   * ---------------------------------------------------------
   * LOAD REQUESTS
   * ---------------------------------------------------------
   */

  const loadRequests = async () => {
    if (!token) return;

    setPageLoading(true);
    setError("");

    try {
      const response = await apiFetch("/requests/");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load requests.");
      }

      setRequests(
        Array.isArray(data)
          ? data
          : Array.isArray(data.value)
          ? data.value
          : []
      );
    } catch (err) {
      setError(err.message || "Could not load requests.");
    } finally {
      setPageLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * OPEN REQUEST
   * ---------------------------------------------------------
   */

  const openRequest = async (request) => {
    setSelectedRequest(request);
    setAcceptances([]);
    setError("");

    try {
      const response = await apiFetch(
        `/requests/${request.id}/acceptances`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not load donor responses."
        );
      }

      setAcceptances(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load donor responses.");
    }
  };

  /*
   * ---------------------------------------------------------
   * CREATE REQUEST
   * ---------------------------------------------------------
   */

  const detectHospitalLocation = () => {
    setLocationStatus("");
    setError("");
    setMessage("");

    if (!navigator.geolocation) {
      setLocationStatus("Location is not supported by this browser.");
      return;
    }

    setLocationStatus("Detecting hospital location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setForm((previous) => ({
          ...previous,
          latitude: String(latitude),
          longitude: String(longitude),
        }));

        setLocationStatus(
          `Location detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );
      },
      (locationError) => {
        const reason =
          locationError.code === 1
            ? "Location permission was denied. Allow location access in your browser."
            : locationError.code === 2
              ? "Your location is unavailable. Check GPS or network access."
              : "Location detection timed out. Please try again.";

        setLocationStatus(reason);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  };
  const createRequest = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        hospital_name: form.hospital_name,
        blood_group_needed: form.blood_group_needed,
        units_needed: Number(form.units_needed),
        urgency: form.urgency,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        eta_window_minutes: Number(form.eta_window_minutes),
        notes: form.notes || null,
      };

      const response = await apiFetch("/requests/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not create blood request."
        );
      }

      setMessage("Emergency blood request created successfully.");
      setShowCreate(false);

      setForm((current) => ({
        ...current,
        blood_group_needed: "O+",
        units_needed: 1,
        urgency: "critical",
        eta_window_minutes: 60,
        notes: "",
      }));

      await loadRequests();
      setSelectedRequest(data);
      setAcceptances([]);
    } catch (err) {
      setError(err.message || "Could not create request.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * FULFILL DONOR ACCEPTANCE
   * ---------------------------------------------------------
   */

  const fulfillAcceptance = async (acceptanceId) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/acceptances/${acceptanceId}/fulfill`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not fulfill donor response."
        );
      }

      setMessage("Donor response marked as fulfilled.");

      if (selectedRequest) {
        await openRequest(selectedRequest);
      }

      await loadRequests();
    } catch (err) {
      setError(
        err.message || "Could not fulfill donor response."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */
  const sendBotMessage = (preset) => {
    const question = String(preset ?? botInput).trim();

    if (!question) return;

    const normalized = question.toLowerCase();

    let reply =
      "I can help with requests, donors, critical cases, and dashboard activity.";

    if (
      normalized.includes("critical") ||
      normalized.includes("emergency")
    ) {
      reply =
        criticalRequests.length > 0
          ? `There ${criticalRequests.length === 1 ? "is" : "are"} ${criticalRequests.length} critical request${criticalRequests.length === 1 ? "" : "s"} currently requiring attention.`
          : "There are no active critical requests right now.";
    } else if (
      normalized.includes("request") ||
      normalized.includes("blood")
    ) {
      reply = `There ${requests.length === 1 ? "is" : "are"} ${requests.length} blood request${requests.length === 1 ? "" : "s"} in the system, with ${activeRequests.length} currently active.`;
    } else if (
      normalized.includes("donor") ||
      normalized.includes("response")
    ) {
      reply = `The selected request currently has ${acceptances.length} donor response${acceptances.length === 1 ? "" : "s"}.`;
    } else if (
      normalized.includes("fulfilled") ||
      normalized.includes("complete")
    ) {
      reply = `${fulfilledRequests.length} request${fulfilledRequests.length === 1 ? " has" : "s have"} been fulfilled.`;
    } else if (
      normalized.includes("help") ||
      normalized.includes("what can")
    ) {
      reply =
        "I can give you a quick overview of active requests, critical emergencies, donor responses, and fulfilled requests.";
    }

    setBotMessages((current) => [
      ...current,
      { role: "user", text: question },
      { role: "bot", text: reply },
    ]);

    setBotInput("");
  };
 const logout = () => {
    localStorage.removeItem("hemolink_hospital_token");

    setToken(null);
    setRequests([]);
    setSelectedRequest(null);
    setAcceptances([]);
    setError("");
    setMessage("");
  };

  /*
   * ---------------------------------------------------------
   * INITIAL LOAD
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (token) {
      loadRequests();
    }
  }, [token]);

  // Refresh donor responses every 10 seconds for the selected request.
  useEffect(() => {
    if (!token || !selectedRequest?.id) return;

    let stopped = false;

    const refreshAcceptances = async () => {
      try {
        const response = await fetch(
          `${API}/requests/${selectedRequest.id}/acceptances`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        if (!stopped && Array.isArray(data)) {
          setAcceptances(data);
        }
      } catch {
        // Keep the last successful data during temporary network errors.
      }
    };

    refreshAcceptances();
    const intervalId = setInterval(refreshAcceptances, 10000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [token, selectedRequest?.id]);

  // Live donor GPS tracking for the selected request.
  useEffect(() => {
    if (!token || !selectedRequest?.id) {
      setTrackingConnected(false);
      setLiveDonorLocations({});
      return;
    }

    const websocketBase = API.replace(/^http/, "ws");

    const websocketUrl =
      `${websocketBase}/tracking/requests/${selectedRequest.id}` +
      `?token=${encodeURIComponent(token)}`;

    console.log("[HemoLink tracking] connecting:", websocketUrl.replace(token, "[TOKEN]"));

    const socket = new WebSocket(websocketUrl);

    socket.onopen = () => {
      console.log("[HemoLink tracking] WebSocket OPEN");
      setTrackingConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type !== "donor_location") {
          return;
        }

        const donorId = String(payload.donor_id);

        setLiveDonorLocations((current) => ({
          ...current,
          [donorId]: {
            donor_latitude: payload.latitude,
            donor_longitude: payload.longitude,
            donor_location_updated_at:
              payload.location_updated_at,
          },
        }));
      } catch {
        // Ignore malformed tracking messages.
      }
    };

    socket.onerror = (event) => {
      console.error("[HemoLink tracking] WebSocket ERROR", event);
      setTrackingConnected(false);
    };

    socket.onclose = (event) => {
      console.warn(
        "[HemoLink tracking] WebSocket CLOSED",
        event.code,
        event.reason
      );
      setTrackingConnected(false);
    };

    return () => {
      socket.close();
      setTrackingConnected(false);
    };
  }, [token, selectedRequest?.id]);

  /*
   * ---------------------------------------------------------
   * ---------------------------------------------------------
   */

  if (!token) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">
            <Droplets size={25} strokeWidth={2.4} />
          </div>

          <div className="brand-name">HemoLink</div>

          <div className="brand-subtitle">
            Hospital command center
          </div>

          <div className="login-status">
            <span className="status-dot" />
            Response network online
          </div>

          <div className="login-heading">
            <h1>Welcome back</h1>

            <p>
              Sign in to manage your blood-response desk.
            </p>
          </div>

          <form onSubmit={login}>
            <label htmlFor="emailOrPhone">
              Email or phone
            </label>

            <input
              id="emailOrPhone"
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="hospital@example.com"
              autoComplete="username"
              required
            />

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <button
              className="primary-button login-button"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="spin" size={16} />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {error && (
            <div className="error-box">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="secure-note">
            <ShieldCheck size={14} />
            Secure hospital workspace
          </div>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * DASHBOARD
   * ---------------------------------------------------------
   */

  const activeAcceptances = acceptances
    .filter((acceptance) => acceptance.status === "pending")
    .map((acceptance) => {
      const liveLocation =
        liveDonorLocations[String(acceptance.donor_id)];

      if (!liveLocation) {
        return acceptance;
      }

      return {
        ...acceptance,
        ...liveLocation,
      };
    });

  const activeRequests = requests.filter(
    (request) =>
      request.status !== "fulfilled" &&
      request.status !== "cancelled"
  );

  const criticalRequests = requests.filter(
    (request) =>
      String(request.urgency).toLowerCase() === "critical" &&
      request.status !== "fulfilled"
  );

  const fulfilledRequests = requests.filter(
    (request) => request.status === "fulfilled"
  );

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${
          mobileMenu ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-mark small">
            <Droplets size={19} />
          </div>

          <div>
            <strong>HemoLink</strong>
            <span>Hospital command center</span>
          </div>
        </div>

        <nav>
          <button
            className={`nav-item ${
              page === "dashboard" ? "active" : ""
            }`}
            onClick={() => {
              setPage("dashboard");
              setMobileMenu(false);
            }}
          >
            <Activity size={17} />
            Command center
          </button>

          <button
            className={`nav-item ${
              page === "requests" ? "active" : ""
            }`}
            onClick={() => {
              setPage("requests");
              setMobileMenu(false);
            }}
          >
            <Droplets size={17} />
            Blood requests
          </button>

          <button
            className={`nav-item ${
              page === "donors" ? "active" : ""
            }`}
          onClick={async () => {
  setMobileMenu(false);

  if (selectedRequest) {
    await openRequest(selectedRequest);
  }

  setPage("donors");
}}
          >
            <Users size={17} />
            Donor responses
          </button>

          <button
            className={`nav-item ${
              page === "notifications" ? "active" : ""
            }`}
            onClick={() => {
              setPage("notifications");
              setMobileMenu(false);
            }}
          >
            <Bell size={17} />
            Notifications
          </button>

          <button
            className={`nav-item ${
              page === "profile" ? "active" : ""
            }`}
            onClick={() => {
              setPage("profile");
              setMobileMenu(false);
            }}
          >
            <Hospital size={17} />
            Hospital profile
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="network-card">
            <span className="status-dot" />

            <div>
              <strong>Network online</strong>
              <small>HemoLink API connected</small>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={19} />
            </button>

            <div className="eyebrow">
              HOSPITAL RESPONSE DESK
            </div>

            <h1>
              {page === "dashboard"
                ? "Command center"
                : page === "requests"
                ? "Blood requests"
                : page === "donors"
                ? "Donor responses"
                : page === "notifications"
                ? "Notifications"
                : "Hospital profile"}
            </h1>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              title="Refresh"
              onClick={loadRequests}
            >
              <RefreshCw
                size={17}
                className={pageLoading ? "spin" : ""}
              />
            </button>

            <button
              className="primary-button"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={17} />
              New request
            </button>
          </div>
        </header>

        {message && (
          <div className="toast success-toast">
            <CheckCircle2 size={16} />
            <span>{message}</span>

            <button onClick={() => setMessage("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {error && token && (
          <div className="toast error-toast">
            <AlertCircle size={16} />
            <span>{error}</span>

            <button onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <>
            <section className="hero-panel">
              <div>
                <div className="hero-kicker">
                  <span className="status-dot" />
                  RESPONSE NETWORK ONLINE
                </div>

                <h2>
                  Every response starts with a clear signal.
                </h2>

                <p>
                  Coordinate urgent blood requests, donor
                  arrivals, and fulfillment from one focused
                  workspace.
                </p>
              </div>

              <div className="hero-icon">
                <Activity size={54} strokeWidth={1.5} />
              </div>
            </section>

            <section className="stats-grid">
              <StatCard
                icon={AlertCircle}
                label="Critical requests"
                value={criticalRequests.length}
                note="Requires attention"
              />

              <StatCard
                icon={Droplets}
                label="Active requests"
                value={activeRequests.length}
                note="Currently open"
              />

              <StatCard
                icon={Users}
                label="Donor responses"
                value={acceptances.length}
                note="Selected request"
              />

              <StatCard
                icon={CheckCircle2}
                label="Fulfilled"
                value={fulfilledRequests.length}
                note="Completed requests"
              />
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-kicker">
                      LIVE QUEUE
                    </div>
                    <h3>Emergency requests</h3>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setPage("requests")}
                  >
                    View all
                  </button>
                </div>

                {pageLoading ? (
                  <div className="empty-state">
                    <RefreshCw
                      size={22}
                      className="spin"
                    />
                    <strong>Loading requests</strong>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="empty-state">
                    <Droplets size={24} />
                    <strong>No blood requests</strong>
                    <span>
                      Create your first emergency request to
                      begin matching donors.
                    </span>

                    <button
                      className="primary-button"
                      onClick={() => setShowCreate(true)}
                    >
                      <Plus size={16} />
                      Create request
                    </button>
                  </div>
                ) : (
                  <div className="request-list">
                    {requests.slice(0, 8).map((request) => (
                      <button
                        className={`request-row ${
                          selectedRequest?.id === request.id
                            ? "selected"
                            : ""
                        }`}
                        key={request.id}
                        onClick={() => openRequest(request)}
                      >
                        <div className="blood-badge">
                          {request.blood_group_needed}
                        </div>

                        <div className="request-main">
                          <div className="request-title">
                            <strong>
                              {request.hospital_name}
                            </strong>

                            <span
                              className={`urgency ${String(
                                request.urgency
                              ).toLowerCase()}`}
                            >
                              {request.urgency}
                            </span>
                          </div>

                          <span>
                            {request.units_needed} unit
                            {request.units_needed === 1
                              ? ""
                              : "s"}{" "}
                            | {request.status}
                          </span>
                        </div>

                        <div className="request-time">
                          <Clock3 size={12} />
                          {formatDate(request.created_at)}
                        </div>

                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                {selectedRequest ? (
                  <>
                    <div className="panel-header">
                      <div>
                        <div className="panel-kicker">
                          REQUEST DETAILS
                        </div>
                        <h3>
                          {selectedRequest.blood_group_needed}{" "}
                          blood request
                        </h3>
                      </div>

                      <span
                        className={`status-pill ${String(
                          selectedRequest.status
                        ).toLowerCase()}`}
                      >
                        {selectedRequest.status}
                      </span>
                    </div>

                   <div className="detail-summary">
  <div>
    <span>Blood group</span>
    <strong>
      {selectedRequest.blood_group_needed}
    </strong>
  </div>

  <div>
    <span>Units required</span>
    <strong>
      {selectedRequest.units_needed}
    </strong>
  </div>

  <div>
    <span>Units fulfilled</span>
    <strong>
      {selectedRequest.fulfilled_units ?? 0}
    </strong>
  </div>

  <div>
    <span>ETA window</span>
    <strong>
      {selectedRequest.eta_window_minutes} min
    </strong>
  </div>
</div>

<div className="request-map">
  <HemoMap
    latitude={selectedRequest.latitude}
    longitude={selectedRequest.longitude}
    hospitalName={selectedRequest.hospital_name}
    request={selectedRequest}
    donors={activeAcceptances}
    height={340}
  />
</div>

                    {selectedRequest.notes && (
                      <div className="notes-box">
                        <span>REQUEST NOTES</span>
                        <p>{selectedRequest.notes}</p>
                      </div>
                    )}

                    <div className="acceptances-section">
                      <div className="section-heading">
                        <div>
                          <div className="panel-kicker">
                            DONOR NETWORK
                          </div>
                          <h4>Active responses</h4>
                        </div>

                        <span className="count-badge">
                          {activeAcceptances.length}
                        </span>
                      </div>

                      {acceptances.length === 0 ? (
                        <div className="mini-empty">
                          <Users size={16} />
                          No donor responses yet.
                        </div>
                      ) : (
                        <div className="acceptance-list">
                          {activeAcceptances.map((acceptance) => (
                            <div
                              className="acceptance-card"
                              key={acceptance.id}
                            >
                              <div className="acceptance-avatar">
                                <Users size={17} />
                              </div>

                              <div className="acceptance-info">
                                <strong>
                                  {acceptance.donor_name ||
                                    "Donor"}
                                </strong>

                                <span>
                                  {acceptance.donor_blood_group ||
                                    "Blood group unavailable"}{" "}
                                  |{" "}
                                  {acceptance.units_fulfilled}{" "}
                                  unit
                                  {acceptance.units_fulfilled ===
                                  1
                                    ? ""
                                    : "s"}{" "}
                                  | {acceptance.status}
                                </span>

                                <small>
                                  {acceptance.donor_phone ||
                                    "Phone unavailable"}{" "}
                                  |{" "}
                                  {acceptance.donor_is_verified
                                    ? "Verified donor"
                                    : "Unverified donor"}
                                </small>

                                <small>
                                  Reliability{" "}
                                  {Number(
                                    acceptance.donor_reliability_score ??
                                      0
                                  ).toFixed(0)}
                                  % |{" "}
                                  {acceptance.donor_total_donations ??
                                    0}{" "}
                                  donation
                                  {acceptance.donor_total_donations ===
                                  1
                                    ? ""
                                    : "s"}
                                </small>

                                <small>
                                  Accepted{" "}
                                  {formatDate(
                                    acceptance.accepted_at
                                  )}
                                </small>
                              </div>

                              {acceptance.status !==
                                "fulfilled" && (
                                <button
                                  className="fulfill-button"
                                  disabled={loading}
                                  onClick={() =>
                                    fulfillAcceptance(
                                      acceptance.id
                                    )
                                  }
                                >
                                  Fulfill
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="details-empty">
                    <div className="details-empty-icon">
                      <Activity size={23} />
                    </div>

                    <h3>Select a request</h3>

                    <p>
                      Select an emergency request to view its
                      details and donor responses.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {page === "requests" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">
                  REQUEST MANAGEMENT
                </div>
                <h3>All blood requests</h3>
              </div>

              <button
                className="primary-button"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={16} />
                New request
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="empty-state">
                <Droplets size={24} />
                <strong>No requests yet</strong>
              </div>
            ) : (
              <div className="request-list">
                {requests.map((request) => (
                  <button
                    className="request-row"
                    key={request.id}
                    onClick={() => {
                      openRequest(request);
                      setPage("dashboard");
                    }}
                  >
                    <div className="blood-badge">
                      {request.blood_group_needed}
                    </div>

                    <div className="request-main">
                      <div className="request-title">
                        <strong>
                          {request.hospital_name}
                        </strong>

                        <span
                          className={`urgency ${String(
                            request.urgency
                          ).toLowerCase()}`}
                        >
                          {request.urgency}
                        </span>
                      </div>

                      <span>
                        {request.units_needed} units |{" "}
                        {request.status}
                      </span>
                    </div>

                    <div className="request-time">
                      <Clock3 size={12} />
                      {formatDate(request.created_at)}
                    </div>

                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "donors" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">
                  DONOR NETWORK
                </div>
                <h3>Donor responses</h3>
              </div>
            </div>

            {selectedRequest ? (
              <div className="acceptance-list">
                {acceptances.length === 0 ? (
                  <div className="empty-state">
                    <Users size={24} />
                    <strong>No responses yet</strong>
                  </div>
                ) : (
                  acceptances.map((acceptance) => (
                    <div
                      className="acceptance-card"
                      key={acceptance.id}
                    >
                      <div className="acceptance-avatar">
                        <Users size={17} />
                      </div>

                      <div className="acceptance-info">
                        <strong>
                          {acceptance.donor_name ||
                            "Donor"}
                        </strong>

                        <span>
                          {acceptance.donor_blood_group ||
                            "Blood group unavailable"}{" "}
                          | Status: {acceptance.status}
                        </span>

                        <small>
                          {acceptance.donor_phone ||
                            "Phone unavailable"}
                        </small>

                        <small>
                          {acceptance.donor_is_verified
                            ? "Verified donor"
                            : "Unverified donor"}{" "}
                          | Reliability{" "}
                          {Number(
                            acceptance.donor_reliability_score ??
                              0
                          ).toFixed(0)}
                          %
                        </small>

                        <small>
                          {acceptance.donor_total_donations ??
                            0}{" "}
                          donation
                          {acceptance.donor_total_donations ===
                          1
                            ? ""
                            : "s"}{" "}
                          | Accepted{" "}
                          {formatDate(
                            acceptance.accepted_at
                          )}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="empty-state">
                <Users size={24} />
                <strong>Select a request first</strong>
                <span>
                  Choose a request from the command center to
                  view its donor responses.
                </span>
              </div>
            )}
          </section>
        )}

        {page === "notifications" && (
          <section className="panel">
            <div className="empty-state">
              <Bell size={25} />
              <strong>Notifications</strong>
              <span>
                Hospital notifications will appear here as
                donor responses and request updates arrive.
              </span>
            </div>
          </section>
        )}

        {page === "profile" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">
                  HOSPITAL ACCOUNT
                </div>
                <h3>Hospital profile</h3>
              </div>
            </div>

            <div className="detail-summary">
              <div>
                <span>Workspace</span>
                <strong>HemoLink Hospital</strong>
              </div>

              <div>
                <span>Network</span>
                <strong>Online</strong>
              </div>

              <div>
                <span>Backend</span>
                <strong>Connected</strong>
              </div>

              <div>
                <span>Authentication</span>
                <strong>Bearer token</strong>
              </div>
            </div>
          </section>
        )}
      </main>
        

  <div className="hemobot">
  {botOpen && (
    <div className="hemobot-panel">
      <div className="hemobot-header">
        <div className="hemobot-title">
          <div className="hemobot-avatar">
            <Bot size={17} />
          </div>

          <div>
            <strong>HemoBot</strong>
            <span>HemoLink assistant</span>
          </div>
        </div>

        <button
          className="hemobot-close"
          onClick={() => setBotOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      <div className="hemobot-messages">
        {botMessages.map((message, index) => (
          <div
            key={index}
            className={`hemobot-message ${message.role}`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <div className="hemobot-quick">
        <button onClick={() => sendBotMessage("Show critical requests")}>
          Critical
        </button>

        <button onClick={() => sendBotMessage("Show active blood requests")}>
          Requests
        </button>

        <button onClick={() => sendBotMessage("Show donor responses")}>
          Donors
        </button>
      </div>

      <form
        className="hemobot-input"
        onSubmit={(e) => {
          e.preventDefault();
          sendBotMessage();
        }}
      >
        <input
          value={botInput}
          onChange={(e) => setBotInput(e.target.value)}
          placeholder="Ask HemoBot..."
        />

        <button type="submit">
          <Send size={16} />
        </button>
      </form>
    </div>
  )}

  <button
    className="hemobot-launcher"
    onClick={() => setBotOpen((current) => !current)}
    aria-label="Open HemoBot"
  >
    {botOpen ? <X size={21} /> : <MessageCircle size={21} />}
    {!botOpen && <span>HemoBot</span>}
  </button>
</div>

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="panel-kicker">
                  EMERGENCY RESPONSE
                </div>

                <h2>Create blood request</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowCreate(false)}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={createRequest}>
              <div className="form-grid">
                <div className="field full">
                  <label>Hospital name</label>

                  <input
                    value={form.hospital_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        hospital_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label>Blood group</label>

                  <select
                    value={form.blood_group_needed}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        blood_group_needed: e.target.value,
                      })
                    }
                  >
                    {[
                      "O+",
                      "O-",
                      "A+",
                      "A-",
                      "B+",
                      "B-",
                      "AB+",
                      "AB-",
                    ].map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Units needed</label>

                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.units_needed}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        units_needed: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label>Urgency</label>

                  <select
                    value={form.urgency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        urgency: e.target.value,
                      })
                    }
                  >
                    <option value="critical">
                      Critical
                    </option>

                    <option value="urgent">
                      Urgent
                    </option>

                    <option value="standard">
                      Standard
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>ETA window</label>

                  <select
                    value={form.eta_window_minutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        eta_window_minutes:
                          e.target.value,
                      })
                    }
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </div>

                                <HospitalLocationPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onLocationChange={(latitude, longitude) => {
                    setForm((current) => ({
                      ...current,
                      latitude: String(latitude),
                      longitude: String(longitude),
                    }));
                    setLocationStatus("Hospital location selected.");
                  }}
                />

                <div className="field full">
                  <button
                    type="button"
                    onClick={detectHospitalLocation}
                    disabled={locationStatus === "Detecting hospital location..."}
                  >
                    Use my current location
                  </button>
                  {locationStatus && (
                    <small role="status" aria-live="polite">
                      {locationStatus}
                    </small>
                  )}
                </div>
<div className="field full">
                  <label>Notes</label>

                  <textarea
                    rows="4"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Add any important patient or response information..."
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;













