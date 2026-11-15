import { query } from "./db";

export type Trip = {
  id: number;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  color: string | null;
  notes: string | null;
};

export type Flight = {
  id: number;
  trip_id: number;
  airline: string | null;
  flight_no: string | null;
  from_airport: string | null;
  to_airport: string | null;
  depart_at: string | null;
  arrive_at: string | null;
  booking_ref: string | null;
  price: number | null;
  link: string | null;
  notes: string | null;
};

export type Stop = {
  id: number;
  trip_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort: number;
};

export type Hotel = {
  id: number;
  stop_id: number;
  url: string | null;
  source: string | null;
  name: string | null;
  image: string | null;
  address: string | null;
  description: string | null;
  price_total: number | null;
  price_per_night: number | null;
  currency: string | null;
  rating: number | null;
  rating_scale: number | null;
  review_count: number | null;
  checkin: string | null;
  checkout: string | null;
  orig_price: number | null;
  orig_currency: string | null;
  status: "shortlist" | "favorite" | "booked" | "rejected" | string;
  notes: string | null;
};

export type Activity = {
  id: number;
  stop_id: number;
  date: string | null;
  time: string | null;
  title: string;
  description: string | null;
  link: string | null;
  cost: number | null;
  done: boolean;
};

export const getTrips = () =>
  query<Trip>("SELECT * FROM trips ORDER BY start_date NULLS LAST, id");

export const getTrip = async (id: number) =>
  (await query<Trip>("SELECT * FROM trips WHERE id=$1", [id]))[0];

export const getStops = (tripId: number) =>
  query<Stop>(
    "SELECT * FROM stops WHERE trip_id=$1 ORDER BY start_date NULLS LAST, sort, id",
    [tripId],
  );

export const getAllStops = () =>
  query<Stop>("SELECT * FROM stops ORDER BY start_date NULLS LAST, id");

export const getStop = async (id: number) =>
  (await query<Stop>("SELECT * FROM stops WHERE id=$1", [id]))[0];

export const getFlights = (tripId: number) =>
  query<Flight>(
    "SELECT * FROM flights WHERE trip_id=$1 ORDER BY depart_at NULLS LAST, id",
    [tripId],
  );

export const getHotels = (stopId: number) =>
  query<Hotel>("SELECT * FROM hotels WHERE stop_id=$1 ORDER BY id", [stopId]);

export const getHotelsForTrip = (tripId: number) =>
  query<Hotel>(
    "SELECT h.* FROM hotels h JOIN stops s ON s.id=h.stop_id WHERE s.trip_id=$1 ORDER BY h.id",
    [tripId],
  );

export const getActivities = (stopId: number) =>
  query<Activity>(
    "SELECT * FROM activities WHERE stop_id=$1 ORDER BY date NULLS LAST, time NULLS LAST, id",
    [stopId],
  );

export const getActivitiesForTrip = (tripId: number) =>
  query<Activity>(
    "SELECT a.* FROM activities a JOIN stops s ON s.id=a.stop_id WHERE s.trip_id=$1 ORDER BY a.date NULLS LAST, a.time NULLS LAST, a.id",
    [tripId],
  );

export type FlightFile = {
  id: number;
  flight_id: number | null;
  car_id: number | null;
  filename: string;
  mime: string | null;
  size: number | null;
};

export type Car = {
  id: number;
  trip_id: number;
  company: string | null;
  car_type: string | null;
  pickup_place: string | null;
  pickup_at: string | null;
  dropoff_place: string | null;
  dropoff_at: string | null;
  booking_ref: string | null;
  price: number | null;
  link: string | null;
  notes: string | null;
  booked: boolean;
};

export const getCars = (tripId: number) =>
  query<Car>("SELECT * FROM cars WHERE trip_id=$1 ORDER BY pickup_at NULLS LAST, id", [tripId]);

export const getCarFiles = (tripId: number) =>
  query<FlightFile>(
    "SELECT ff.id, ff.flight_id, ff.car_id, ff.filename, ff.mime, ff.size FROM flight_files ff JOIN cars c ON c.id=ff.car_id WHERE c.trip_id=$1 ORDER BY ff.id",
    [tripId],
  );

export const getFlightFiles = (tripId: number) =>
  query<FlightFile>(
    "SELECT ff.id, ff.flight_id, ff.car_id, ff.filename, ff.mime, ff.size FROM flight_files ff JOIN flights f ON f.id=ff.flight_id WHERE f.trip_id=$1 ORDER BY ff.id",
    [tripId],
  );

/** Titelbild pro Urlaub: gebuchtes Hotel > Favorit > irgendein Hotel mit Bild */
export const getTripCovers = async () => {
  const rows = await query<{ trip_id: number; image: string }>(
    `SELECT DISTINCT ON (s.trip_id) s.trip_id, h.image FROM hotels h JOIN stops s ON s.id=h.stop_id
     WHERE h.image IS NOT NULL AND h.status <> 'rejected'
     ORDER BY s.trip_id, CASE h.status WHEN 'booked' THEN 0 WHEN 'favorite' THEN 1 ELSE 2 END, s.start_date NULLS LAST, h.id`,
  );
  return new Map(rows.map((r) => [r.trip_id, r.image]));
};

/** Titelbild pro Stopp */
export const getStopCovers = async (tripId: number) => {
  const rows = await query<{ stop_id: number; image: string }>(
    `SELECT DISTINCT ON (h.stop_id) h.stop_id, h.image FROM hotels h JOIN stops s ON s.id=h.stop_id
     WHERE s.trip_id=$1 AND h.image IS NOT NULL AND h.status <> 'rejected'
     ORDER BY h.stop_id, CASE h.status WHEN 'booked' THEN 0 WHEN 'favorite' THEN 1 ELSE 2 END, h.id`,
    [tripId],
  );
  return new Map(rows.map((r) => [r.stop_id, r.image]));
};
