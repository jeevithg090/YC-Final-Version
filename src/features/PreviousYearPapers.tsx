import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// TypeScript interfaces based on Papers Please API structure
interface PaperFromAPI {
  id: string;
  path: string[];
  name: string;
  url: string;
  year: string;
  term: string;
  programme?: string;
  semester?: string;
  branch?: string;
  subject?: string;
}

interface APIResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  results: PaperFromAPI[];
}

const { width } = Dimensions.get('window');

// Papers Please API base URL
const PAPERS_API_BASE = 'https://papers-please-jade.vercel.app/api';

const PreviousYearPapers: React.FC = () => {
  const navigation = useNavigation();
  const [papers, setPapers] = useState<PaperFromAPI[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalPapers, setTotalPapers] = useState<number>(0);
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  
  // Filter options
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [programmeOptions, setProgrammeOptions] = useState<string[]>([]);
  const [termOptions, setTermOptions] = useState<string[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  
  // Loading states
  const [loadingFilterOptions, setLoadingFilterOptions] = useState<boolean>(false);
  
  // Dropdown visibility states
  const [showYearDropdown, setShowYearDropdown] = useState<boolean>(false);
  const [showProgrammeDropdown, setShowProgrammeDropdown] = useState<boolean>(false);
  const [showTermDropdown, setShowTermDropdown] = useState<boolean>(false);
  const [showSemesterDropdown, setShowSemesterDropdown] = useState<boolean>(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState<boolean>(false);

  // Add state for filter expansion
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(true);

  // Load initial filter options from API
  const loadInitialFilterOptions = async () => {
    try {
      // Load all options without any filters first
      const [yearsRes, programmesRes, termsRes, semestersRes, branchesRes] = await Promise.all([
        fetch(`${PAPERS_API_BASE}/filter-options?level=year`),
        fetch(`${PAPERS_API_BASE}/filter-options?level=programme`),
        fetch(`${PAPERS_API_BASE}/filter-options?level=term`),
        fetch(`${PAPERS_API_BASE}/filter-options?level=semester`),
        fetch(`${PAPERS_API_BASE}/filter-options?level=branch`),
      ]);

      const [yearsData, programmesData, termsData, semestersData, branchesData] = await Promise.all([
        yearsRes.ok ? yearsRes.json() : { options: [] },
        programmesRes.ok ? programmesRes.json() : { options: [] },
        termsRes.ok ? termsRes.json() : { options: [] },
        semestersRes.ok ? semestersRes.json() : { options: [] },
        branchesRes.ok ? branchesRes.json() : { options: [] },
      ]);
      
      setYearOptions(yearsData.options || []);
      setProgrammeOptions(programmesData.options || []);
      setTermOptions(termsData.options || []);
      setSemesterOptions(semestersData.options || []);
      setBranchOptions(branchesData.options || []);
      
    } catch (error) {
      console.error('Error loading initial filter options:', error);
      // Fallback to common values if API fails
      setYearOptions(['2024', '2023', '2022', '2021', '2020']);
      setProgrammeOptions(['B.Tech', 'M.Tech', 'MBA', 'BBA']);
      setTermOptions(['End Semester', 'Mid Semester']);
      setSemesterOptions(['1', '2', '3', '4', '5', '6', '7', '8']);
      setBranchOptions(['CSE', 'ECE', 'ME', 'CE', 'IT']);
    }
  };

  // Load cascading filter options based on current selections
  const loadCascadingFilterOptions = async () => {
    try {
      setLoadingFilterOptions(true);
      
      const params = new URLSearchParams();
      
      // Build params for context - only include filters that have values
      if (selectedYear) params.set('year', selectedYear);
      if (selectedProgramme) params.set('programme', selectedProgramme);
      if (selectedTerm) params.set('term', selectedTerm);
      if (selectedSemester) params.set('semester', selectedSemester);
      if (selectedBranch) params.set('branch', selectedBranch);

      // Fetch options for each level with current context
      const optionsPromises = [];
      
      // Always fetch year options (no dependencies)
      optionsPromises.push(
        fetch(`${PAPERS_API_BASE}/filter-options?level=year`)
          .then(res => res.ok ? res.json() : { options: [] })
          .then(data => ({ level: 'year', options: data.options || [] }))
      );

      // Programme options depend on year
      const programmeParams = new URLSearchParams();
      if (selectedYear) programmeParams.set('year', selectedYear);
      programmeParams.set('level', 'programme');
      
      optionsPromises.push(
        fetch(`${PAPERS_API_BASE}/filter-options?${programmeParams.toString()}`)
          .then(res => res.ok ? res.json() : { options: [] })
          .then(data => ({ level: 'programme', options: data.options || [] }))
      );

      // Term options depend on year and programme
      const termParams = new URLSearchParams();
      if (selectedYear) termParams.set('year', selectedYear);
      if (selectedProgramme) termParams.set('programme', selectedProgramme);
      termParams.set('level', 'term');
      
      optionsPromises.push(
        fetch(`${PAPERS_API_BASE}/filter-options?${termParams.toString()}`)
          .then(res => res.ok ? res.json() : { options: [] })
          .then(data => ({ level: 'term', options: data.options || [] }))
      );

      // Semester options depend on year, programme, and term
      const semesterParams = new URLSearchParams();
      if (selectedYear) semesterParams.set('year', selectedYear);
      if (selectedProgramme) semesterParams.set('programme', selectedProgramme);
      if (selectedTerm) semesterParams.set('term', selectedTerm);
      semesterParams.set('level', 'semester');
      
      optionsPromises.push(
        fetch(`${PAPERS_API_BASE}/filter-options?${semesterParams.toString()}`)
          .then(res => res.ok ? res.json() : { options: [] })
          .then(data => ({ level: 'semester', options: data.options || [] }))
      );

      // Branch options depend on all previous selections
      const branchParams = new URLSearchParams();
      if (selectedYear) branchParams.set('year', selectedYear);
      if (selectedProgramme) branchParams.set('programme', selectedProgramme);
      if (selectedTerm) branchParams.set('term', selectedTerm);
      if (selectedSemester) branchParams.set('semester', selectedSemester);
      branchParams.set('level', 'branch');
      
      optionsPromises.push(
        fetch(`${PAPERS_API_BASE}/filter-options?${branchParams.toString()}`)
          .then(res => res.ok ? res.json() : { options: [] })
          .then(data => ({ level: 'branch', options: data.options || [] }))
      );

      const results = await Promise.all(optionsPromises);
      
      // Update state with new options
      results.forEach(result => {
        switch (result.level) {
          case 'year':
            setYearOptions(result.options);
            break;
          case 'programme':
            setProgrammeOptions(result.options);
            break;
          case 'term':
            setTermOptions(result.options);
            break;
          case 'semester':
            setSemesterOptions(result.options);
            break;
          case 'branch':
            setBranchOptions(result.options);
            break;
        }
      });
      
    } catch (error) {
      console.error('Error loading cascading filter options:', error);
      // Keep existing options on error
    } finally {
      setLoadingFilterOptions(false);
    }
  };

  // Load papers from Papers Please API
  const loadPapers = async (page: number = 1) => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '24', // Match the API default
      });
      
      // Add search query if present
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      
      // Add filters if selected
      if (selectedYear) params.set('year', selectedYear);
      if (selectedProgramme) params.set('programme', selectedProgramme);
      if (selectedTerm) params.set('term', selectedTerm);
      if (selectedSemester) params.set('semester', selectedSemester);
      if (selectedBranch) params.set('branch', selectedBranch);
      
      const response = await fetch(`${PAPERS_API_BASE}/papers?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: APIResponse = await response.json();
      
      setPapers(data.results);
      setCurrentPage(data.page);
      setTotalPages(data.totalPages);
      setTotalPapers(data.total);
      
    } catch (error) {
      console.error('Error loading papers:', error);
      Alert.alert('Error', 'Failed to load papers. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open paper URL
  const openPaper = async (paper: PaperFromAPI) => {
    try {
      const canOpen = await Linking.canOpenURL(paper.url);
      if (canOpen) {
        await Linking.openURL(paper.url);
      } else {
        Alert.alert('Error', 'Cannot open this link. Please check the URL.');
      }
    } catch (error) {
      console.error('Error opening paper:', error);
      Alert.alert('Error', 'Failed to open paper. Please try again.');
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedYear('');
    setSelectedProgramme('');
    setSelectedTerm('');
    setSelectedSemester('');
    setSelectedBranch('');
    setCurrentPage(1);
    closeAllDropdowns();
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowYearDropdown(false);
    setShowProgrammeDropdown(false);
    setShowTermDropdown(false);
    setShowSemesterDropdown(false);
    setShowBranchDropdown(false);
  };

  // Function to handle expand/minimize
  const handleToggleFilters = () => {
    setFiltersExpanded((prev) => !prev);
  };

  // When last filter (branch) is selected, minimize filters
  useEffect(() => {
    if (selectedBranch) {
      setFiltersExpanded(false);
    }
  }, [selectedBranch]);

  // Handle filter selection with cascading behavior
  const handleFilterSelect = (filterType: string, value: string) => {
    // Close all dropdowns first
    closeAllDropdowns();
    
    // Clear dependent filters when a parent filter changes
    switch (filterType) {
      case 'year':
        setSelectedYear(value);
        // Clear all dependent filters
        setSelectedProgramme('');
        setSelectedTerm('');
        setSelectedSemester('');
        setSelectedBranch('');
        break;
      case 'programme':
        setSelectedProgramme(value);
        // Clear dependent filters
        setSelectedTerm('');
        setSelectedSemester('');
        setSelectedBranch('');
        break;
      case 'term':
        setSelectedTerm(value);
        // Clear dependent filters
        setSelectedSemester('');
        setSelectedBranch('');
        break;
      case 'semester':
        setSelectedSemester(value);
        // Clear dependent filters
        setSelectedBranch('');
        break;
      case 'branch':
        setSelectedBranch(value);
        break;
    }
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  // Initialize data
  useEffect(() => {
    loadInitialFilterOptions();
    loadPapers(1);
  }, []);


  useEffect(() => {

  }, [yearOptions, programmeOptions, termOptions, semesterOptions, branchOptions]);

  // Update filter options when any filter changes (cascading effect)
  useEffect(() => {
    if (yearOptions.length > 0) { // Only run cascading after initial load
      loadCascadingFilterOptions();
    }
  }, [selectedYear, selectedProgramme, selectedTerm, selectedSemester]);

  // Reload papers when search or filters change
  useEffect(() => {
    loadPapers(1);
  }, [searchQuery, selectedYear, selectedProgramme, selectedTerm, selectedSemester, selectedBranch]);

  // Reload papers when page changes
  useEffect(() => {
    if (currentPage > 1) {
      loadPapers(currentPage);
    }
  }, [currentPage]);

  const renderPaperCard = (paper: PaperFromAPI) => (
    <View key={paper.id} style={styles.paperCard}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFF']}
        style={styles.paperGradient}
      >
        <View style={styles.paperHeader}>
          <View style={styles.paperIconContainer}>
            <Ionicons name="document-text" size={24} color="#4E54C8" />
          </View>
          <View style={styles.paperInfo}>
            <Text style={styles.paperTitle}>{paper.name}</Text>
            <Text style={styles.paperSubject}>
              {paper.path.join(' › ')}
            </Text>
          </View>
        </View>

        <View style={styles.paperDetails}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Year</Text>
              <Text style={styles.detailValue}>{paper.year}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Term</Text>
              <Text style={styles.detailValue}>{paper.term}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Programme</Text>
              <Text style={styles.detailValue}>{paper.programme || 'N/A'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Semester</Text>
              <Text style={styles.detailValue}>{paper.semester || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Branch</Text>
              <Text style={styles.detailValue}>{paper.branch || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.paperFooter}>
          <View style={styles.downloadInfo}>
            <Ionicons name="document-outline" size={16} color="#8E8E93" />
            <Text style={styles.downloadCount}>Papers Please</Text>
          </View>
          
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => openPaper(paper)}
          >
            <LinearGradient
              colors={['#4E54C8', '#6366F1']}
              style={styles.downloadButtonGradient}
            >
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>View</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
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
            <Ionicons name="arrow-back" size={24} color="#4E54C8" />
          </TouchableOpacity>
          
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="document-text" size={28} color="#4E54C8" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Previous Year Papers</Text>
              <Text style={styles.headerSubtitle}>
                {totalPapers} papers available
              </Text>
            </View>
          </View>
        </View>

        {/* Search and Filters Section */}
        <View style={styles.searchAndFiltersContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or subject..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* Vertical Filters */}
          <View style={styles.filtersContainer}>
            <TouchableOpacity
              style={styles.expandMinimizeButton}
              onPress={handleToggleFilters}
            >
              <Ionicons name={filtersExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#4E54C8" />
              <Text style={styles.expandMinimizeText}>{filtersExpanded ? 'Minimize Filters' : 'Expand Filters'}</Text>
            </TouchableOpacity>
            {filtersExpanded && (
              <>
                {/* Year Filter */}
                <View style={styles.filterItem}>
                  <Text style={styles.filterLabel}>Year</Text>
                  <TouchableOpacity
                    style={[
                      styles.filterSelectButton,
                      selectedYear && styles.filterButtonActive
                    ]}
                    onPress={() => {
                      if (!loadingFilterOptions) {
                        closeAllDropdowns();
                        setShowYearDropdown(!showYearDropdown);
                      }
                    }}
                    disabled={loadingFilterOptions}
                  >
                    <Text style={[
                      styles.filterSelectText,
                      selectedYear && styles.filterButtonTextActive
                    ]}>
                      {selectedYear || 'Select Year'}
                    </Text>
                    {loadingFilterOptions ? (
                      <ActivityIndicator size="small" color="#8E8E93" />
                    ) : (
                      <Ionicons 
                        name={showYearDropdown ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#8E8E93" 
                      />
                    )}
                  </TouchableOpacity>
                  {showYearDropdown && (
                    <View style={styles.dropdownPanel}>
                      <ScrollView style={styles.dropdownScroll}>
                        {yearOptions.map((year) => (
                          <TouchableOpacity
                            key={year}
                            style={[
                              styles.dropdownItem,
                              selectedYear === year && styles.dropdownItemSelected
                            ]}
                            onPress={() => handleFilterSelect('year', year)}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              selectedYear === year && styles.dropdownItemTextSelected
                            ]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Programme Filter */}
                <View style={styles.filterItem}>
                  <Text style={styles.filterLabel}>Programme</Text>
                  <TouchableOpacity
                    style={[
                      styles.filterSelectButton,
                      selectedProgramme && styles.filterButtonActive,
                      !selectedYear && styles.filterButtonDisabled
                    ]}
                    onPress={() => {
                      if (selectedYear && !loadingFilterOptions) {
                        closeAllDropdowns();
                        setShowProgrammeDropdown(!showProgrammeDropdown);
                      }
                    }}
                    disabled={!selectedYear || loadingFilterOptions}
                  >
                    <Text style={[
                      styles.filterSelectText,
                      selectedProgramme && styles.filterButtonTextActive
                    ]}>
                      {selectedProgramme || 'Select Programme'}
                    </Text>
                    {loadingFilterOptions ? (
                      <ActivityIndicator size="small" color="#8E8E93" />
                    ) : (
                      <Ionicons 
                        name={showProgrammeDropdown ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#8E8E93" 
                      />
                    )}
                  </TouchableOpacity>
                  {showProgrammeDropdown && (
                    <View style={styles.dropdownPanel}>
                      <ScrollView style={styles.dropdownScroll}>
                        {programmeOptions.map((programme) => (
                          <TouchableOpacity
                            key={programme}
                            style={[
                              styles.dropdownItem,
                              selectedProgramme === programme && styles.dropdownItemSelected
                            ]}
                            onPress={() => handleFilterSelect('programme', programme)}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              selectedProgramme === programme && styles.dropdownItemTextSelected
                            ]}>
                              {programme}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Term Filter */}
                <View style={styles.filterItem}>
                  <Text style={styles.filterLabel}>Term</Text>
                  <TouchableOpacity
                    style={[
                      styles.filterSelectButton,
                      selectedTerm && styles.filterButtonActive,
                      (!selectedYear || !selectedProgramme) && styles.filterButtonDisabled
                    ]}
                    onPress={() => {
                      if (selectedYear && selectedProgramme && !loadingFilterOptions) {
                        closeAllDropdowns();
                        setShowTermDropdown(!showTermDropdown);
                      }
                    }}
                    disabled={!selectedYear || !selectedProgramme || loadingFilterOptions}
                  >
                    <Text style={[
                      styles.filterSelectText,
                      selectedTerm && styles.filterButtonTextActive
                    ]}>
                      {selectedTerm || 'Select Term'}
                    </Text>
                    {loadingFilterOptions ? (
                      <ActivityIndicator size="small" color="#8E8E93" />
                    ) : (
                      <Ionicons 
                        name={showTermDropdown ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#8E8E93" 
                      />
                    )}
                  </TouchableOpacity>
                  {showTermDropdown && (
                    <View style={styles.dropdownPanel}>
                      <ScrollView style={styles.dropdownScroll}>
                        {termOptions.map((term) => (
                          <TouchableOpacity
                            key={term}
                            style={[
                              styles.dropdownItem,
                              selectedTerm === term && styles.dropdownItemSelected
                            ]}
                            onPress={() => handleFilterSelect('term', term)}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              selectedTerm === term && styles.dropdownItemTextSelected
                            ]}>
                              {term}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Semester Filter */}
                <View style={styles.filterItem}>
                  <Text style={styles.filterLabel}>Semester</Text>
                  <TouchableOpacity
                    style={[
                      styles.filterSelectButton,
                      selectedSemester && styles.filterButtonActive,
                      (!selectedYear || !selectedProgramme || !selectedTerm) && styles.filterButtonDisabled
                    ]}
                    onPress={() => {
                      if (selectedYear && selectedProgramme && selectedTerm && !loadingFilterOptions) {
                        closeAllDropdowns();
                        setShowSemesterDropdown(!showSemesterDropdown);
                      }
                    }}
                    disabled={!selectedYear || !selectedProgramme || !selectedTerm || loadingFilterOptions}
                  >
                    <Text style={[
                      styles.filterSelectText,
                      selectedSemester && styles.filterButtonTextActive
                    ]}>
                      {selectedSemester || 'Select Semester'}
                    </Text>
                    {loadingFilterOptions ? (
                      <ActivityIndicator size="small" color="#8E8E93" />
                    ) : (
                      <Ionicons 
                        name={showSemesterDropdown ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#8E8E93" 
                      />
                    )}
                  </TouchableOpacity>
                  {showSemesterDropdown && (
                    <View style={styles.dropdownPanel}>
                      <ScrollView style={styles.dropdownScroll}>
                        {semesterOptions.map((semester) => (
                          <TouchableOpacity
                            key={semester}
                            style={[
                              styles.dropdownItem,
                              selectedSemester === semester && styles.dropdownItemSelected
                            ]}
                            onPress={() => handleFilterSelect('semester', semester)}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              selectedSemester === semester && styles.dropdownItemTextSelected
                            ]}>
                              {semester}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Branch Filter (last) */}
                <View style={styles.filterItem}>
                  <Text style={styles.filterLabel}>Branch</Text>
                  <TouchableOpacity
                    style={[
                      styles.filterSelectButton,
                      selectedBranch && styles.filterButtonActive,
                      (!selectedYear || !selectedProgramme || !selectedTerm || !selectedSemester) && styles.filterButtonDisabled
                    ]}
                    onPress={() => {
                      if (selectedYear && selectedProgramme && selectedTerm && selectedSemester && !loadingFilterOptions) {
                        closeAllDropdowns();
                        setShowBranchDropdown(!showBranchDropdown);
                      }
                    }}
                    disabled={!selectedYear || !selectedProgramme || !selectedTerm || !selectedSemester || loadingFilterOptions}
                  >
                    <Text style={[
                      styles.filterSelectText,
                      selectedBranch && styles.filterButtonTextActive
                    ]}>
                      {selectedBranch || 'Select Branch'}
                    </Text>
                    {loadingFilterOptions ? (
                      <ActivityIndicator size="small" color="#8E8E93" />
                    ) : (
                      <Ionicons 
                        name={showBranchDropdown ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#8E8E93" 
                      />
                    )}
                  </TouchableOpacity>
                  {showBranchDropdown && (
                    <View style={styles.dropdownPanel}>
                      <ScrollView style={styles.dropdownScroll}>
                        {branchOptions.map((branch) => (
                          <TouchableOpacity
                            key={branch}
                            style={[
                              styles.dropdownItem,
                              selectedBranch === branch && styles.dropdownItemSelected
                            ]}
                            onPress={() => handleFilterSelect('branch', branch)}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              selectedBranch === branch && styles.dropdownItemTextSelected
                            ]}>
                              {branch}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Clear Filters Button */}
                {(selectedYear || selectedProgramme || selectedTerm || selectedSemester || selectedBranch) && (
                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={clearFilters}
                  >
                    <Ionicons name="close-circle" size={20} color="#4E54C8" />
                    <Text style={styles.clearFiltersText}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* Papers List */}
        <ScrollView 
          style={styles.papersContainer}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4E54C8" />
              <Text style={styles.loadingText}>Loading papers...</Text>
            </View>
          ) : papers.length > 0 ? (
            <View style={styles.papersGrid}>
              {papers.map(renderPaperCard)}
            </View>
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="document-text-outline" size={48} color="#8E8E93" />
              <Text style={styles.noResultsText}>No papers found</Text>
              <Text style={styles.noResultsSubtext}>Try adjusting your filters or search query</Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      {/* 
        Data Source: Papers Please (https://papers-please-jade.vercel.app/)
        GitHub Repository: https://github.com/jeevithg090/NA
        
        This app fetches papers directly from the Papers Please API, which contains
        question papers organized by year, programme, term, semester, and branch.
        
        No Firebase setup required - all data comes from the external API.
        Papers are hosted externally and opened in browser.
      */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  searchAndFiltersContainer: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterItem: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  filterSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterButtonActive: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  filterButtonDisabled: {
    opacity: 0.5,
  },
  filterSelectText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  dropdownPanel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 4,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  dropdownItemSelected: {
    backgroundColor: '#F0F2FF',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  dropdownItemTextSelected: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 16,
    color: '#4E54C8',
    marginLeft: 8,
    fontWeight: '500',
  },
  papersContainer: {
    flex: 1,
    padding: 16,
  },
  papersGrid: {
    flexDirection: 'column',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noResultsText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  noResultsSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  paperCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paperGradient: {
    borderRadius: 12,
    padding: 16,
  },
  paperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paperIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paperInfo: {
    flex: 1,
  },
  paperTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  paperSubject: {
    fontSize: 14,
    color: '#8E8E93',
  },
  paperDetails: {
    marginTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  paperFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  downloadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadCount: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  downloadButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  downloadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  downloadButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expandMinimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Move to right
    alignSelf: 'flex-end',      // Move to right
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20, // Make it round
    borderWidth: 1,
    borderColor: '#4E54C8',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  expandMinimizeText: {
    fontSize: 16,
    color: '#4E54C8',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default PreviousYearPapers;
