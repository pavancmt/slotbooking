import { useState, useEffect } from 'react';
import { Calendar, Clock, DollarSign, User, X, CheckCircle, Edit, RefreshCw, LogIn } from 'lucide-react';
import QRCode from 'qrcode';

// Pricing calculation function
const calculatePrice = (members, duration, bookingCount, promoDiscount) => {
  let basePricePerHour = members === 6 ? 250 : 400;
  let totalPrice;

  if (duration === 1) {
    totalPrice = basePricePerHour;
  } else if (duration === 3) {
    totalPrice = basePricePerHour * 3;
  } else if (duration === 6) {
    totalPrice = (basePricePerHour * 6) * 0.9; // 10% discount
  } else if (duration === 12) {
    totalPrice = (basePricePerHour * 12) * 0.85; // 15% discount
  }

  // Apply promo discount
  let finalPrice = totalPrice * (1 - promoDiscount / 100);

  // Apply 2% discount for 5th booking
  let loyaltyDiscount = 0;
  if (bookingCount >= 5) {
    loyaltyDiscount = 2; // 2% discount
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

// Function to convert 24-hour time to 12-hour format with AM/PM
const format12HourTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // If hours is 0, make it 12
  return `${hours}:${minutes}:${seconds} ${ampm}`;
};

// Function to convert slot time (e.g., "14:00") to 12-hour format
const convertSlotTimeTo12Hour = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const adjustedHour = hour % 12 || 12;
  return `${adjustedHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
};

// Mock data for slots (no automatic booking)
const generateInitialSlots = () => {
  const slots = [];
  const today = new Date();
  
  for (let day = 0; day < 7; day++) {
    const currentDate = new Date();
    currentDate.setDate(today.getDate() + day);
    const dateString = currentDate.toISOString().split('T')[0];
    
    for (let hour = 8; hour < 22; hour++) {
      const startTime = `${hour}:00`;
      const endTime = `${hour + 1}:00`;
      
      slots.push({
        id: `${dateString}-${hour}`,
        date: dateString,
        startTime,
        endTime,
        isBooked: false, // No automatic booking
        bookingName: null,
        isHoliday: false,
        members: null,
        duration: 1,
        mobileNumber: null,
      });
    }
  }
  
  return slots;
};

export default function SlotBookingSystem() {
  const [slots, setSlots] = useState(generateInitialSlots());
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
  const [promoCodes, setPromoCodes] = useState([
    { code: 'CRICKET10', discount: 10 },
    { code: 'BUBBY20', discount: 20 },
  ]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Handle mobile number input to retrieve user name and booking count
  const handleMobileNumberChange = (e) => {
    const number = e.target.value;
    setMobileNumber(number);

    if (number.length === 10) {
      const userData = JSON.parse(localStorage.getItem(`user_${number}`)) || { name: '', bookings: 0 };
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

  // Filter slots based on the selected date
  const filteredSlots = slots.filter(slot => {
    const dateMatch = slot.date === selectedDate;
    if (filter === 'all') return dateMatch;
    if (filter === 'available') return dateMatch && !slot.isBooked && !slot.isHoliday;
    if (filter === 'booked') return dateMatch && slot.isBooked;
    return dateMatch;
  });

  const dates = [...new Set(slots.map(slot => slot.date))].sort();

  // Handle slot selection with duration validation
  const handleSlotSelect = (slot) => {
    if (slot.isHoliday || (slot.isBooked && !isAdminMode)) return;

    const slotIndex = slots.findIndex(s => s.id === slot.id);
    let canBook = true;
    for (let i = 1; i < duration; i++) {
      const nextSlot = slots[slotIndex + i];
      if (!nextSlot || nextSlot.date !== slot.date || nextSlot.isBooked || nextSlot.isHoliday) {
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

  // Apply promo code
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

  // Handle booking process
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

  // Generate QR code for payment
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

  // Simulate payment completion
  const simulatePaymentCompletion = () => {
    setShowQR(false);
    setPaymentComplete(true);

    // Update localStorage with user data
    const userData = JSON.parse(localStorage.getItem(`user_${mobileNumber}`)) || { name: '', bookings: 0 };
    userData.name = userName;
    userData.bookings = (userData.bookings || 0) + 1;
    localStorage.setItem(`user_${mobileNumber}`, JSON.stringify(userData));
    setBookingCount(userData.bookings);

    setTimeout(() => {
      const slotIndex = slots.findIndex(s => s.id === selectedSlot.id);
      const updatedSlots = [...slots];
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
      setBookingCount(0);
      setMembers(6);
      setDuration(1);
      setPromoCode('');
      setPromoDiscount(0);
      setShowPayment(false);
      setPaymentComplete(false);
      setQrCodeUrl('');
    }, 2000);
  };

  // Handle marking a slot as holiday
  const handleMarkHoliday = (slot) => {
    setSlots(slots.map(s => 
      s.id === slot.id 
        ? { ...s, isHoliday: !s.isHoliday, isBooked: false, bookingName: null, members: null, duration: 1, mobileNumber: null } 
        : s
    ));
  };

  // Cancel booking
  const handleCancelBooking = (slot) => {
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

  // Add new promo code
  const addPromoCode = () => {
    if (!newPromoCode || !newPromoDiscount || isNaN(newPromoDiscount) || newPromoDiscount <= 0) {
      alert('Please enter a valid promo code and discount percentage.');
      return;
    }
    setPromoCodes([...promoCodes, { code: newPromoCode, discount: parseInt(newPromoDiscount) }]);
    setNewPromoCode('');
    setNewPromoDiscount('');
    alert('Promo code added successfully!');
  };

  // Handle admin login
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

  // Toggle TV display mode
  const toggleTVDisplay = () => {
    setShowTVDisplay(!showTVDisplay);
  };

  // Get current active slot
  const getCurrentActiveSlot = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];
    
    return slots.find(slot => {
      const slotStartHour = parseInt(slot.startTime.split(':')[0]);
      const slotEndHour = parseInt(slot.startTime.split(':')[0]) + (slot.duration - 1);
      return slot.date === today && 
             slot.isBooked && 
             currentHour >= slotStartHour && 
             currentHour <= slotEndHour;
    });
  };

  // Get next few upcoming slots
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

  // Format remaining time
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

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Price breakup component
  const PriceBreakup = ({ members, duration, bookingCount, promoDiscount }) => {
    const priceInfo = calculatePrice(members, duration, bookingCount, promoDiscount);
    
    return (
      <div className="mb-4">
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
      <div className="flex flex-col h-screen bg-gray-900 text-white p-8 animate-fadeIn">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-yellow-400 mb-6 animate-slideIn">Buddy Box</h1>
          <div className="text-3xl font-mono bg-gray-800 inline-block px-6 py-3 rounded-lg">{format12HourTime(currentTime)}</div>
        </header>
        
        <div className="flex flex-1">
          <div className="flex-1 flex flex-col items-center justify-center p-6 border-r border-gray-700">
            <h2 className="text-2xl mb-8">Current Session</h2>
            {currentActiveSlot ? (
              <div className="text-center animate-pulse-tv">
                <div className="text-6xl font-bold mb-6 text-green-400">{currentActiveSlot.bookingName}</div>
                <div className="text-3xl mb-4">{convertSlotTimeTo12Hour(currentActiveSlot.startTime)} - {convertSlotTimeTo12Hour(`${parseInt(currentActiveSlot.startTime.split(':')[0]) + currentActiveSlot.duration}:00`)}</div>
                <div className="mt-8">
                  <span className="text-xl">Time Remaining:</span>
                  <div className="text-4xl font-mono mt-3 bg-gray-800 px-8 py-4 rounded-lg inline-block">{getRemainingTime(currentActiveSlot)}</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-5xl text-gray-500 font-bold mb-4">Available</div>
                <div className="text-2xl text-gray-400">No active session</div>
              </div>
            )}
          </div>
          
          <div className="flex-1 p-6">
            <h2 className="text-2xl mb-6 text-center">Upcoming Sessions</h2>
            {upcomingSlots.length > 0 ? (
              <div className="space-y-6">
                {upcomingSlots.map((slot, index) => (
                  <div key={slot.id} className={`bg-gray-800 p-4 rounded-lg animate-slideIn animation-delay-${index * 100}`}>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold mr-3">{index + 1}</div>
                      <div>
                        <div className="text-2xl font-bold text-blue-400">{slot.bookingName}</div>
                        <div className="text-gray-400 mt-1">
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
              <div className="text-2xl text-gray-400 text-center mt-12">No upcoming sessions</div>
            )}
          </div>
        </div>
        
        <footer className="mt-6 text-center">
          <button onClick={toggleTVDisplay} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded">Return to Booking System</button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 animate-fadeIn">
      {/* Centered Title with Glowing Animation */}
      <div className="text-center mt-4 mb-2">
        <h1 className="text-4xl font-extrabold text-white animate-glow">Buddy Box</h1>
        <p className="text-sm text-gray-300">The cricket turf</p>
      </div>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fadeIn">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full animate-slideIn">
            <h2 className="text-xl font-bold mb-4">Admin Login</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex space-x-4">
              <button onClick={handleAdminLogin} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Login</button>
              <button onClick={() => setShowAdminLogin(false)} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Promo Code Management */}
      {isAdminMode && showPromoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fadeIn">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full animate-slideIn">
            <h2 className="text-xl font-bold mb-4">Manage Promo Codes</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">New Promo Code</label>
              <input
                type="text"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., CRICKET25"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Discount (%)</label>
              <input
                type="number"
                value={newPromoDiscount}
                onChange={(e) => setNewPromoDiscount(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., 25"
              />
            </div>
            <div className="flex space-x-4 mb-4">
              <button onClick={addPromoCode} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Add Promo Code</button>
              <button onClick={() => setShowPromoModal(false)} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold mr-4 animate-pulse">Buddy Box</h1>
            <div className="text-lg font-mono bg-blue-800 px-4 py-1 rounded-lg">{format12HourTime(currentTime)}</div>
          </div>
          <div className="flex space-x-4">
            <button onClick={toggleTVDisplay} className="px-4 py-2 bg-green-500 rounded hover:bg-green-600 transition-colors animate-fadeIn">TV Display</button>
            <button onClick={() => isAdminMode ? setIsAdminMode(false) : setShowAdminLogin(true)} className={`px-4 py-2 rounded transition-colors flex items-center ${isAdminMode ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-800'}`}>
              <LogIn size={16} className="mr-2" />
              {isAdminMode ? 'Exit Admin Mode' : 'Admin Login'}
            </button>
            {isAdminMode && (
              <button onClick={() => setShowPromoModal(true)} className="px-4 py-2 bg-purple-500 rounded hover:bg-purple-600 transition-colors">
                Manage Promos
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Booking Interface */}
        <div className="w-2/3 p-4 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-xl font-semibold flex items-center text-white"><Calendar className="mr-2" size={20} />Select Date</h2>
            <div className="flex space-x-2 mt-2 overflow-x-auto pb-2">
              {dates.map(date => (
                <button key={date} onClick={() => setSelectedDate(date)} className={`px-4 py-2 rounded whitespace-nowrap ${selectedDate === date ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{formatDate(date)}</button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center text-white"><Clock className="mr-2" size={20} />Available Slots</h2>
              <div className="flex space-x-2">
                <button onClick={() => setFilter('all')} className={`px-3 py-1 text-sm rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>All</button>
                <button onClick={() => setFilter('available')} className={`px-3 py-1 text-sm rounded ${filter === 'available' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Available</button>
                <button onClick={() => setFilter('booked')} className={`px-3 py-1 text-sm rounded ${filter === 'booked' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Booked</button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              {filteredSlots.map(slot => (
                <div key={slot.id} onClick={() => handleSlotSelect(slot)} className={`p-4 rounded-lg border cursor-pointer ${selectedSlot?.id === slot.id ? 'border-blue-600 border-2' : slot.isHoliday ? 'bg-red-100 border-red-300' : slot.isBooked ? 'bg-gray-100 border-gray-300' : 'bg-green-100 border-green-300 hover:bg-green-200'}`}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{`${convertSlotTimeTo12Hour(slot.startTime)} - ${convertSlotTimeTo12Hour(slot.endTime)}`}</span>
                    {isAdminMode && (
                      <button onClick={(e) => { e.stopPropagation(); slot.isBooked ? handleCancelBooking(slot) : handleMarkHoliday(slot); }} className="text-gray-500 hover:text-red-500">
                        {slot.isBooked ? <X size={16} /> : (slot.isHoliday ? <RefreshCw size={16} /> : <Edit size={16} />)}
                      </button>
                    )}
                  </div>
                  <div className="mt-1">
                    {slot.isHoliday ? (
                      <span className="text-red-500">Holiday</span>
                    ) : slot.isBooked ? (
                      <span className="text-gray-500">Booked by {slot.bookingName} ({slot.members} members, {slot.duration} hr)</span>
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
        <div className="w-1/3 bg-gray-100 p-4 flex flex-col overflow-y-auto">
          {selectedSlot ? (
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              <h3 className="text-lg font-semibold mb-2">Book Slot</h3>
              <p className="mb-2"><span className="font-medium">Date:</span> {formatDate(selectedSlot.date)}</p>
              <p className="mb-4"><span className="font-medium">Time:</span> {convertSlotTimeTo12Hour(selectedSlot.startTime)} - {convertSlotTimeTo12Hour(`${parseInt(selectedSlot.startTime.split(':')[0]) + duration}:00`)}</p>
              
              {!showPayment ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Mobile Number</label>
                    <input 
                      type="text" 
                      value={mobileNumber} 
                      onChange={handleMobileNumberChange} 
                      className="w-full px-3 py-2 border rounded" 
                      placeholder="Enter 10-digit mobile number" 
                      maxLength="10"
                      pattern="\d*"
                    />
                  </div>
                  {welcomeMessage && (
                    <p className="text-green-600 mb-4">{welcomeMessage}</p>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Your Name</label>
                    <input 
                      type="text" 
                      value={userName} 
                      onChange={(e) => setUserName(e.target.value)} 
                      className="w-full px-3 py-2 border rounded" 
                      placeholder="Enter your name" 
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Number of Members</label>
                    <select value={members} onChange={(e) => setMembers(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded">
                      <option value={6}>6 Members</option>
                      <option value={12}>12 Members</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded">
                      <option value={1}>1 Hour</option>
                      <option value={3}>3 Hours</option>
                      <option value={6}>6 Hours</option>
                      <option value={12}>12 Hours</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Promo Code</label>
                    <div className="flex">
                      <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="flex-1 px-3 py-2 border rounded-l" placeholder="Enter promo code" />
                      <button onClick={applyPromoCode} className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700">Apply</button>
                    </div>
                  </div>
                  <PriceBreakup members={members} duration={duration} bookingCount={bookingCount} promoDiscount={promoDiscount} />
                  <button onClick={handleBooking} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Proceed to Payment</button>
                </>
              ) : (
                <div className="text-center">
                  {showQR ? (
                    <div className="mb-4">
                      <p className="mb-2">Scan this QR code to pay</p>
                      <img src={qrCodeUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
                      <p className="mt-3 text-sm font-medium">UPI ID: 9133550086@upi</p>
                      <PriceBreakup members={members} duration={duration} bookingCount={bookingCount} promoDiscount={promoDiscount} />
                      <button onClick={simulatePaymentCompletion} className="mt-4 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600">Simulate Payment Completion</button>
                    </div>
                  ) : paymentComplete ? (
                    <div className="text-center py-4">
                      <CheckCircle size={64} className="mx-auto text-green-500 mb-2" />
                      <p className="text-xl font-semibold text-green-600">Payment Successful!</p>
                      <p className="mt-2">Your slot has been booked.</p>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold mb-2">Payment Options</h4>
                      <PriceBreakup members={members} duration={duration} bookingCount={bookingCount} promoDiscount={promoDiscount} />
                      <div className="flex space-x-2 mb-4">
                        <button onClick={handlePayment} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center">
                          <DollarSign size={16} className="mr-1" />Pay Now
                        </button>
                        <button onClick={() => setShowPayment(false)} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              <h3 className="text-lg font-semibold mb-2">Book a Slot</h3>
              <p className="text-gray-600">Select an available slot from the left panel to book.</p>
            </div>
          )}

          {/* Display Board */}
          <div className="bg-white p-4 rounded-lg shadow flex-1 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Current Bookings</h3>
            <div className="space-y-2">
              {slots.filter(slot => slot.date === selectedDate && slot.isBooked).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(slot => (
                <div key={slot.id} className="bg-blue-50 p-3 rounded flex items-center">
                  <User size={16} className="mr-2 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">{slot.bookingName}</p>
                    <p className="text-sm text-gray-600">{`${convertSlotTimeTo12Hour(slot.startTime)} - ${convertSlotTimeTo12Hour(`${parseInt(slot.startTime.split(':')[0]) + slot.duration}:00`)} (${slot.members} members, ${slot.duration} hr)`}</p>
                  </div>
                </div>
              ))}
              {slots.filter(slot => slot.date === selectedDate && slot.isBooked).length === 0 && (
                <p className="text-gray-500 italic">No bookings for this date</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}