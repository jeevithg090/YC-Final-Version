/** Pure ride-sharing calculations shared by the auto and cab share screens. */

export interface RideOccupancy {
  /** People in the ride, including the creator. */
  occupants: number;
  /** Seats still available (never negative). */
  seatsLeft: number;
  /** Whether no more passengers can join. */
  isFull: boolean;
  /** Each occupant's share of the total fare, rounded up to the nearest whole unit. */
  costPerPerson: number;
}

/**
 * Works out seat availability and the per-person fare for a shared ride.
 *
 * `maxPassengers` is the ride's total capacity including its creator, and
 * `passengerCount` counts only the people who joined after publishing.
 */
export function calculateRideOccupancy(
  totalCost: number,
  maxPassengers: number,
  passengerCount: number,
): RideOccupancy {
  const capacity = Number.isFinite(maxPassengers) && maxPassengers > 0 ? Math.floor(maxPassengers) : 1;
  const joined = Number.isFinite(passengerCount) && passengerCount > 0 ? Math.floor(passengerCount) : 0;
  const occupants = joined + 1;
  const fare = Number.isFinite(totalCost) && totalCost > 0 ? totalCost : 0;

  return {
    occupants,
    seatsLeft: Math.max(0, capacity - occupants),
    isFull: occupants >= capacity,
    costPerPerson: Math.ceil(fare / occupants),
  };
}
