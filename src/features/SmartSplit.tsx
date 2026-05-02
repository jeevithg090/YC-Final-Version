import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
  FlatList,
  Dimensions,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

// TypeScript interfaces
interface Person {
  id: string;
  name: string;
  amount: number;
  isPaid: boolean;
  contactInfo?: string;
}

interface Expense {
  id: string;
  title: string;
  totalAmount: number;
  createdAt: Date;
  paidBy: string;
  splitType: 'equal' | 'custom' | 'percentage';
  people: Person[];
  category: string;
  description?: string;
  isSettled: boolean;
}

interface SplitCalculation {
  personId: string;
  name: string;
  owes: number;
  isOwed: number;
  netAmount: number;
}

const { width } = Dimensions.get('window');

const SmartSplit: React.FC = () => {
  const navigation = useNavigation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddExpense, setShowAddExpense] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'groups'>('expenses');

  // Add expense form state
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '',
    paidBy: '',
    category: 'Food',
    description: '',
    splitType: 'equal' as 'equal' | 'custom' | 'percentage',
  });
  const [participants, setParticipants] = useState<Person[]>([]);
  const [showAddPerson, setShowAddPerson] = useState<boolean>(false);
  const [newPersonName, setNewPersonName] = useState<string>('');

  // Categories for expenses
  const categories = [
    { name: 'Food', icon: 'restaurant', color: '#FF6B6B' },
    { name: 'Transport', icon: 'car', color: '#4ECDC4' },
    { name: 'Entertainment', icon: 'game-controller', color: '#45B7D1' },
    { name: 'Shopping', icon: 'bag', color: '#96CEB4' },
    { name: 'Bills', icon: 'receipt', color: '#FFEAA7' },
    { name: 'Other', icon: 'ellipsis-horizontal', color: '#DDA0DD' },
  ];

  // Load saved data on component mount
  useEffect(() => {
    loadExpensesFromStorage();
  }, []);

  const loadExpensesFromStorage = async () => {
    try {
      // In a real app, this would load from AsyncStorage or Firebase
      // For now, we'll use mock data
      const mockExpenses: Expense[] = [
        {
          id: '1',
          title: 'Dinner at Food Court',
          totalAmount: 450,
          createdAt: new Date('2024-12-25'),
          paidBy: 'Jeevith',
          splitType: 'equal',
          people: [
            { id: '1', name: 'Jeevith', amount: 150, isPaid: true },
            { id: '2', name: 'Rahul', amount: 150, isPaid: false },
            { id: '3', name: 'Priya', amount: 150, isPaid: true },
          ],
          category: 'Food',
          description: 'Group dinner after movie',
          isSettled: false,
        },
        {
          id: '2',
          title: 'Uber to Airport',
          totalAmount: 320,
          createdAt: new Date('2024-12-24'),
          paidBy: 'Rahul',
          splitType: 'equal',
          people: [
            { id: '1', name: 'Jeevith', amount: 80, isPaid: true },
            { id: '2', name: 'Rahul', amount: 80, isPaid: true },
            { id: '3', name: 'Priya', amount: 80, isPaid: false },
            { id: '4', name: 'Amit', amount: 80, isPaid: false },
          ],
          category: 'Transport',
          isSettled: false,
        },
      ];
      setExpenses(mockExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const calculateBalances = (): SplitCalculation[] => {
    const balances: { [key: string]: SplitCalculation } = {};

    // Initialize balances for all participants
    expenses.forEach(expense => {
      expense.people.forEach(person => {
        if (!balances[person.id]) {
          balances[person.id] = {
            personId: person.id,
            name: person.name,
            owes: 0,
            isOwed: 0,
            netAmount: 0,
          };
        }
      });
    });

    // Calculate who owes what
    expenses.forEach(expense => {
      if (!expense.isSettled) {
        expense.people.forEach(person => {
          if (person.name === expense.paidBy) {
            // This person paid for others
            balances[person.id].isOwed += expense.totalAmount - person.amount;
          } else {
            // This person owes money
            balances[person.id].owes += person.amount;
          }
        });
      }
    });

    // Calculate net amounts
    Object.values(balances).forEach(balance => {
      balance.netAmount = balance.isOwed - balance.owes;
    });

    return Object.values(balances);
  };

  const addPerson = () => {
    if (newPersonName.trim()) {
      const newPerson: Person = {
        id: Date.now().toString(),
        name: newPersonName.trim(),
        amount: 0,
        isPaid: false,
      };
      setParticipants([...participants, newPerson]);
      setNewPersonName('');
      setShowAddPerson(false);
    }
  };

  const removePerson = (personId: string) => {
    setParticipants(participants.filter(p => p.id !== personId));
  };

  const updatePersonAmount = (personId: string, amount: string) => {
    setParticipants(participants.map(p => 
      p.id === personId ? { ...p, amount: parseFloat(amount) || 0 } : p
    ));
  };

  const calculateEqualSplit = () => {
    const totalAmount = parseFloat(newExpense.amount) || 0;
    const splitAmount = totalAmount / participants.length;
    setParticipants(participants.map(p => ({ ...p, amount: splitAmount })));
  };

  const addExpense = () => {
    if (!newExpense.title.trim() || !newExpense.amount || participants.length === 0) {
      Alert.alert('Error', 'Please fill in all required fields and add participants');
      return;
    }

    const totalSplit = participants.reduce((sum, p) => sum + p.amount, 0);
    const totalAmount = parseFloat(newExpense.amount);

    if (Math.abs(totalSplit - totalAmount) > 0.01) {
      Alert.alert('Error', 'Split amounts do not match the total amount');
      return;
    }

    const expense: Expense = {
      id: Date.now().toString(),
      title: newExpense.title,
      totalAmount: totalAmount,
      createdAt: new Date(),
      paidBy: newExpense.paidBy || participants[0]?.name || '',
      splitType: newExpense.splitType,
      people: participants,
      category: newExpense.category,
      description: newExpense.description,
      isSettled: false,
    };

    setExpenses([expense, ...expenses]);
    
    // Reset form
    setNewExpense({
      title: '',
      amount: '',
      paidBy: '',
      category: 'Food',
      description: '',
      splitType: 'equal',
    });
    setParticipants([]);
    setShowAddExpense(false);
    
    Alert.alert('Success', 'Expense added successfully!');
  };

  const settleExpense = (expenseId: string) => {
    Alert.alert(
      'Settle Expense',
      'Mark this expense as settled?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: () => {
            setExpenses(expenses.map(exp => 
              exp.id === expenseId ? { ...exp, isSettled: true } : exp
            ));
          },
        },
      ]
    );
  };

  const renderExpenseCard = ({ item }: { item: Expense }) => {
    const categoryInfo = categories.find(c => c.name === item.category) || categories[0];
    
    return (
      <View style={styles.expenseCard}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
          style={styles.expenseCardGradient}
        >
          <View style={styles.expenseHeader}>
            <View style={styles.expenseIconContainer}>
              <View style={[styles.categoryIcon, { backgroundColor: categoryInfo.color + '20' }]}>
                <Ionicons name={categoryInfo.icon as any} size={24} color={categoryInfo.color} />
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle}>{item.title}</Text>
                <Text style={styles.expenseDate}>
                  {item.createdAt.toLocaleDateString()} • Paid by {item.paidBy}
                </Text>
              </View>
            </View>
            <View style={styles.expenseAmount}>
              <Text style={styles.amountText}>₹{item.totalAmount}</Text>
              {item.isSettled && (
                <View style={styles.settledBadge}>
                  <Text style={styles.settledText}>Settled</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.participantsList}>
            {item.people.map((person, index) => (
              <View key={person.id} style={styles.participantItem}>
                <Text style={styles.participantName}>{person.name}</Text>
                <View style={styles.participantAmount}>
                  <Text style={[styles.amountOwed, person.isPaid && styles.paidAmount]}>
                    ₹{person.amount}
                  </Text>
                  {person.isPaid ? (
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  ) : (
                    <Ionicons name="time-outline" size={16} color="#FF9500" />
                  )}
                </View>
              </View>
            ))}
          </View>

          {!item.isSettled && (
            <TouchableOpacity
              style={styles.settleButton}
              onPress={() => settleExpense(item.id)}
            >
              <Text style={styles.settleButtonText}>Mark as Settled</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    );
  };

  const renderBalanceCard = ({ item }: { item: SplitCalculation }) => (
    <View style={styles.balanceCard}>
      <LinearGradient
        colors={item.netAmount >= 0 ? ['#E8F5E8', '#F0FFF0'] : ['#FFE8E8', '#FFF0F0']}
        style={styles.balanceCardGradient}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceName}>{item.name}</Text>
          <Text style={[
            styles.balanceAmount,
            { color: item.netAmount >= 0 ? '#4CAF50' : '#F44336' }
          ]}>
            {item.netAmount >= 0 ? '+' : ''}₹{Math.abs(item.netAmount).toFixed(2)}
          </Text>
        </View>
        <Text style={styles.balanceDetails}>
          {item.netAmount >= 0 
            ? `Should receive ₹${item.isOwed.toFixed(2)}`
            : `Owes ₹${item.owes.toFixed(2)}`
          }
        </Text>
      </LinearGradient>
    </View>
  );

  const renderAddExpenseModal = () => (
    <Modal
      visible={showAddExpense}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <LinearGradient
          colors={['#F8FAFF', '#FFFFFF']}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddExpense(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <TouchableOpacity onPress={addExpense}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Expense Title</Text>
              <TextInput
                style={styles.textInput}
                value={newExpense.title}
                onChangeText={(text) => setNewExpense({...newExpense, title: text})}
                placeholder="e.g., Dinner at restaurant"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Total Amount (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={newExpense.amount}
                onChangeText={(text) => setNewExpense({...newExpense, amount: text})}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.name}
                    style={[
                      styles.categoryButton,
                      newExpense.category === category.name && styles.selectedCategory
                    ]}
                    onPress={() => setNewExpense({...newExpense, category: category.name})}
                  >
                    <Ionicons name={category.icon as any} size={20} color={category.color} />
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.participantsHeader}>
                <Text style={styles.label}>Participants</Text>
                <TouchableOpacity
                  style={styles.addPersonButton}
                  onPress={() => setShowAddPerson(true)}
                >
                  <Ionicons name="add" size={20} color="#4E54C8" />
                  <Text style={styles.addPersonText}>Add Person</Text>
                </TouchableOpacity>
              </View>

              {participants.map((person) => (
                <View key={person.id} style={styles.participantRow}>
                  <Text style={styles.participantRowName}>{person.name}</Text>
                  <View style={styles.participantRowActions}>
                    <TextInput
                      style={styles.amountInput}
                      value={person.amount.toString()}
                      onChangeText={(text) => updatePersonAmount(person.id, text)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => removePerson(person.id)}>
                      <Ionicons name="close-circle" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {participants.length > 0 && (
                <TouchableOpacity
                  style={styles.equalSplitButton}
                  onPress={calculateEqualSplit}
                >
                  <Text style={styles.equalSplitText}>Split Equally</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>

      <Modal visible={showAddPerson} transparent animationType="fade">
        <BlurView intensity={50} style={styles.blurBackground}>
          <View style={styles.addPersonModal}>
            <Text style={styles.addPersonTitle}>Add Person</Text>
            <TextInput
              style={styles.personNameInput}
              value={newPersonName}
              onChangeText={setNewPersonName}
              placeholder="Enter name"
              autoFocus
            />
            <View style={styles.addPersonActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddPerson(false);
                  setNewPersonName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={addPerson}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={['#F8FAFF', '#FFFFFF', '#F0F8FF']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Smart Split</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.billSplitterButton}
              onPress={() => navigation.navigate('SmartBillSplitter' as never)}
            >
              <Ionicons name="camera" size={20} color="#4E54C8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addExpenseButton}
              onPress={() => setShowAddExpense(true)}
            >
              <Ionicons name="add" size={24} color="#4E54C8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {(['expenses', 'balances', 'groups'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {activeTab === 'expenses' && (
          <FlatList
            data={expenses}
            renderItem={renderExpenseCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>No expenses yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add your first expense to start splitting bills
                </Text>
              </View>
            }
          />
        )}

        {activeTab === 'balances' && (
          <FlatList
            data={calculateBalances()}
            renderItem={renderBalanceCard}
            keyExtractor={(item) => item.personId}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="analytics-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>No balances to show</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add expenses to see who owes what
                </Text>
              </View>
            }
          />
        )}

        {activeTab === 'groups' && (
          <View style={styles.comingSoon}>
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
            <Text style={styles.comingSoonText}>Groups Feature</Text>
            <Text style={styles.comingSoonSubtext}>
              Coming soon! Create groups for recurring expenses.
            </Text>
          </View>
        )}

        {renderAddExpenseModal()}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billSplitterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addExpenseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#4E54C8',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  expenseCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  expenseCardGradient: {
    padding: 20,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  expenseIconContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  settledBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  settledText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  participantsList: {
    marginTop: 16,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  participantName: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  participantAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountOwed: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
  },
  paidAmount: {
    color: '#4CAF50',
  },
  settleButton: {
    backgroundColor: '#4E54C8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  settleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceCardGradient: {
    padding: 20,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  balanceDetails: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  comingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  comingSoonSubtext: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    gap: 8,
  },
  selectedCategory: {
    backgroundColor: '#4E54C8',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addPersonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPersonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  participantRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    flex: 1,
  },
  participantRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
  },
  equalSplitButton: {
    backgroundColor: '#4E54C8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  equalSplitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  blurBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  addPersonModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: width * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  addPersonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  personNameInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  addPersonActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4E54C8',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SmartSplit;
