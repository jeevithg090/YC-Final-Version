import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Platform, Animated, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// Directly import the local JSON files
import mitCalendarData from '../../MITCalendar.json';
import icasCalendarData from '../../ICAS.json';

interface CalendarEvent {
  date: string;
  day: string;
  event: string;
}

interface CalendarMonth {
  name: string;
  events: CalendarEvent[];
}

const AcademicCalendar: React.FC = () => {
  const [calendarData, setCalendarData] = useState<CalendarMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [todayAnim] = useState(new Animated.Value(1));
  const [calendarType, setCalendarType] = useState<'MIT' | 'ICAS'>('MIT'); // Default to MIT calendar

  useEffect(() => {
    loadCalendarData();
  }, [calendarType]); // Reload when calendar type changes

  // Helper to find the month index containing the closest upcoming event (or today)
  const getInitialMonthIndex = (months: CalendarMonth[]): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let closestMonthIdx = 0;
    let minDays = Infinity;
    months.forEach((month, idx) => {
      month.events.forEach(event => {
        const days = calculateDaysRemaining(event.date, month.name);
        if (days >= 0 && days < minDays) {
          minDays = days;
          closestMonthIdx = idx;
        }
      });
    });
    return closestMonthIdx;
  };

  const loadCalendarData = () => {
    setLoading(true);
    setError(null);
    try {
      // Use the selected calendar data based on calendarType
      const selectedCalendarData = calendarType === 'MIT' ? mitCalendarData : icasCalendarData;
      setCalendarData(selectedCalendarData.months);
      // Auto-select the month with the closest upcoming/today event
      const idx = getInitialMonthIndex(selectedCalendarData.months);
      setCurrentMonthIndex(idx);
      setShowPastEvents(false); // Reset past events collapse on reload
      setLoading(false);
    } catch (err) {
      setError('Failed to load calendar data.');
      setLoading(false);
    }
  };

  // Calculate days remaining, robust for academic year (July-June)
  const calculateDaysRemaining = (dateString: string, monthName: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Extract day number
    const dayMatch = dateString.match(/(\d+)/);
    if (!dayMatch) return 0;
    const day = parseInt(dayMatch[1]);
    const currentYear = today.getFullYear();
    const eventMonthIdx = getMonthIndex(monthName);
    const currentMonthIdx = today.getMonth();

    // Academic year starts in July
    let eventYear = currentYear;
    if (eventMonthIdx < 6 && currentMonthIdx >= 6) {
      // If event is Jan-Jun and today is July-Dec, event is next year
      eventYear = currentYear + 1;
    }
    // If event is July-Dec and today is Jan-Jun, event is previous year (shouldn't happen for future events)

    let eventDate = new Date(eventYear, eventMonthIdx, day);
    eventDate.setHours(0, 0, 0, 0);

    const timeDiff = eventDate.getTime() - today.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    return daysDiff;
  };

  const getMonthIndex = (monthName: string): number => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.indexOf(monthName);
  };

  const formatDaysRemaining = (days: number): string => {
    if (days < 0) {
      return `${Math.abs(days)} days ago`;
    } else if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return '1 day to go';
    } else {
      return `${days} days to go`;
    }
  };

  const getDaysRemainingColor = (days: number): string => {
    if (days < 0) {
      return '#b2bec3'; // Faded gray for past events
    } else if (days === 0) {
      return '#0984e3'; // Blue for today
    } else if (days <= 3) {
      return '#e17055'; // Red for urgent (within 3 days)
    } else if (days <= 7) {
      return '#fdcb6e'; // Orange for soon (within a week)
    } else if (days <= 30) {
      return '#00b894'; // Green for this month
    } else {
      return '#00cec9'; // Teal for future events
    }
  };

  const animateToday = () => {
    Animated.sequence([
      Animated.timing(todayAnim, { toValue: 1.05, duration: 180, useNativeDriver: true }),
      Animated.timing(todayAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const renderEvent = (event: CalendarEvent, monthName: string, idx: number) => {
    const daysRemaining = calculateDaysRemaining(event.date, monthName);
    const daysText = formatDaysRemaining(daysRemaining);
    const daysColor = getDaysRemainingColor(daysRemaining);
    const isToday = daysRemaining === 0;
    const isPast = daysRemaining < 0;

    const cardContent = (
      <View
        style={[
          styles.eventCard,
          {
            borderLeftWidth: 0,
            backgroundColor: isToday
              ? '#e3f2fd'
              : isPast
              ? '#f7f7fa'
              : '#fff',
            opacity: isPast ? 0.6 : 1,
            shadowColor: isToday ? '#0984e3' : '#636e72',
            shadowOpacity: isToday ? 0.18 : 0.08,
            shadowRadius: isToday ? 8 : 2,
            elevation: isToday ? 4 : 1,
            borderWidth: 0,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${event.event}, ${daysText}`}
      >
        <View style={styles.eventRow}>
          <Ionicons
            name={isToday ? 'star' : isPast ? 'time' : 'calendar'}
            size={22}
            color={daysColor}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.eventTitle,
                isToday && { color: '#0984e3' },
                isPast && { color: '#636e72', fontStyle: 'italic' },
              ]}
            >
              {event.event}
            </Text>
            <View style={styles.eventDetailsRow}>
              <Text style={styles.eventDetail}>
                {event.date}
                {event.day ? ` | ${event.day}` : ''}
              </Text>
              <LinearGradient
                colors={isToday ? ['#0984e3', '#74b9ff'] : isPast ? ['#b2bec3', '#dfe6e9'] : ['#00b894', '#00cec9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.daysRemainingBadge}
              >
                <Text style={[styles.daysRemainingText, { color: '#fff' }]}> {daysText} </Text>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>
    );
    if (isToday) {
      animateToday();
      return (
        <Animated.View key={idx} style={{ transform: [{ scale: todayAnim }] }}>
          {cardContent}
        </Animated.View>
      );
    }
    return <View key={idx}>{cardContent}</View>;
  };

  if (loading) {
    return (
      <View style={styles.centered}><Text>Loading Academic Calendar...</Text></View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}><Text>{error}</Text></View>
    );
  }

  // Guard for empty data
  if (!calendarData.length) {
    return (
      <View style={styles.centered}><Text>No calendar data available.</Text></View>
    );
  }

  const currentMonth = calendarData[currentMonthIndex];

  // Split events into upcoming/today and past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = currentMonth.events.filter(e => calculateDaysRemaining(e.date, currentMonth.name) >= 0);
  const pastEvents = currentMonth.events.filter(e => calculateDaysRemaining(e.date, currentMonth.name) < 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.stickyHeader}>
        <Text style={styles.header}>Academic Calendar</Text>
      </View>
      <View style={styles.calendarTypeSelector}>
        <TouchableOpacity 
          style={[styles.calendarTypeButton, calendarType === 'MIT' && styles.calendarTypeButtonActive]} 
          onPress={() => setCalendarType('MIT')}
        >
          <Text style={[styles.calendarTypeText, calendarType === 'MIT' && styles.calendarTypeTextActive]}>MIT Manipal</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.calendarTypeButton, calendarType === 'ICAS' && styles.calendarTypeButtonActive]} 
          onPress={() => setCalendarType('ICAS')}
        >
          <Text style={[styles.calendarTypeText, calendarType === 'ICAS' && styles.calendarTypeTextActive]}>ICAS</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.monthNavRowModern}>
        <TouchableOpacity
          style={[styles.monthNavButtonModern, currentMonthIndex === 0 && styles.monthNavButtonDisabled]}
          onPress={() => { setCurrentMonthIndex(i => Math.max(0, i - 1)); setShowPastEvents(false); }}
          disabled={currentMonthIndex === 0}
        >
          <Ionicons name="chevron-back" size={24} color={currentMonthIndex === 0 ? '#ccc' : '#00B894'} />
        </TouchableOpacity>
        <Text style={styles.monthNavTextModern}>{currentMonth.name}</Text>
        <TouchableOpacity
          style={[styles.monthNavButtonModern, currentMonthIndex === calendarData.length - 1 && styles.monthNavButtonDisabled]}
          onPress={() => { setCurrentMonthIndex(i => Math.min(calendarData.length - 1, i + 1)); setShowPastEvents(false); }}
          disabled={currentMonthIndex === calendarData.length - 1}
        >
          <Ionicons name="chevron-forward" size={24} color={currentMonthIndex === calendarData.length - 1 ? '#ccc' : '#00B894'} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View key={currentMonth.name} style={styles.monthSectionModern}>
          {upcomingEvents.length > 0 && (
            <Text style={styles.sectionHeader}>Upcoming Events</Text>
          )}
          {upcomingEvents.length > 0
            ? upcomingEvents.map((event, i) => renderEvent(event, currentMonth.name, i))
            : <Text style={styles.noEventsText}>No upcoming events this month.</Text>
          }
          {pastEvents.length > 0 && (
            <View style={styles.pastEventsSection}>
              <TouchableOpacity
                style={styles.pastEventsToggle}
                onPress={() => setShowPastEvents(v => !v)}
                accessibilityLabel={showPastEvents ? "Hide past events" : "Show past events"}
              >
                <Ionicons name={showPastEvents ? "chevron-down" : "chevron-forward"} size={18} color="#636e72" style={{ marginRight: 6 }} />
                <Text style={styles.pastEventsToggleText}>{showPastEvents ? "Hide" : "Show"} Past Events ({pastEvents.length})</Text>
              </TouchableOpacity>
              {showPastEvents && (
                <View style={styles.pastEventsList}>
                  <Text style={styles.sectionHeader}>Past Events</Text>
                  {pastEvents.map((event, i) => renderEvent(event, currentMonth.name, i + 1000))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  calendarTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  calendarTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  calendarTypeButtonActive: {
    backgroundColor: '#007bff',
  },
  calendarTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  calendarTypeTextActive: {
    color: '#fff',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3A7CA5',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.5,
    textShadowColor: '#3A7CA522',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  monthSectionModern: {
    marginTop: 0,
    marginBottom: 32,
    marginHorizontal: 8,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#3A7CA5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 0,
  },
  eventCard: {
    padding: 20,
    marginVertical: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    shadowColor: '#BFD7ED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 0,
    transitionProperty: 'background-color',
    transitionDuration: '0.2s',
  },
  daysRemainingBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    minWidth: 90,
    alignItems: 'center',
    borderWidth: 0,
    marginLeft: 8,
    shadowColor: '#BFD7ED',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    backgroundColor: '#EAF2FB',
  },
  daysRemainingText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.1,
    color: '#3A7CA5',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#222E3A',
    marginBottom: 4,
    letterSpacing: 0.1,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  eventDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventDetail: {
    fontSize: 14,
    color: '#6B7A90',
    marginRight: 8,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7A90',
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 2,
    letterSpacing: 0.2,
  },
  noEventsText: {
    fontSize: 15,
    color: '#BFD7ED',
    marginVertical: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  pastEventsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAF2FB',
    paddingTop: 8,
    backgroundColor: '#F4F7FB',
    borderRadius: 10,
  },
  pastEventsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: '#EAF2FB',
    marginBottom: 2,
  },
  pastEventsToggleText: {
    fontSize: 14,
    color: '#6B7A90',
    fontWeight: '600',
  },
  pastEventsList: {
    marginTop: 4,
    backgroundColor: '#F4F7FB',
    borderRadius: 8,
    paddingBottom: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginHorizontal: 16,
  },
  refreshButton: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#00B89410',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 36,
    shadowColor: '#00b89433',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginHorizontal: 16,
    gap: 8,
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#00B89410',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 36,
    borderWidth: 1,
    borderColor: '#00b89433',
  },
  monthNavButtonDisabled: {
    backgroundColor: '#eee',
    borderColor: '#eee',
  },
  monthNavText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00B894',
    marginHorizontal: 12,
    backgroundColor: '#e3f9f1',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#00b89422',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  stickyHeader: {
    position: 'relative',
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A7CA5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: '#e3f0fa',
  },
  fabRefresh: {
    position: 'absolute',
    right: 24,
    top: Platform.OS === 'ios' ? 62 : 42,
    backgroundColor: '#3A7CA5',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A7CA5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  monthNavRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginTop: 0,
    marginHorizontal: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#3A7CA5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: 8,
  },
  monthNavButtonModern: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#EAF2FB',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: 40,
    borderWidth: 1,
    borderColor: '#BFD7ED',
  },
  monthNavTextModern: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A7CA5',
    marginHorizontal: 12,
    backgroundColor: '#EAF2FB',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#3A7CA522',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});

export default AcademicCalendar;