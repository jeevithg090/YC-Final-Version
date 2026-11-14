import type { AcademicCalendarData } from '../../utils/academicCalendar';
import icasCalendarJson from './ICAS.json';
import mitCalendarJson from './MITCalendar.json';

/**
 * Academic calendars bundled with the app.
 *
 * The JSON files ship empty; populate them with your institution's
 * calendar (see the README, "Academic calendar data").
 */
export const mitCalendar = mitCalendarJson as AcademicCalendarData;
export const icasCalendar = icasCalendarJson as AcademicCalendarData;
