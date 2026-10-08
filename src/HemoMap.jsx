import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const hospitalIcon = L.divIcon({
  className: "hemolink-map-marker",
  html: '<div class="hemolink-marker-pin hospital">H</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const requestIcon = L.divIcon({
  className: "hemolink-map-marker",
  html: '<div class="hemolink-marker-pin request">+</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const donorIcon = L.divIcon({
  className: "hemolink-map-marker",
  html: '<div class="hemolink-marker-pin donor"><span>?</span></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

function parseTimestamp(value) {
  if (!value) return null;
  const raw = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  const date = new Date(hasTimezone ? raw : `${raw}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function locationLabel(value) {
  const date = parseTimestamp(value);
  if (!date) return "Location not updated yet";

  const ageMs = Date.now() - date.getTime();
  if (ageMs < 0 || ageMs > 2 * 60 * 1000) {
    return `Location stale � Updated ${date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (ageMs < 30 * 1000) return "Updated just now";
  return `Updated ${Math.floor(ageMs / 1000)} seconds ago`;
}

export default function HemoMap({
  latitude,
  longitude,
  hospitalName = "HemoLink Hospital",
  request,
  donors = [],
  height = 360,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="map-empty">
        <strong>Location unavailable</strong>
        <span>This request does not contain valid coordinates.</span>
      </div>
    );
  }

  const mappedDonors = donors.filter((donor) => {
    const donorLat = Number(donor.donor_latitude);
    const donorLng = Number(donor.donor_longitude);
    return (
      donor.status === "pending" &&
      donor.donor_location_updated_at &&
      Number.isFinite(donorLat) &&
      Number.isFinite(donorLng) &&
      donorLat >= -90 &&
      donorLat <= 90 &&
      donorLng >= -180 &&
      donorLng <= 180
    );
  });

  return (
    <div className="hemolink-map" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom
        className="hemolink-leaflet-map"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[lat, lng]} icon={hospitalIcon}>
          <Popup>
            <strong>{hospitalName}</strong>
            <br />
            Hospital location
          </Popup>
        </Marker>

        {request?.latitude != null && request?.longitude != null && (
          <Marker
            position={[
              Number(request.latitude),
              Number(request.longitude),
            ]}
            icon={requestIcon}
          >
            <Popup>
              <strong>{request.blood_group_needed || "Blood"} request</strong>
              <br />
              {request.units_needed || 0} unit
              {request.units_needed === 1 ? "" : "s"}
              <br />
              {request.urgency || "standard"} priority
            </Popup>
          </Marker>
        )}

        {mappedDonors.map((donor) => (
          <Marker
            key={donor.id}
            position={[
              Number(donor.donor_latitude),
              Number(donor.donor_longitude),
            ]}
            icon={donorIcon}
          >
            <Popup>
              <strong>{donor.donor_name || "Accepted donor"}</strong>
              <br />
              {donor.donor_blood_group || "Blood group unavailable"}
              <br />
              {locationLabel(donor.donor_location_updated_at)}
              <br />
              Donor location reported by their phone
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

