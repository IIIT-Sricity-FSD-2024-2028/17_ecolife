import { convertQuantity } from './unit-conversion';

describe('Unit Conversion Engine (GHG Protocol Standards)', () => {
  describe('Energy conversions', () => {
    it('converts kWh to MWh and vice versa', () => {
      expect(convertQuantity(1000, 'kWh', 'MWh')).toBeCloseTo(1, 4);
      expect(convertQuantity(2.5, 'MWh', 'kWh')).toBeCloseTo(2500, 4);
    });

    it('converts therms to kWh and vice versa using standard EPA factor (1 therm ≈ 29.3001 kWh)', () => {
      expect(convertQuantity(10, 'therms', 'kWh')).toBeCloseTo(293.001, 2);
      expect(convertQuantity(293.001, 'kWh', 'therms')).toBeCloseTo(10, 2);
    });

    it('converts megajoules to kWh', () => {
      // 3.6 MJ = 1 kWh
      expect(convertQuantity(3.6, 'MJ', 'kWh')).toBeCloseTo(1, 4);
    });
  });

  describe('Volume conversions', () => {
    it('converts US gallons to liters using NIST factor (1 gal = 3.785411784 L)', () => {
      expect(convertQuantity(100, 'gallons', 'liters')).toBeCloseTo(378.541, 2);
      expect(convertQuantity(378.5411784, 'liters', 'gallons')).toBeCloseTo(100, 2);
    });

    it('converts cubic meters to liters (1 m³ = 1000 L)', () => {
      expect(convertQuantity(5, 'm3', 'liters')).toBeCloseTo(5000, 2);
    });
  });

  describe('Mass conversions', () => {
    it('converts kilograms to metric tonnes and vice versa', () => {
      expect(convertQuantity(2500, 'kg', 'tonnes')).toBeCloseTo(2.5, 4);
      expect(convertQuantity(1.5, 'tonnes', 'kg')).toBeCloseTo(1500, 4);
    });

    it('converts pounds to kilograms', () => {
      expect(convertQuantity(100, 'lbs', 'kg')).toBeCloseTo(45.359, 2);
    });
  });

  describe('Natural gas volume to energy conversion', () => {
    it('converts natural gas cubic meters to therms (EPA reference 1 m³ ≈ 0.35315 therms)', () => {
      expect(convertQuantity(100, 'm3', 'therms')).toBeCloseTo(35.315, 2);
      expect(convertQuantity(35.315, 'therms', 'm3')).toBeCloseTo(100, 2);
    });
  });

  describe('Edge cases and identical units', () => {
    it('returns exact quantity if units match case-insensitively', () => {
      expect(convertQuantity(42.5, 'KWH', 'kwh')).toBe(42.5);
      expect(convertQuantity(10, 'Liters', 'l')).toBe(10);
    });

    it('returns unadjusted quantity for unrecognized or cross-domain incompatible units', () => {
      expect(convertQuantity(100, 'unknown_unit', 'kWh')).toBe(100);
    });
  });
});
