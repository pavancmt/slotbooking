import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, DollarSign, User, X, CheckCircle, Edit, RefreshCw, LogIn } from 'lucide-react';
import QRCode from 'qrcode';

// Centralized localStorage functions with timestamp
const saveToLocalStorage = (key, data) => {
  try {
    const dataWithTimestamp = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

const loadFromLocalStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const { data, timestamp } = JSON.parse(stored);
    // Simulate server sync: only return data if timestamp is recent (within 5 minutes)
    if (Date.now() - timestamp < 5 * 60 * 1000) {
      return data;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Pricing calculation function
const calculatePrice = (members, duration, bookingCount, promoDiscount) => {
  let basePricePerHour = members === 6 ? 250 : 400;
  let totalPrice;

  if (duration === 1) {
    totalPrice = basePricePerHour;
  } else if (duration === 3) {
    totalPrice = basePricePerHour * 3;
  } else if (duration === 6) {
    totalPrice = (basePricePerHour * 6) * 0.9;
  } else if (duration === 12) {
    totalPrice = (basePricePerHour * 12) * 0.85;
  }

  let finalPrice = totalPrice * (1 - promoDiscount / 100);
  let loyaltyDiscount = 0;
  if (bookingCount >= 5) {
    loyaltyDiscount = 2;
    finalPrice = finalPrice * (1 - loyaltyDiscount / 100);
  }

  return {
    basePricePerHour,
    totalPrice: Math.round(totalPrice),
    finalPrice: Math.round(finalPrice),
    discount: duration === 6 ? '10%' : duration === 12 ? '15%' : '0%',
    loyaltyDiscount,
  };
};

// Time formatting functions
const format12HourTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes}:${seconds} ${ampm}`;
};

const convertSlotTimeTo12Hour = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const adjustedHour = hour % 12 || 12;
  return `${adjustedHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
};

// Generate initial slots (5 AM to 11:59 PM, current and next 6 days)
const generateInitialSlots = () => {
  const slots = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start at midnight

  for (let day = 0; day < 7; day++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + day);
    const dateString = currentDate.toISOString().split('T')[0];

    // Slots from 5 AM to 11 PM (23:00)
    for (let hour = 5; hour < 24; hour++) {
      const startTime = `${hour}:00`;
      const endTime = `${(hour + 1) % 24}:00`;

      slots.push({
        id: `${dateString}-${hour}`,
        date: dateString,
        startTime,
        endTime,
        isBooked: false,
        bookingName: null,
        isHoliday: false,
        holidayTitle: null,
        members: null,
        duration: 1,
        mobileNumber: null,
        isDayBlocked: false,
        dayBlockTitle: null,
      });
    }
  }

  return slots;
};

// Load slots with sync simulation
const loadSlotsFromStorage = () => {
  return loadFromLocalStorage('bookingSlots', generateInitialSlots());
};

// Generate transaction number
const generateTransactionNumber = () => {
  return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default function SlotBookingSystem() {
  const [slots, setSlots] = useState(loadSlotsFromStorage());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [userName, setUserName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [bookingCount, setBookingCount] = useState(0);
  const [members, setMembers] = useState(6);
  const [duration, setDuration] = useState(1);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [filter, setFilter] = useState('available');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showTVDisplay, setShowTVDisplay] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [promoCodes, setPromoCodes] = useState(loadFromLocalStorage('promoCodes', [
    { code: 'CRICKET10', discount: 10 },
    { code: 'BUBBY20', discount: 20 },
  ]));
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [keySequence, setKeySequence] = useState('');
  const [undoHistory, setUndoHistory] = useState([]);
  const [bookingHistory, setBookingHistory] = useState(loadFromLocalStorage('bookingHistory', []));
  const [showBookingHistory, setShowBookingHistory] = useState(false);
  const [showDayBlockModal, setShowDayBlockModal] = useState(false);
  const [dayBlockDate, setDayBlockDate] = useState('');
  const [dayBlockTitle, setDayBlockTitle] = useState('');
  const [showDurationAlert, setShowDurationAlert] = useState(false);
  const [maxDuration, setMaxDuration] = useState(1);

  const mobileNumberInputRef = useRef(null);

  // Save to localStorage
  useEffect(() => {
    saveToLocalStorage('bookingSlots', slots);
    saveToLocalStorage('promoCodes', promoCodes);
    saveToLocalStorage('bookingHistory', bookingHistory);
  }, [slots, promoCodes, bookingHistory]);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Key sequence for TV display
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!document.activeElement.tagName.toLowerCase().match(/input|textarea/)) {
        const newSequence = (keySequence + e.key).slice(-3);
        setKeySequence(newSequence);
        if (newSequence === '425') {
          setShowTVDisplay((prev) => !prev);
          setKeySequence('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keySequence]);

  // Auto-focus mobile number input after slot selection
  useEffect(() => {
    if (selectedSlot && mobileNumberInputRef.current) {
      mobileNumberInputRef.current.focus();
    }
  }, [selectedSlot]);

  // Mobile number change
  const handleMobileNumberChange = (e) => {
    const number = e.target.value.replace(/\D/g, '');
    setMobileNumber(number);

    if (number.length === 10) {
      const userData = loadFromLocalStorage(`user_${number}`, { name: '', bookings: 0 });
      if (userData.name) {
        setUserName(userData.name);
        setWelcomeMessage(`Welcome back, ${userData.name}!`);
        setBookingCount(userData.bookings);
      } else {
        setUserName('');
        setWelcomeMessage('');
        setBookingCount(0);
      }
    } else {
      setWelcomeMessage('');
      setBookingCount(0);
    }
  };

  // Filter slots based on current time and date
  const filteredSlots = slots.filter(slot => {
    const dateMatch = slot.date === selectedDate;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const slotHour = parseInt(slot.startTime.split(':')[0]);
    const isToday = slot.date === now.toISOString().split('T')[0];

    // Block slots before current time + 10 minutes
    const cutoffHour = currentMinute >= 10 ? currentHour + 1 : currentHour;
    const isAfterCutoff = !isToday || slotHour >= cutoffHour;

    if (filter === 'all') return dateMatch && isAfterCutoff;
    if (filter === 'available') return dateMatch && isAfterCutoff && !slot.isBooked && !slot.isHoliday && !slot.isDayBlocked;
    if (filter === 'booked') return dateMatch && isAfterCutoff && slot.isBooked;
    return dateMatch && isAfterCutoff;
  });

  // Group booked slots
  const groupedSlots = [];
  const seenIds = new Set();
  filteredSlots.forEach(slot => {
    if (slot.isBooked && !seenIds.has(slot.id) && slot.startTime === slot.startTime) {
      const slotIndex = slots.findIndex(s => s.id === slot.id);
      const duration = slot.duration || 1;
      for (let i = 0; i < duration; i++) {
        seenIds.add(slots[slotIndex + i]?.id);
      }
      groupedSlots.push({ ...slot, duration });
    } else if (!slot.isBooked && !seenIds.has(slot.id)) {
      groupedSlots.push(slot);
    }
  });

  // Get valid dates (today and future)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [...new Set(slots.map(slot => slot.date))]
    .filter(date => new Date(date) >= today)
    .sort();

  // Slot selection with duration restriction
  const handleSlotSelect = (slot) => {
    if (slot.isHoliday || slot.isDayBlocked || (slot.isBooked && !isAdminMode)) return;

    const slotHour = parseInt(slot.startTime.split(':')[0]);
    const maxHours = slotHour >= 23 ? 1 : 24 - slotHour; // Max hours until midnight
    if (duration > maxHours) {
      setMaxDuration(maxHours);
      setShowDurationAlert(true);
      setDuration(maxHours);
      return;
    }

    const slotIndex = slots.findIndex(s => s.id === slot.id);
    let canBook = true;
    for (let i = 1; i < duration; i++) {
      const nextSlot = slots[slotIndex + i];
      if (!nextSlot || nextSlot.date !== slot.date || nextSlot.isBooked || nextSlot.isHoliday || nextSlot.isDayBlocked) {
        canBook = false;
        break;
      }
    }

    if (!canBook) {
      alert(`Cannot book for ${duration} hours. Some slots are unavailable.`);
      return;
    }

    setSelectedSlot(slot);
    setShowPayment(false);
    setPaymentComplete(false);
    setPromoCode('');
    setPromoDiscount(0);
  };

  // Promo code application
  const applyPromoCode = () => {
    const foundPromo = promoCodes.find(p => p.code === promoCode);
    if (foundPromo) {
      setPromoDiscount(foundPromo.discount);
      alert(`Promo code applied! ${foundPromo.discount}% discount.`);
    } else {
      setPromoDiscount(0);
      alert('Invalid promo code.');
    }
  };

  // Booking
  const handleBooking = () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!mobileNumber || mobileNumber.length !== 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    setShowPayment(true);
  };

  // Payment QR code
  const handlePayment = async () => {
    const priceInfo = calculatePrice(members, duration, bookingCount, promoDiscount);
    const upiString = `upi://pay?pa=9133550086@upi&pn=Buddy%20Box&am=${priceInfo.finalPrice}&cu=INR&tn=Slot%20Booking`;

    try {
      const qrUrl = await QRCode.toDataURL(upiString);
      setQrCodeUrl(qrUrl);
      setShowQR(true);
    } catch (err) {
      console.error('Error generating QR code:', err);
      alert('Failed to generate QR code.');
    }
  };

  // Simulate payment with sync
  const simulatePaymentCompletion = () => {
    setShowQR(false);
    setPaymentComplete(true);

    const userData = loadFromLocalStorage(`user_${mobileNumber}`, { name: '', bookings: 0 });
    userData.name = userName;
    userData.bookings = (userData.bookings || 0) + 1;
    saveToLocalStorage(`user_${mobileNumber}`, userData);
    setBookingCount(userData.bookings);

    const transactionNumber = generateTransactionNumber();
    const bookingDetails = {
      transactionNumber,
      userName,
      mobileNumber,
      date: selectedSlot.date,
      startTime: selectedSlot.startTime,
      duration,
      members,
      bookingTime: new Date().toISOString(),
      price: calculatePrice(members, duration, userData.bookings, promoDiscount).finalPrice,
    };
    setBookingHistory([...bookingHistory, bookingDetails]);

    setTimeout(() => {
      // Reload slots to simulate sync
      const currentStored = loadFromLocalStorage('bookingSlots', generateInitialSlots());
      const slotIndex = currentStored.findIndex(s => s.id === selectedSlot.id);
      if (slotIndex === -1 || currentStored[slotIndex].isBooked) {
        alert('Slot was booked by another user. Please select another slot.');
        setSlots(currentStored);
        setSelectedSlot(null);
        return;
      }

      const updatedSlots = [...currentStored];
      for (let i = 0; i < duration; i++) {
        const currentSlot = updatedSlots[slotIndex + i];
        updatedSlots[slotIndex + i] = {
          ...currentSlot,
          isBooked: true,
          bookingName: userName,
          members,
          duration,
          mobileNumber,
        };
      }
      setSlots(updatedSlots);
      setSelectedSlot(null);
      setUserName('');
      setMobileNumber('');
      setWelcomeMessage('');
      setBookingCount(userData.bookings);
      setMembers(6);
      setDuration(1);
      setPromoCode('');
      setPromoDiscount(0);
      setShowPayment(false);
      setPaymentComplete(false);
      setQrCodeUrl('');
    }, 2000);
  };

  // Mark holiday
  const handleMarkHoliday = (slot) => {
    const customTitle = slot.isHoliday
      ? null
      : prompt('Enter holiday title (e.g., Tournament):', 'Holiday') || 'Holiday';

    setUndoHistory([...undoHistory, { ...slot }]);

    setSlots(slots.map(s =>
      s.id === slot.id
        ? {
            ...s,
            isHoliday: !s.isHoliday,
            holidayTitle: s.isHoliday ? null : customTitle,
            isBooked: false,
            bookingName: null,
            members: null,
            duration: 1,
            mobileNumber: null,
          }
        : s
    ));
  };

  // Mark day block
  const handleMarkDayBlock = () => {
    if (!dayBlockDate || !dayBlockTitle) {
      alert('Please select a date and enter a title.');
      return;
    }

    const slotsToUpdate = slots.filter(s => s.date === dayBlockDate);
    setUndoHistory([...undoHistory, ...slotsToUpdate]);

    setSlots(slots.map(s =>
      s.date === dayBlockDate
        ? {
            ...s,
            isDayBlocked: true,
            dayBlockTitle: dayBlockTitle,
            isBooked: false,
            bookingName: null,
            members: null,
            duration: 1,
            mobileNumber: null,
            isHoliday: false,
            holidayTitle: null,
          }
        : s
    ));
    setShowDayBlockModal(false);
    setDayBlockDate('');
    setDayBlockTitle('');
  };

  // Undo
  const handleUndo = () => {
    if (undoHistory.length === 0) {
      alert('No actions to undo.');
      return;
    }
    const lastAction = undoHistory[undoHistory.length - 1];
    setSlots(slots.map(s => (s.id === lastAction.id ? { ...lastAction } : s)));
    setUndoHistory(undoHistory.slice(0, -1));
  };

  // Cancel booking
  const handleCancelBooking = (slot) => {
    setUndoHistory([...undoHistory, { ...slot }]);
    const slotIndex = slots.findIndex(s => s.id === slot.id);
    const updatedSlots = [...slots];
    const slotDuration = slot.duration || 1;
    for (let i = 0; i < slotDuration; i++) {
      const currentSlot = updatedSlots[slotIndex + i];
      updatedSlots[slotIndex + i] = {
        ...currentSlot,
        isBooked: false,
        bookingName: null,
        members: null,
        duration: 1,
        mobileNumber: null,
      };
    }
    setSlots(updatedSlots);
  };

  // Promo code management
  const addPromoCode = () => {
    if (!newPromoCode || !newPromoDiscount || isNaN(newPromoDiscount) || newPromoDiscount <= 0) {
      alert('Please enter a valid promo code and discount percentage.');
      return;
    }

    if (!editingPromo && promoCodes.some(promo => promo.code === newPromoCode)) {
      alert('Promo code already exists.');
      return;
    }

    if (editingPromo) {
      setPromoCodes(promoCodes.map((promo) =>
        promo.code === editingPromo.code ? { code: newPromoCode, discount: parseInt(newPromoDiscount) } : promo
      ));
      setEditingPromo(null);
      alert('Promo code updated successfully!');
    } else {
      setPromoCodes([...promoCodes, { code: newPromoCode, discount: parseInt(newPromoDiscount) }]);
      alert('Promo code added successfully!');
    }

    setNewPromoCode('');
    setNewPromoDiscount('');
  };

  const handleEditPromo = (promo) => {
    setEditingPromo(promo);
    setNewPromoCode(promo.code);
    setNewPromoDiscount(promo.discount);
  };

  const handleDeletePromo = (code) => {
    setPromoCodes(promoCodes.filter(promo => promo.code !== code));
    alert('Promo code deleted successfully!');
  };

  // Admin login
  const handleAdminLogin = () => {
    if (adminUsername === 'admin' && adminPassword === 'Pavan040') {
      setIsAdminMode(true);
      setShowAdminLogin(false);
      setAdminUsername('');
      setAdminPassword('');
    } else {
      alert('Invalid credentials');
    }
  };

  // Toggle TV display
  const toggleTVDisplay = () => {
    setShowTVDisplay((prev) => !prev);
  };

  // Current active slot
  const getCurrentActiveSlot = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    return slots.find(slot => {
      const slotStartHour = parseInt(slot.startTime.split(':')[0]);
      const slotEndHour = slotStartHour + (slot.duration - 1);
      return slot.date === today &&
             slot.isBooked &&
             currentHour >= slotStartHour &&
             currentHour <= slotEndHour;
    });
  };

  // Upcoming slots
  const getUpcomingSlots = (count = 4) => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const upcomingSlots = slots.filter(slot => {
      const slotStartHour = parseInt(slot.startTime.split(':')[0]);
      return ((slot.date === today && slotStartHour > currentHour) ||
              slot.date === tomorrowStr) &&
             slot.isBooked;
    });

    upcomingSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    return upcomingSlots.slice(0, count);
  };

  // Remaining time
  const getRemainingTime = (slot) => {
    if (!slot) return '';

    const now = new Date();
    const startHour = parseInt(slot.startTime.split(':')[0]);
    const endHour = startHour + slot.duration;

    const endTime = new Date();
    endTime.setHours(endHour, 0, 0);

    const diffMs = endTime - now;
    if (diffMs <= 0) return '00:00';

    const diffMins = Math.floor(diffMs / 60000);
    const mins = diffMins % 60;
    const hours = Math.floor(diffMins / 60);

    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Price breakup component
  const PriceBreakup = ({ members, duration, bookingCount, promoDiscount }) => {
    const priceInfo = calculatePrice(members, duration, bookingCount, promoDiscount);

    return (
      <div className="mb-4 text-sm sm:text-base">
        <h4 className="font-semibold mb-2">Price Breakup</h4>
        <p>Base Price (1 hr, {members} members): ₹{priceInfo.basePricePerHour}</p>
        <p>Duration: {duration} hour(s)</p>
        <p>Subtotal: ₹{duration === 1 ? priceInfo.basePricePerHour : priceInfo.basePricePerHour * duration}</p>
        {priceInfo.discount !== '0%' && <p>Duration Discount: {priceInfo.discount}</p>}
        {promoDiscount > 0 && <p>Promo Discount: {promoDiscount}%</p>}
        {priceInfo.loyaltyDiscount > 0 && <p>Loyalty Discount (5th Booking): {priceInfo.loyaltyDiscount}%</p>}
        <p className="font-bold">Total: ₹{priceInfo.finalPrice}</p>
      </div>
    );
  };

  // TV Display Mode
  if (showTVDisplay) {
    const currentActiveSlot = getCurrentActiveSlot();
    const upcomingSlots = getUpcomingSlots(4);

    return (
      <div key="tv-mode" className="flex flex-col min-h-screen bg-gray-900 text-white p-4 sm:p-8 animate-fadeIn relative">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url('https://github.com/pavancmt/Images/blob/main/Buddybox.png?raw=true')` }}
        ></div>
        <header className="mb-4 sm:mb-8 text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-yellow-400 mb-4 sm:mb-6 animate-glow">Buddy Box</h1>
          <div className="text-lg sm:text-3xl font-mono bg-gray-800 inline-block px-4 sm:px-6 py-2 sm:py-3 rounded-lg">{format12HourTime(currentTime)}</div>
        </header>

        <div className="flex flex-col sm:flex-row flex-1">
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 sm:border-r border-gray-700">
            <h2 className="text-lg sm:text-2xl mb-4 sm:mb-8">Current Session</h2>
            {currentActiveSlot ? (
              <div className="text-center animate-pulse-tv">
                <div className="text-3xl sm:text-6xl font-bold mb-4 sm:mb-6 text-green-400">{currentActiveSlot.bookingName}</div>
                <div className="text-lg sm:text-3xl mb-4">{convertSlotTimeTo12Hour(currentActiveSlot.startTime)} - {convertSlotTimeTo12Hour(`${parseInt(currentActiveSlot.startTime.split(':')[0]) + currentActiveSlot.duration}:00`)}</div>
                <div className="mt-4 sm:mt-8">
                  <span className="text-base sm:text-xl">Time Remaining:</span>
                  <div className="text-2xl sm:text-4xl font-mono mt-2 sm:mt-3 bg-gray-800 px-6 sm:px-8 py-3 sm:py-4 rounded-lg inline-block">{getRemainingTime(currentActiveSlot)}</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl sm:text-5xl text-gray-500 font-bold mb-2 sm:mb-4">Available</div>
                <div className="text-lg sm:text-2xl text-gray-400">No active session</div>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 sm:p-6">
            <h2 className="text-lg sm:text-2xl mb-4 sm:mb-6 text-center">Upcoming Sessions</h2>
            {upcomingSlots.length > 0 ? (
              <div className="space-y-4 sm:space-y-6">
                {upcomingSlots.map((slot, index) => (
                  <div key={slot.id} className={`bg-gray-800 p-3 sm:p-4 rounded-lg animate-slideIn animation-delay-${index * 100}`}>
                    <div className="flex items-center">
                      <div className="w-6 sm:w-8 h-6 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold mr-2 sm:mr-3">{index + 1}</div>
                      <div>
                        <div className="text-lg sm:text-2xl font-bold text-blue-400">{slot.bookingName}</div>
                        <div className="text-sm sm:text-gray-400 mt-1">
                          {slot.date !== new Date().toISOString().split('T')[0] ?
                            `Tomorrow ${convertSlotTimeTo12Hour(slot.startTime)} - ${convertSlotTimeTo12Hour(`${parseInt(slot.startTime.split(':')[0]) + slot.duration}:00`)}` :
                            `Today ${convertSlotTimeTo12Hour(slot.startTime)} - ${convertSlotTimeTo12Hour(`${parseInt(slot.startTime.split(':')[0]) + slot.duration}:00`)}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-lg sm:text-2xl text-gray-400 text-center mt-8 sm:mt-12">No upcoming sessions</div>
            )}
          </div>
        </div>

        <footer className="mt-4 sm:mt-6 text-center">
          <button
            onClick={toggleTVDisplay}
            className="bg-gray-800 hover:bg-gray-700 px-4 sm:px-6 py-2 sm:py-3 rounded text-sm sm:text-base min-h-[44px] transition-colors"
            aria-label="Return to booking system"
          >
            Return to Booking System
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 animate-fadeIn">
      {/* Duration Alert Popup */}
      {showDurationAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 animate-fadeIn">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-sm w-full animate-bounceIn">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-red-600">Booking Restriction</h2>
            <p className="text-sm sm:text-base mb-4">
              Buddy Box closes at midnight. Maximum booking duration at this time is {maxDuration} hour(s).
            </p>
            <button
              onClick={() => setShowDurationAlert(false)}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm sm:text-base min-h-[44px]"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Header with Logo */}
      <div className="text-center mt-2 sm:mt-4 mb-2 flex items-center justify-center px-2">
        <img src="https://github.com/pavancmt/Images/blob/main/Logo.png?raw=true" alt="Buddy Box Logo" className="w-8 sm:w-12 h-8 sm:h-12 mr-2" />
        <div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white animate-glow">Buddy Box</h1>
          <p className="text-xs sm:text-sm text-gray-300">The cricket turf</p>
        </div>
      </div>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fadeIn">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-sm w-full animate-slideIn">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Admin Login</h2>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm"
              />
            </div>
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm"
              />
            </div>
            <div className="flex space-x-2 sm:space-x-4">
              <button onClick={handleAdminLogin} className="flex-1 bg-blue-600 text-white py-2 sm:py-2 rounded hover:bg-blue-700 text-sm sm:text-base min-h-[44px]">Login</button>
              <button onClick={() => setShowAdminLogin(false)} className="flex-1 bg-gray-300 py-2 sm:py-2 rounded hover:bg-gray-400 text-sm sm:text-base min-h-[44px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Code Modal */}
      {isAdminMode && showPromoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fadeIn">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-sm w-full animate-slideIn">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Manage Promo Codes</h2>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium mb-1">{editingPromo ? 'Edit Promo Code' : 'New Promo Code'}</label>
              <input
                type="text"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value)}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm"
                placeholder="e.g., CRICKET25"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium mb-1">Discount (%)</label>
              <input
                type="number"
                value={newPromoDiscount}
                onChange={(e) => setNewPromoDiscount(e.target.value)}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm"
                placeholder="e.g., 25"
                min="0"
                max="100"
              />
            </div>
            <div className="flex space-x-2 sm:space-x-4 mb-4 sm:mb-6">
              <button onClick={addPromoCode} className="flex-1 bg-blue-600 text-white py-2 sm:py-2 rounded hover:bg-blue-700 text-sm sm:text-base min-h-[44px]">
                {editingPromo ? 'Update Promo Code' : 'Add Promo Code'}
              </button>
              <button onClick={() => setShowPromoModal(false)} className="flex-1 bg-gray-300 py-2 sm:py-2 rounded hover:bg-gray-400 text-sm sm:text-base min-h-[44px]">Close</button>
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">Available Promo Codes</h3>
            {promoCodes.length > 0 ? (
              <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                {promoCodes.map(promo => (
                  <div key={promo.code} className="flex justify-between items-center bg-gray-100 p-2 rounded text-sm">
                    <span>{promo.code} - {promo.discount}%</span>
                    <div className="flex space-x-2">
                      <button onClick={() => handleEditPromo(promo)} className="text-blue-600 hover:text-blue-800">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeletePromo(promo.code)} className="text-red-600 hover:text-red-800">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No promo codes available.</p>
            )}
          </div>
        </div>
      )}

      {/* Day Block Modal */}
      {isAdminMode && showDayBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fadeIn">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-sm w-full animate-slideIn">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Block Day</h2>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium mb-1">Select Date</label>
              <select
                value={dayBlockDate}
                onChange={(e) => setDayBlockDate(e.target.value)}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm"
              >
                <option value="">Select a date</option>
                {dates.map(date => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium mb-1">Event Title</label>
              <input
                type="text"
                value={dayBlockTitle}
                onChange={(e) => setDayBlockTitle(e.target.value)}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm"
                placeholder="e.g., Tournament"
              />
            </div>
            <div className="flex space-x-2 sm:space-x-4">
              <button onClick={handleMarkDayBlock} className="flex-1 bg-blue-600 text-white py-2 sm:py-2 rounded hover:bg-blue-700 text-sm sm:text-base min-h-[44px]">Block Day</button>
              <button onClick={() => setShowDayBlockModal(false)} className="flex-1 bg-gray-300 py-2 sm:py-2 rounded hover:bg-gray-400 text-sm sm:text-base min-h-[44px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Booking History Modal */}
      {isAdminMode && showBookingHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fadeIn">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-2xl w-full animate-slideIn">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Booking History</h2>
            <div className="max-h-96 overflow-y-auto">
              {bookingHistory.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-2 text-left">Transaction</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Mobile</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Duration</th>
                      <th className="p-2 text-left">Members</th>
                      <th className="p-2 text-left">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingHistory.map((booking, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{booking.transactionNumber}</td>
                        <td className="p-2">{booking.userName}</td>
                        <td className="p-2">{booking.mobileNumber}</td>
                        <td className="p-2">{formatDate(booking.date)}</td>
                        <td className="p-2">{convertSlotTimeTo12Hour(booking.startTime)}</td>
                        <td className="p-2">{booking.duration} hr</td>
                        <td className="p-2">{booking.members}</td>
                        <td className="p-2">₹{booking.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500">No bookings yet.</p>
              )}
            </div>
            <button
              onClick={() => setShowBookingHistory(false)}
              className="mt-4 w-full bg-gray-300 py-2 rounded hover:bg-gray-400 text-sm sm:text-base min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-blue-600 text-white p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center justify-center">
            <h1 className="text-lg sm:text-2xl font-bold mr-2 sm:mr-4 animate-pulse">Buddy Box</h1>
            <div className="text-sm sm:text-lg font-mono bg-blue-800 px-2 sm:px-4 py-1 rounded-lg text-center">{format12HourTime(currentTime)}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <button onClick={toggleTVDisplay} className="px-3 sm:px-4 py-1 sm:py-2 bg-green-500 rounded hover:bg-green-600 transition-colors animate-fadeIn text-sm sm:text-base min-h-[44px]">TV Display</button>
            <button onClick={() => isAdminMode ? setIsAdminMode(false) : setShowAdminLogin(true)} className={`px-3 sm:px-4 py-1 sm:py-2 rounded transition-colors flex items-center text-sm sm:text-base min-h-[44px] ${isAdminMode ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-800'}`}>
              <LogIn size={14} className="mr-1 sm:mr-2" />
              {isAdminMode ? 'Exit Admin Mode' : 'Admin Login'}
            </button>
            {isAdminMode && (
              <>
                <button onClick={() => setShowPromoModal(true)} className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-500 rounded hover:bg-purple-600 transition-colors text-sm sm:text-base min-h-[44px]">
                  Manage Promos
                </button>
                <button onClick={() => setShowBookingHistory(true)} className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-500 rounded hover:bg-purple-600 transition-colors text-sm sm:text-base min-h-[44px]">
                  View Booking History
                </button>
                <button onClick={() => setShowDayBlockModal(true)} className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-500 rounded hover:bg-purple-600 transition-colors text-sm sm:text-base min-h-[44px]">
                  Block Day
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
        {/* Booking Interface */}
        <div className="w-full sm:w-2/3 p-2 sm:p-4 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-base sm:text-xl font-semibold flex items-center text-white"><Calendar className="mr-2" size={16} />Select Date</h2>
            <div className="flex space-x-2 mt-2 overflow-x-auto pb-2">
              {dates.map(date => (
                <button key={date} onClick={() => setSelectedDate(date)} className={`px-3 sm:px-4 py-1 sm:py-2 rounded whitespace-nowrap text-sm sm:text-base min-h-[44px] ${selectedDate === date ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{formatDate(date)}</button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-2">
              <h2 className="text-base sm:text-xl font-semibold flex items-center text-white"><Clock className="mr-2" size={16} />Available Slots</h2>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                <button onClick={() => setFilter('all')} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded min-h-[36px] ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>All</button>
                <button onClick={() => setFilter('available')} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded min-h-[36px] ${filter === 'available' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Available</button>
                <button onClick={() => setFilter('booked')} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded min-h-[36px] ${filter === 'booked' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Booked</button>
              </div>
            </div>
            {isAdminMode && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm min-h-[36px]"
                >
                  Undo
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mt-2">
              {groupedSlots.map(slot => (
                <div
                  key={slot.id}
                  onClick={() => handleSlotSelect(slot)}
                  className={`p-3 sm:p-4 rounded-lg border cursor-pointer text-sm sm:text-base ${
                    selectedSlot?.id === slot.id
                      ? 'border-orange-400 bg-orange-100 border-2 text-gray-800'
                      : slot.isDayBlocked
                      ? 'bg-red-100 border-red-300 text-gray-800'
                      : slot.isHoliday
                      ? 'bg-red-100 border-red-300 text-gray-800'
                      : slot.isBooked
                      ? 'bg-blue-100 border-blue-300 text-gray-600'
                      : 'bg-green-100 border-green-300 hover:bg-green-200 text-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      {slot.isBooked
                        ? `${convertSlotTimeTo12Hour(slot.startTime)} - ${convertSlotTimeTo12Hour(`${(parseInt(slot.startTime.split(':')[0]) + slot.duration) % 24}:00`)}`
                        : `${convertSlotTimeTo12Hour(slot.startTime)} - ${convertSlotTimeTo12Hour(slot.endTime)}`}
                    </span>
                    {isAdminMode && (
                      <button onClick={(e) => { e.stopPropagation(); slot.isBooked ? handleCancelBooking(slot) : handleMarkHoliday(slot); }} className="text-gray-600 hover:text-red-600">
                        {slot.isBooked ? <X size={14} /> : (slot.isHoliday || slot.isDayBlocked ? <RefreshCw size={14} /> : <Edit size={14} />)}
                      </button>
                    )}
                  </div>
                  <div className="mt-1">
                    {slot.isDayBlocked ? (
                      <span className="text-red-500">{slot.dayBlockTitle || 'Event'}</span>
                    ) : slot.isHoliday ? (
                      <span className="text-red-500">{slot.holidayTitle || 'Holiday'}</span>
                    ) : slot.isBooked ? (
                      <span className="text-gray-600">Booked by {slot.bookingName} ({slot.members} members, {slot.duration} hr)</span>
                    ) : (
                      <span className="text-green-600">Available</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Booking Form and Display Board */}
        <div className="w-full sm:w-1/3 bg-gray-100 p-2 sm:p-4 flex flex-col overflow-y-auto">
          {selectedSlot ? (
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Book Slot</h3>
              <p className="mb-2 text-sm sm:text-base"><span className="font-medium">Date:</span> {formatDate(selectedSlot.date)}</p>
              <p className="mb-4 text-sm sm:text-base"><span className="font-medium">Time:</span> {convertSlotTimeTo12Hour(selectedSlot.startTime)} - {convertSlotTimeTo12Hour(`${(parseInt(selectedSlot.startTime.split(':')[0]) + duration) % 24}:00`)}</p>

              {!showPayment ? (
                <>
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-medium mb-1">Mobile Number</label>
                    <input
                      id="mobileNumberInput"
                      ref={mobileNumberInputRef}
                      type="text"
                      value={mobileNumber}
                      onChange={handleMobileNumberChange}
                      className="w-full px-2 sm:px-3 py-1 sm:py2 border rounded text-sm sm:text-base"
                      placeholder="Enter 10-digit mobile number"
                      maxLength="10"
                      pattern="\d*"
                    />
                  </div>
                  {welcomeMessage && (
                    <p className="text-green-600 mb-4 text-sm sm:text-base">{welcomeMessage}</p>
                  )}
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-medium mb-1">Your Name</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm sm:text-base"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-medium mb-1">Number of Members</label>
                    <select value={members} onChange={(e) => setMembers(parseInt(e.target.value))} className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm sm:text-base">
                      <option value={6}>6 Members</option>
                      <option value="12">12 Members</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-medium mb-1">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded text-sm sm:text-base">
                      <option value={1}>1 Hour</option>
                      {maxDuration >= 3 && <option value="3">3 Hours</option>}
                      {maxDuration >= 6 && <option value="6">6 Hours</option>}
                      {maxDuration >= 12 && <option value="12">12 Hours</option>}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-medium mb-1">Promo Code</label>
                    <div className="flex">
                      <input type="text" value={promoCode Aussid onChange={(e) => setPromoCode(e.target.value)} className="flex-1 px-2 sm:px-4 py-1 sm:py-2 border rounded-l text-sm sm:text-base" placeholder="Enter promo code" />
                      <button onClick={applyPromoCode} className="bg-blue-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-r hover:bg-blue-700 text-sm sm:text-base min-h-[44px]">Apply</button>
                    </div>
                  </div>
                  <PriceBreakup members={members} duration={duration} bookingCount={bookingCount} promoDiscount={promoDiscount} />
                  <button onClick={handleBooking} className="w-full bg-blue-600 text-white py-2 sm:py-2 rounded hover:bg-blue-700 text-sm sm:text-base min-h-[44px]">Proceed to Payment</button>
                </>
              ) : (
                <div className="text-center">
                  {showQR ? (
                    <div className="mb-4">
                      <p className="mb-2 text-sm sm:text-base">Scan this QR code to pay</p>
                      <img src={qrCodeUrl} alt="UPI QR Code" className="w-40 sm:w-48 h-40 sm:h-48 mx-auto" />
                      <p className="mt-2 sm:mt-3 text-xs sm:text-sm font-medium">UPI ID: 9133550086@upi</p>
                      <PriceBreakup members={members} duration={duration} bookingCount={bookingCount} promoDiscount={promoDiscount} />
                      <button onClick={simulatePaymentCompletion} className="mt-4 w-full bg-green-600 text-white py-2 sm:py-2 rounded hover:bg-green-600 text-sm sm:text-base min-h-[44px]">Simulate Payment Completion</button>
                    </div>
                  ) : paymentComplete ? (
                    <div className="text-center py-4">
                      <CheckCircle size={48} className="mx-auto text-green-500 mb-2" />
                      <p className="text-lg sm:text-xl font-semibold text-green-600">Payment Successful!</p>
                      <p className="mt-2 text-sm sm:text-base">Your slot has been booked.</p>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold mb-2 text-sm sm:text-base">Payment Options</h4>
                      <PriceBreakup members={members} duration={duration} bookingCount={bookingCount} promoDiscount={promoDiscount} />
                      <div className="flex space-x-2 mb-4">
                        <button onClick={handlePayment} className="flex-1 bg-blue-600 text-white py-2 sm:p-2 rounded hover:bg-blue-700 flex items-center justify-center text-sm sm:text-base min-h-[44px]">
                          <DollarSign size={16} className="mr-1 sm:mr-2" />Pay Now
                        </button>
                        <button onClick={() => setShowPayment(false)} className="flex-1 py-2 sm:py-2 rounded bg-gray-400 hover:bg-gray-500 text-sm sm:text-base min-h-[44px]">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Book a Slot</h3>
              <p className="text-gray-600 text-sm sm:text-base">Select an available slot from the left panel to book.</p>
            </div>
          )}

          {/* Display Board */}
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex-1 overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Current Bookings</h3>
            <div className="space-y-2">
              {groupedSlots
                .filter(slot => slot.isBooked)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(slot => (
                  <div key={slot.id} className="bg-blue-600 p-2 sm:p-3 rounded flex items-center text-sm sm:text-base">
                    <User size={14} className="mr-2 text-blue-400"> />
                    <div className="flex-1">
                      <p className="font-medium">{slot.bookingName}</p>
                      <p className="text-xs sm:text-sm text-blue-600">{`${convertSlotTime(slot.startTime)} - ${convertSlotTimeTo12Hour(`${(parseInt(slot.startTime.split(':')[0]) + slot.duration) % 24}:00`)} (${slot.members} members, ${slot.duration} hr)`}</p>
                    </div>
                  </div>
                ))}
              {groupedSlots.filter(slot => slot.isBooked).length === 0 && (
                <p className="text-gray-500 italic text-sm sm:text-base">No bookings for this date</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}