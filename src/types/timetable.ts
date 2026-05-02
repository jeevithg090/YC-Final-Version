// TypeScript interfaces for AI timetable extraction

export interface ClassEntry {
  subject: string;
  startTime: string;
  endTime: string;
  room?: string;
  professor?: string;
}

export interface DaySchedule {
  day: string;
  classes: ClassEntry[];
}

export interface TimetableData {
  days: DaySchedule[];
}

export interface ExtractedTimetable {
  id: string;
  userId: string;
  originalImageUrl: string;
  extractedData: TimetableData;
  extractionDate: number;
  confidence?: number;
}

export interface ClassNotificationSettings {
  enabled: boolean;
  reminderMinutes: number;
  soundEnabled: boolean;
}

export interface UploadLimitData {
  userId: string;
  uploadsThisMonth: number;
  lastResetDate: number;
  uploadDates: number[];
}
