import { useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "hemolink-map-marker",
  html: '<div class="hemolink-marker-pin hospital">H</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function MapClick({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function HospitalLocationPicker({
  latitude,
  longitude,
  onLocationChange,
}) {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  const [searching, setSearching] = useState(false);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const valid = Number.isFinite(lat) && Number.isFinite(lng);

  async function searchAddress() {

    if (!address.trim()) {
      setStatus("Enter a hospital name or address first.");
      return;
    }

    setSearching(true);
    setStatus("Searching for the address...");

    try {
      const params = new URLSearchParams({
        q: address.trim(),
        format: "jsonv2",
        limit: "5",
        countrycodes: "in",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        throw new Error("Address search is temporarily unavailable.");
      }

      const results = await response.json();

      if (!results.length) {
        setStatus("No matching address found. Try a more specific address.");
        return;
      }

      const result = results[0];
      const nextLat = Number(result.lat);
      const nextLng = Number(result.lon);

      onLocationChange(nextLat, nextLng);
      setAddress(result.display_name || address);
      setStatus("Location selected. You can adjust the pin on the map.");
    } catch (error) {
      setStatus(error.message || "Could not search for this address.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="field full hospital-location-picker">
      <label htmlFor="hospital-address-search">
        Hospital location
      </label>

      <div className="location-search-row">
        <input
          id="hospital-address-search"
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Search hospital name, street, area or address"
          autoComplete="street-address"
        />
        <button type="button" onClick={searchAddress} disabled={searching}>
          {searching ? "Searching..." : "Find location"}
        </button>
      </div>

      <p className="location-picker-help">
        Search for the hospital, then click the map to adjust its exact pin.
      </p>

      <div className="location-picker-map">
        <MapContainer
          key={`${valid ? lat : 12.9716}-${valid ? lng : 77.5946}`}
          center={valid ? [lat, lng] : [12.9716, 77.5946]}
          zoom={15}
          scrollWheelZoom
          className="location-picker-leaflet"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClick onSelect={(nextLat, nextLng) => {
            onLocationChange(nextLat, nextLng);
            setStatus("Map pin selected.");
          }} />
          {valid && (
            <Marker
              position={[lat, lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const point = event.target.getLatLng();
                  onLocationChange(point.lat, point.lng);
                  setStatus("Map pin updated.");
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {status && (
        <small className="location-picker-status" role="status" aria-live="polite">
          {status}
        </small>
      )}

      {valid && (
        <small className="location-picker-coordinates">
          Selected location: {lat.toFixed(5)}, {lng.toFixed(5)}
        </small>
      )}
    </section>
  );
}

