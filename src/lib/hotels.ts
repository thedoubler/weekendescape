import type { Deal } from "@/lib/deals";

// Booking.com affiliate id. Join their partner program, then set
// NEXT_PUBLIC_BOOKING_AID to earn a commission on hotel referrals. Left unset,
// the link still works — it just isn't monetized.
const BOOKING_AID = process.env.NEXT_PUBLIC_BOOKING_AID;

// A Booking.com search deep-linked to the destination and the exact weekend:
// check in when you land, check out when you fly home. Verified to open a
// pre-filled results page (city + dates + 1 guest), not the homepage.
export function hotelUrl(deal: Deal, adults = 1): string {
  const params = new URLSearchParams({
    ss: deal.countryTo ? `${deal.cityTo}, ${deal.countryTo}` : deal.cityTo,
    checkin: deal.outArrive.slice(0, 10),
    checkout: deal.backDepart.slice(0, 10),
    // Match the flight's party size so the hotel search isn't reset to 1 guest.
    group_adults: String(Math.max(1, Math.min(9, adults))),
    group_children: "0",
    no_rooms: "1",
  });
  if (BOOKING_AID) params.set("aid", BOOKING_AID);
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}
