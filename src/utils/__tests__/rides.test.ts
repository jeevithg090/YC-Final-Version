import { calculateRideOccupancy } from '../rides';

describe('calculateRideOccupancy', () => {
  it('counts the creator as an occupant', () => {
    expect(calculateRideOccupancy(600, 4, 0)).toEqual({
      occupants: 1,
      seatsLeft: 3,
      isFull: false,
      costPerPerson: 600,
    });
  });

  it('splits the fare between everyone and rounds up', () => {
    expect(calculateRideOccupancy(1000, 4, 2)).toMatchObject({ occupants: 3, seatsLeft: 1, costPerPerson: 334 });
  });

  it('marks the ride full at capacity and never reports negative seats', () => {
    expect(calculateRideOccupancy(800, 4, 3)).toMatchObject({ seatsLeft: 0, isFull: true });
    expect(calculateRideOccupancy(800, 2, 5)).toMatchObject({ seatsLeft: 0, isFull: true });
  });

  it('falls back to safe values for invalid input', () => {
    expect(calculateRideOccupancy(Number.NaN, 0, -1)).toEqual({
      occupants: 1,
      seatsLeft: 0,
      isFull: true,
      costPerPerson: 0,
    });
  });
});
